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
import { contextForTurn, recallForTurn, resolveIdea } from "@/server/memory/memory-orchestrator";
import { indicatorPhrase } from "@/server/agent/indicator-label";
import { briefForIdea } from "@/server/context/brief-runtime";
import { updateThinkingAfterTurn } from "@/server/context/context-updater";
import { LLMWriteUpGenerator, planWriteUp } from "@/server/context/write-up";
import { PostgresMemoryIndex } from "@/server/memory/memory-index";
import { isDraftable } from "@/lib/context-brief";
import type { IndicatorType, MessageMetadata } from "@/db/schema";

export type ChatEvent =
  | { type: "conversation"; conversationId: string; title: string }
  | { type: "token"; text: string }
  | {
      type: "done";
      messageId: string;
      indicators: { type: IndicatorType; memoryId: string; label: string; kind: string }[];
      draft?: { format: string };
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
  const stored = idea ? await briefForIdea(input.userId, idea.id).catch(() => null) : null;
  const brief = stored ? { version: stored.version, data: stored.data, userFields: stored.userFields } : null;
  const transcript = (await getConversation(input.userId, conversationId))?.messages ?? [];
  const prior = transcript.filter((message) => message.role === "user" || message.role === "assistant");
  const history = input.retry ? prior : prior.slice(0, -1);
  const lastUser = prior.map((message) => message.role).lastIndexOf("user");
  const before = lastUser > 0 ? prior[lastUser - 1] : null;
  const previousReply = before?.role === "assistant" ? before : null;

  const writeUp = planWriteUp({ message: userText, previous: previousReply });
  const offered = (version: number) =>
    prior.some(
      (message) =>
        message.role === "assistant" &&
        (message.metadata?.draftOffer?.briefVersion === version || message.metadata?.writeUp?.briefVersion === version),
    );
  const prompt = writeUp
    ? null
    : contextForTurn({
        mode: input.mode,
        preferences: recall.preferences,
        memories: recall.memories,
        ideaTitle: idea?.title,
        ideaDescription: idea?.description,
        brief,
        offerDraft: Boolean(brief && isDraftable(brief.data) && !offered(brief.version)),
        transcript: history.map((message) => ({ role: message.role, content: message.content })),
        userMessage: userText,
      });

  if (process.env.NODE_ENV !== "production" && prompt) {
    const plan = prompt.strategy;
    logEvent("orchestration", {
      intent: plan.intent,
      thinkingStage: plan.thinkingStage,
      move: plan.conversationalMove,
      uncertainty: plan.uncertaintyLevel,
      questions: plan.questionCount,
      structure: plan.shouldStructure,
      challenge: plan.shouldChallenge,
      memoryUsed: plan.relevantMemoryIds.length,
    });
  }

  const started = Date.now();
  let assistant = "";
  let failed = false;
  try {
    const provider = getLLMProvider();
    const chunks = writeUp
      ? new LLMWriteUpGenerator(provider).stream(
          {
            plan: writeUp,
            request: userText,
            ideaTitle: idea?.title,
            brief,
            memories: idea
              ? await new PostgresMemoryIndex().listActiveForIdea(input.userId, idea.id).catch(() => recall.memories)
              : recall.memories,
            transcript: history,
          },
          input.signal,
        )
      : provider.stream({ ...prompt!, signal: input.signal });
    for await (const chunk of chunks) {
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

  const draft = writeUp ? { format: writeUp.format?.id ?? "custom", briefVersion: brief?.version ?? 0 } : undefined;

  if (input.signal?.aborted) {
    if (assistant.trim()) {
      await addMessage(conversationId, "assistant", assistant, draft ? { writeUp: draft } : undefined);
    }
    return;
  }

  if (failed || !assistant.trim()) {
    const message = await addMessage(conversationId, "assistant", CURSOR_UNAVAILABLE, { error: true });
    yield { type: "error", message: CURSOR_UNAVAILABLE };
    yield { type: "done", messageId: message.id, indicators: [] }; // error turn has no memory indicators
    return;
  }

  const selected = new Set(prompt?.strategy.shouldUseMemory ? prompt.strategy.relevantMemoryIds : []);
  const indicators = (recall.indicators ?? []).filter((indicator) => selected.has(indicator.memoryId));
  const metadata: MessageMetadata = {};
  if (indicators.length > 0) Object.assign(metadata, { memoryUsed: true, indicators });
  if (draft) metadata.writeUp = draft;
  if (prompt?.strategy.offersDraft && brief) metadata.draftOffer = { briefVersion: brief.version };
  const saved = await addMessage(
    conversationId,
    "assistant",
    assistant,
    Object.keys(metadata).length > 0 ? metadata : undefined,
  );
  for (const indicator of indicators) {
    await recordActivity(input.userId, "used", indicator.type, indicator.memoryId, conversationId);
  }

  const snapshot = (await getConversation(input.userId, conversationId))?.messages ?? [];
  after(() =>
    updateThinkingAfterTurn({
      userId: input.userId,
      conversationId: conversationId!,
      assistantMessageId: saved.id,
      ideaTitle: idea?.title,
      transcript: snapshot,
    }).catch((error: unknown) => {
      logEvent("thinking_update_failed", {
        userId: input.userId,
        message: error instanceof Error ? error.message : "failed",
      });
    }),
  );

  yield {
    type: "done",
    messageId: saved.id,
    indicators: indicators.map((indicator) => {
      const kind = recall.memories.find((memory) => memory.id === indicator.memoryId)?.type ?? "";
      return { ...indicator, kind, label: indicatorPhrase(kind) };
    }),
    ...(draft ? { draft: { format: draft.format } } : {}),
  };
}
