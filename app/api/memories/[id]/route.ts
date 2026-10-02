import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth/current-user";
import { memoryEditSchema } from "@/lib/validators";
import { getMemoryStore } from "@/server/memory/memory-runtime";
import { recordActivity } from "@/server/conversations/conversation-service";
import { PostgresMemoryIndex } from "@/server/memory/memory-index";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const store = getMemoryStore();
  if (!store) return NextResponse.json({ error: "Memory storage is unavailable right now." }, { status: 503 });
  const { id } = await params;
  const parsed = memoryEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the memory and try again." }, { status: 400 });
  try {
    const memory = await store.update(user.id, id, {
      type: parsed.data.type,
      content: parsed.data.content,
      reason: parsed.data.reason ?? "",
    });
    const previous = await new PostgresMemoryIndex().get(user.id, id);
    if (previous?.ideaId) {
      const { getDb } = await import("@/db");
      const { memoryIndex } = await import("@/db/schema");
      const { and, eq } = await import("drizzle-orm");
      await getDb()
        .update(memoryIndex)
        .set({ ideaId: previous.ideaId })
        .where(and(eq(memoryIndex.id, memory.id), eq(memoryIndex.userId, user.id)));
    }
    await recordActivity(user.id, "updated", memory.type, memory.id);
    await recordActivity(user.id, "superseded", parsed.data.type, id);
    return NextResponse.json({ memory });
  } catch {
    return NextResponse.json({ error: "That memory is not available." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const store = getMemoryStore();
  const { id } = await params;
  if (!store) {
    const index = new PostgresMemoryIndex();
    const existing = await index.get(user.id, id);
    if (!existing) return NextResponse.json({ error: "That memory is not available." }, { status: 404 });
    await index.markStatus(user.id, id, "forgotten");
  } else {
    try {
      await store.delete(user.id, id);
    } catch {
      return NextResponse.json({ error: "That memory is not available." }, { status: 404 });
    }
  }
  await recordActivity(user.id, "forgotten", "hidden from retrieval", id);
  return NextResponse.json({
    ok: true,
    note: "Frimz will no longer use this memory. The Walrus blob itself is immutable and was not physically deleted.",
  });
}
