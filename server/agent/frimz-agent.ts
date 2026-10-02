import { after } from "next/server";
import { CURSOR_UNAVAILABLE } from "@/lib/constants";
import type { Mode } from "@/lib/modes";
import { logEvent } from "@/lib/logger";
import { getLLMProvider } from "@/server/llm/cursor-provider";
import {
  addMessage,
  createConversation,
  deleteMessage,
  getConversation,
  recordActivity,
  recordLog,
  touchConversation,
} from "@/server/conversations/conversation-service";
import { contextForTurn, extractMemories, recallForTurn, resolveIdea } from "@/server/memory/memory-orchestrator";
import { indicatorPhrase } from "@/server/agent/indicator-label";
import type { IndicatorType, MessageMetadata } from "@/db/schema";

export type ChatEvent =
  | { type: "conversation"; conversationId: string; title: string }
  | { type: "token"; text: string }
  | {
      type: "done";
      messageId: string;
      indicators: { type: IndicatorType; memoryId: string; label: string }[];
    }
  | { type: "error"; message: string };

export async function* runChatTurn(input: {
  userId: string;
  conversationId?: string;
  message?: string;
  mode: Mode;
  retry?: boolean;
  signal?: AbortSignal;
}): AsyncGenerator<ChatEvent> {
  const requestId = crypto.randomUUID();
  let conversationId = input.conversationId;
  let userText = input.message?.trim() ?? "";

  if (input.retry) {
    if (!conversationId) {
      yield { type: "error", message: CURSOR_UNAVAILABLE };
      return;
    }
    const loaded = await getConversation(input.userId, conversationId);
    if (!loaded) {
      yield { type: "error", message: "That conversation is not available." };
      return;
    }
    const last = loaded.messages.at(-1);
    if (last?.role === "assistant") await deleteMessage(conversationId, last.id);
    const refreshed = await getConversation(input.userId, conversationId);
    const previousUser = [...(refreshed?.messages ?? [])].reverse().find((message) => message.role === "user");
    if (!previousUser) {
      yield { type: "error", message: "There is no message to try again." };
      return;
    }
    userText = previousUser.content;
  }

  if (!userText) {
    yield { type: "error", message: "Write a thought for Frimz to think with." };
    return;
  }

  if (!conversationId) {
    const title = userText.replace(/\s+/g, " ").slice(0, 80);
    const created = await createConversation(input.userId, title);
    conversationId = created.id;
    yield { type: "conversation", conversationId, title: created.title };
  } else {
    const existing = await getConversation(input.userId, conversationId);
    if (!existing) {
      yield { type: "error", message: "That conversation is not available." };
      return;
    }
  }

  const loaded = await getConversation(input.userId, conversationId);
  if (!loaded) {
    yield { type: "error", message: "That conversation is not available." };
    return;
  }

  if (!input.retry) {
    await addMessage(conversationId, "user", userText);
  }

  const idea = await resolveIdea(input.userId, userText, loaded.conversation.currentIdeaId);
  if (idea && idea.id !== loaded.conversation.currentIdeaId) {
    await touchConversation(input.userId, conversationId, { currentIdeaId: idea.id });
  }

  const recall = await recallForTurn(input.userId, userText, idea?.title);
  const transcript = (await getConversation(input.userId, conversationId))?.messages ?? [];
  const prior = transcript.filter((message) => message.role === "user" || message.role === "assistant");
  const history = input.retry ? prior : prior.slice(0, -1);
  const prompt = contextForTurn({
    mode: input.mode,
    preferences: recall.preferences,
    memories: recall.memories,
    ideaTitle: idea?.title,
    ideaDescription: idea?.description,
    transcript: history.map((message) => ({ role: message.role, content: message.content })),
    userMessage: userText,
  });

  const started = Date.now();
  let assistant = "";
  let failed = false;
  try {
    const provider = getLLMProvider();
    for await (const chunk of provider.stream({ ...prompt, signal: input.signal })) {
      if (input.signal?.aborted) break;
      assistant += chunk.text;
      yield { type: "token", text: chunk.text };
    }
  } catch (error) {
    failed = true;
    logEvent("cursor_failed", {
      requestId,
      userId: input.userId,
      conversationId,
      message: error instanceof Error ? error.message : "failed",
    });
    await recordLog("error", { phase: "cursor", requestId }, input.userId, conversationId).catch(() => undefined);
  }

  await recordLog(
    "request",
    {
      requestId,
      memoryRetrievalCount: recall.memories.length,
      cursorLatencyMs: Date.now() - started,
      failed,
    },
    input.userId,
    conversationId,
  ).catch(() => undefined);

  if (input.signal?.aborted) {
    if (assistant.trim()) {
      await addMessage(conversationId, "assistant", assistant);
    }
    return;
  }

  if (failed || !assistant.trim()) {
    const message = await addMessage(conversationId, "assistant", CURSOR_UNAVAILABLE, { error: true });
    yield { type: "error", message: CURSOR_UNAVAILABLE };
    yield { type: "done", messageId: message.id, indicators: [] }; // error turn has no memory indicators
    return;
  }

  const selected = new Set(prompt.strategy.shouldUseMemory ? prompt.strategy.relevantMemoryIds : []);
  const indicators = (recall.indicators ?? []).filter((indicator) => selected.has(indicator.memoryId));
  const metadata: MessageMetadata | undefined =
    indicators.length > 0 ? { memoryUsed: true, indicators } : undefined;
  const saved = await addMessage(conversationId, "assistant", assistant, metadata);
  for (const indicator of indicators) {
    await recordActivity(input.userId, "used", indicator.type, indicator.memoryId, conversationId);
  }

  const snapshot = (await getConversation(input.userId, conversationId))?.messages ?? [];
  after(() =>
    extractMemories({
      userId: input.userId,
      conversationId: conversationId!,
      ideaTitle: idea?.title,
      transcript: snapshot.map((message) => ({ role: message.role, content: message.content })),
    }).catch((error: unknown) => {
      logEvent("extraction_failed", {
        userId: input.userId,
        message: error instanceof Error ? error.message : "failed",
      });
    }),
  );

  yield {
    type: "done",
    messageId: saved.id,
    indicators: indicators.map((indicator) => ({
      ...indicator,
      label: indicatorPhrase(recall.memories.find((memory) => memory.id === indicator.memoryId)?.type ?? ""),
    })),
  };
}
