import { NextResponse } from "next/server";
import { idSchema } from "@/lib/validators";
import { logEvent } from "@/lib/logger";
import { requireUser } from "@/server/auth/current-user";
import { loadConversationBrief } from "@/server/context/brief-runtime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const result = await loadConversationBrief(user.id, id);
    if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    logEvent("brief_load_failed", { userId: user.id, message: error instanceof Error ? error.message : "failed" });
    return NextResponse.json({ error: "Current thinking could not be loaded right now." }, { status: 500 });
  }
}
