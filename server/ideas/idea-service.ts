import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ideaEvents, ideas, memoryIndex } from "@/db/schema";
import type { IdeaStatus } from "@/server/memory/types";

export async function listIdeas(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(ideas)
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.updatedAt));
  const counts = await db
    .select({ ideaId: ideaEvents.ideaId, value: sql<number>`count(*)::int` })
    .from(ideaEvents)
    .where(eq(ideaEvents.userId, userId))
    .groupBy(ideaEvents.ideaId);
  const questions = await db
    .select()
    .from(memoryIndex)
    .where(
      and(eq(memoryIndex.userId, userId), eq(memoryIndex.type, "open_question"), eq(memoryIndex.status, "active")),
    );
  return rows.map((idea) => ({
    ...idea,
    eventCount: counts.find((count) => count.ideaId === idea.id)?.value ?? 0,
    openQuestions: questions.filter((question) => question.ideaId === idea.id).map((question) => question.content),
  }));
}

export async function getIdea(userId: string, id: string) {
  const db = getDb();
  const [idea] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .limit(1);
  if (!idea) return null;
  const events = await db
    .select()
    .from(ideaEvents)
    .where(and(eq(ideaEvents.ideaId, id), eq(ideaEvents.userId, userId)))
    .orderBy(asc(ideaEvents.createdAt));
  const related = await db
    .select()
    .from(memoryIndex)
    .where(and(eq(memoryIndex.userId, userId), eq(memoryIndex.ideaId, id), eq(memoryIndex.status, "active")))
    .orderBy(desc(memoryIndex.createdAt));
  return { idea, events, memories: related };
}

export async function findIdeaByTitle(userId: string, title: string) {
  const [idea] = await getDb()
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), ilike(ideas.title, title)))
    .limit(1);
  return idea ?? null;
}

export async function upsertIdea(
  userId: string,
  input: { title: string; description: string; status: IdeaStatus },
) {
  const existing = await findIdeaByTitle(userId, input.title);
  if (existing) {
    const [updated] = await getDb()
      .update(ideas)
      .set({
        description: input.description || existing.description,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(and(eq(ideas.id, existing.id), eq(ideas.userId, userId)))
      .returning();
    return updated;
  }
  const [created] = await getDb().insert(ideas).values({ userId, ...input }).returning();
  return created;
}

export async function addIdeaEvent(input: {
  ideaId: string;
  userId: string;
  kind: string;
  summary: string;
  memoryId?: string | null;
  conversationId?: string | null;
}) {
  const [event] = await getDb()
    .insert(ideaEvents)
    .values({
      ideaId: input.ideaId,
      userId: input.userId,
      kind: input.kind,
      summary: input.summary,
      memoryId: input.memoryId ?? null,
      conversationId: input.conversationId ?? null,
    })
    .returning();
  return event;
}

export function matchIdeaTitle(message: string, titles: { id: string; title: string }[]) {
  const lower = message.toLowerCase();
  const hits = titles.filter((idea) => idea.title.length > 2 && lower.includes(idea.title.toLowerCase()));
  return hits.length === 1 ? hits[0] : null;
}
