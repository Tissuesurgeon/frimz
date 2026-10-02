import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/server/auth/current-user";
import { deleteConversation, getConversation, touchConversation } from "@/server/conversations/conversation-service";
import { getDb } from "@/db";
import { memoryIndex } from "@/db/schema";
import { indicatorPhrase } from "@/server/agent/indicator-label";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  const result = await getConversation(user.id, id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ids = result.messages.flatMap((message) => message.metadata?.indicators?.map((item) => item.memoryId) ?? []);
  const labels =
    ids.length === 0
      ? []
      : await getDb()
          .select({ id: memoryIndex.id, type: memoryIndex.type })
          .from(memoryIndex)
          .where(and(eq(memoryIndex.userId, user.id), inArray(memoryIndex.id, ids)));
  const typeById = new Map(labels.map((label) => [label.id, label.type]));
  return NextResponse.json({
    conversation: result.conversation,
    messages: result.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      error: message.metadata?.error ?? false,
      indicators: (message.metadata?.indicators ?? []).map((indicator) => ({
        ...indicator,
        label: indicatorPhrase(typeById.get(indicator.memoryId) ?? ""),
      })),
    })),
  });
}

const patchSchema = z.object({ title: z.string().trim().min(1).max(80) });

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give the conversation a short title." }, { status: 400 });
  const conversation = await touchConversation(user.id, id, { title: parsed.data.title });
  if (!conversation) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { id } = await params;
  const conversation = await deleteConversation(user.id, id);
  if (!conversation) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
