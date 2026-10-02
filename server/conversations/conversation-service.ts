import { and, asc, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appLogs, conversations, ideas, memoryActivity, memoryIndex, messages, type MessageMetadata } from "@/db/schema";

export async function listConversations(userId: string) {
  return getDb()
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversation(userId: string, id: string) {
  const db = getDb();
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  if (!conversation) return null;
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  return { conversation, messages: history };
}

export async function createConversation(userId: string, title: string) {
  const [conversation] = await getDb()
    .insert(conversations)
    .values({ userId, title: title.slice(0, 80) || "New conversation" })
    .returning();
  return conversation;
}

export async function touchConversation(userId: string, id: string, patch: { title?: string; currentIdeaId?: string | null }) {
  const [conversation] = await getDb()
    .update(conversations)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();
  return conversation ?? null;
}

export async function deleteConversation(userId: string, id: string) {
  const [conversation] = await getDb()
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();
  return conversation ?? null;
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: MessageMetadata,
) {
  const [message] = await getDb()
    .insert(messages)
    .values({ conversationId, role, content, metadata })
    .returning();
  await getDb()
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
  return message;
}

export async function deleteMessage(conversationId: string, messageId: string) {
  await getDb()
    .delete(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)));
}

export async function recordActivity(
  userId: string,
  event: string,
  detail: string,
  memoryId?: string | null,
  conversationId?: string | null,
) {
  await getDb().insert(memoryActivity).values({
    userId,
    event,
    detail,
    memoryId: memoryId ?? null,
    conversationId: conversationId ?? null,
  });
}

export async function recordLog(
  kind: string,
  payload: Record<string, unknown>,
  userId?: string,
  conversationId?: string,
) {
  await getDb().insert(appLogs).values({
    kind,
    payload,
    userId: userId ?? null,
    conversationId: conversationId ?? null,
  });
}

export async function userCounts(userId: string) {
  const db = getDb();
  const [conversationCount] = await db
    .select({ value: count() })
    .from(conversations)
    .where(eq(conversations.userId, userId));
  const [memoryCount] = await db
    .select({ value: count() })
    .from(memoryIndex)
    .where(and(eq(memoryIndex.userId, userId), eq(memoryIndex.status, "active")));
  const [ideaCount] = await db.select({ value: count() }).from(ideas).where(eq(ideas.userId, userId));
  const [recallCount] = await db
    .select({ value: count() })
    .from(memoryActivity)
    .where(and(eq(memoryActivity.userId, userId), eq(memoryActivity.event, "retrieved")));
  return {
    conversations: Number(conversationCount?.value ?? 0),
    memories: Number(memoryCount?.value ?? 0),
    ideas: Number(ideaCount?.value ?? 0),
    recalls: Number(recallCount?.value ?? 0),
  };
}
