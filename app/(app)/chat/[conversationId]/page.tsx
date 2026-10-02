import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/server/auth/current-user";
import { getConversation } from "@/server/conversations/conversation-service";
import { getDb } from "@/db";
import { memoryIndex } from "@/db/schema";
import { indicatorPhrase } from "@/server/agent/indicator-label";
import { ChatView, type ChatMessage } from "@/components/chat/chat-view";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const user = await requireUser();
  if (!user) notFound();
  const { conversationId } = await params;
  const result = await getConversation(user.id, conversationId);
  if (!result) notFound();
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
      indicators: message.metadata?.indicators?.map((indicator) => ({
        ...indicator,
        label: indicatorPhrase(typeById.get(indicator.memoryId) ?? ""),
      })),
    }));
  return <ChatView conversationId={result.conversation.id} title={result.conversation.title} initialMessages={messages} />;
}
