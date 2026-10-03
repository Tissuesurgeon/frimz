import { NextResponse } from "next/server";
import { briefEditSchema, briefRegenerateSchema, idSchema } from "@/lib/validators";
import { logEvent } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/current-user";
import { briefDeps, loadIdeaBrief } from "@/server/context/brief-runtime";
import { editBrief, synthesizeBrief, toBriefSnapshot } from "@/server/context/brief-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

const UNAVAILABLE = "Current thinking could not be updated right now. Try again in a moment.";

function failure(userId: string, phase: string, error: unknown) {
  logEvent("brief_route_failed", { userId, phase, message: error instanceof Error ? error.message : "failed" });
  return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
}

async function ideaId(params: Params["params"]) {
  const { id } = await params;
  return idSchema.safeParse(id).success ? id : null;
}

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const id = await ideaId(params);
  if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const deps = briefDeps();
    if (!(await deps.sources.idea(user.id, id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(await loadIdeaBrief(user.id, id));
  } catch (error) {
    return failure(user.id, "load", error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const id = await ideaId(params);
  if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!rateLimit(`brief-edit:${user.id}`, 30).ok) {
    return NextResponse.json({ error: "Give it a moment, then save again." }, { status: 429 });
  }
  const parsed = briefEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That edit could not be read." }, { status: 400 });
  try {
    const result = await editBrief(briefDeps(), {
      userId: user.id,
      ideaId: id,
      baseVersion: parsed.data.baseVersion,
      data: parsed.data.data,
    });
    if (result.status === "missing") return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (result.status === "conflict") {
      return NextResponse.json(
        {
          error: "Current thinking changed while you were editing. Your draft is still here.",
          brief: result.brief && result.brief.version > 0 ? toBriefSnapshot(result.brief) : null,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      saved: result.status === "saved",
      brief: result.brief && result.brief.version > 0 ? toBriefSnapshot(result.brief) : null,
    });
  } catch (error) {
    return failure(user.id, "edit", error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const id = await ideaId(params);
  if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!rateLimit(`brief-regenerate:${user.id}`, 5).ok) {
    return NextResponse.json({ error: "Frimz needs a short pause. Try again in a moment." }, { status: 429 });
  }
  const parsed = briefRegenerateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  try {
    const deps = briefDeps();
    if (!(await deps.sources.idea(user.id, id))) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const result = await synthesizeBrief(deps, {
      userId: user.id,
      ideaId: id,
      conversationId: parsed.data.conversationId ?? null,
      rebuild: true,
    });
    if (result.status === "busy") {
      return NextResponse.json({ error: "Frimz is already updating this. It will appear in a moment." }, { status: 409 });
    }
    if (result.status === "failed") return NextResponse.json({ error: UNAVAILABLE }, { status: 502 });
    return NextResponse.json({
      changed: result.status === "updated",
      brief: result.brief && result.brief.version > 0 ? toBriefSnapshot(result.brief) : null,
    });
  } catch (error) {
    return failure(user.id, "regenerate", error);
  }
}
