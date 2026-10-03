import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/server/auth/current-user";
import { getConversation } from "@/server/conversations/conversation-service";
import { getDb } from "@/db";
import { memoryIndex } from "@/db/schema";
import { indicatorPhrase } from "@/server/agent/indicator-label";
import { ChatView, type ChatMessage } from "@/components/chat/chat-view";
import { THINKING_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationId: string }> };

const loadConversation = cache(async (conversationId: string) => {
  const user = await requireUser();
  if (!user) return null;
  const result = await getConversation(user.id, conversationId);
  return result ? { user, result } : null;
});

export async function generateMetadata({ params }: Params) {
  const loaded = await loadConversation((await params).conversationId);
  return loaded ? { title: loaded.result.conversation.title } : {};
}

export default async function ConversationPage({ params }: Params) {
  const loaded = await loadConversation((await params).conversationId);
  if (!loaded) notFound();
  const { user, result } = loaded;
  const ids = result.messages.flatMap((message) => message.metadata?.indicators?.map((item) => item.memoryId) ?? []);
  const labels = ids.length
    ? await getDb()
        .select({ id: memoryIndex.id, type: memoryIndex.type })
        .from(memoryIndex)
        .where(and(eq(memoryIndex.userId, user.id), inArray(memoryIndex.id, ids)))
    : [];
  const typeById = new Map(labels.map((label) => [label.id, label.type]));
  const messages: ChatMessage[] = result.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      error: message.metadata?.error,
      createdAt: message.createdAt.toISOString(),
      draft: message.metadata?.writeUp ? { format: message.metadata.writeUp.format } : undefined,
      indicators: message.metadata?.indicators?.map((indicator) => ({
        ...indicator,
        kind: typeById.get(indicator.memoryId) ?? "",
        label: indicatorPhrase(typeById.get(indicator.memoryId) ?? ""),
      })),
    }));
  const thinkingOpen = (await cookies()).get(THINKING_COOKIE)?.value === "open";
  return (
    <ChatView
      conversationId={result.conversation.id}
      title={result.conversation.title}
      initialMessages={messages}
      initialThinkingOpen={thinkingOpen}
    />
  );
}
