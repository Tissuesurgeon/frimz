import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ideas, memoryIndex } from "@/db/schema";
import { logEvent } from "@/lib/logger";
import { getLLMProvider } from "@/server/llm/cursor-provider";
import { FRIMZ_SYSTEM_PROMPT } from "@/server/agent/prompts/frimz-system";
import { HUMAN_CONVERSATION_POLICY } from "@/server/agent/prompts/human-conversation";
import { MEMORY_EXTRACTION_PROMPT } from "@/server/agent/prompts/memory-extraction";
import { buildFrimzContext, type ContextBriefInput } from "@/server/agent/context-builder";
import { buildBehaviorAddendum } from "@/server/agent/response-strategy";
import { chooseConversationStrategy } from "@/server/agent/conversational-strategy";
import { renderConversationStrategy } from "@/server/agent/prompts/conversation-strategy";
import type { Mode } from "@/lib/modes";
import { parseExtraction, validateIdea, validateMemories } from "./memory-validator";
import { indicatorMemories, mergePreferences } from "./memory-retrieval";
import { isMeaningfulProgress, planMemoryWrite } from "./memory-updater";
import { getMemoryStore } from "./memory-runtime";
import { PostgresMemoryIndex } from "./memory-index";
import type { MemoryDraft, MemoryRecord, MemoryType } from "./types";
import { shouldCreateIdeaEvent } from "@/server/ideas/idea-events";
import {
  addIdeaEvent,
  closestIdea,
  findIdeaByTitle,
  listIdeas,
  matchIdeaTitle,
  upsertIdea,
} from "@/server/ideas/idea-service";
import { recordActivity, recordLog } from "@/server/conversations/conversation-service";

export async function recallForTurn(userId: string, message: string, ideaTitle?: string) {
  const index = new PostgresMemoryIndex();
  const preferences = (await index.listActive(userId)).filter((memory) => memory.type === "user_preference");
  const store = getMemoryStore();
  if (!store) {
    await recordLog("walrus", { failure: "not_configured", phase: "recall" }, userId).catch(() => undefined);
    return { memories: preferences, preferences, indicators: [] as ReturnType<typeof indicatorMemories> };
  }
  try {
    const recalled = await store.search({ userId, query: message, limit: 8 });
    const memories = mergePreferences(recalled, preferences);
    for (const memory of recalled) {
      await recordActivity(userId, "retrieved", memory.type, memory.id);
    }
    return {
      memories,
      preferences,
      indicators: indicatorMemories(recalled, ideaTitle),
    };
  } catch (error) {
    logEvent("walrus_recall_failed", { userId, message: error instanceof Error ? error.message : "failed" });
    await recordLog("error", { phase: "recall" }, userId).catch(() => undefined);
    return { memories: preferences, preferences, indicators: [] as ReturnType<typeof indicatorMemories> };
  }
}

export function contextForTurn(input: {
  mode: Mode;
  preferences: MemoryRecord[];
  memories: MemoryRecord[];
  ideaTitle?: string;
  ideaDescription?: string;
  brief?: ContextBriefInput | null;
  offerDraft?: boolean;
  transcript: { role: string; content: string }[];
  userMessage: string;
}) {
  const strategy = chooseConversationStrategy({
    mode: input.mode,
    userMessage: input.userMessage,
    memories: input.memories,
    preferences: input.preferences,
    ideaTitle: input.ideaTitle,
    offerDraft: input.offerDraft,
  });
  const context = buildFrimzContext({
    preferences: input.preferences,
    memories: input.memories,
    ideaTitle: input.ideaTitle,
    ideaDescription: input.ideaDescription,
    brief: input.brief,
    transcript: input.transcript,
    userMessage: input.userMessage,
    strategy,
  });
  const behavior = buildBehaviorAddendum(input.mode, input.preferences);
  return {
    strategy,
    messages: [
      { role: "system" as const, content: `${FRIMZ_SYSTEM_PROMPT}\n\n${HUMAN_CONVERSATION_POLICY}\n\n${behavior}\n\n${renderConversationStrategy(strategy)}` },
      { role: "user" as const, content: context },
    ],
  };
}

export type ExtractionOutcome = {
  ideaId: string | null;
  /** New durable thinking, or an idea that appeared or changed status. */
  progress: boolean;
  /** Memory types written to Walrus this turn. */
  kinds: MemoryType[];
};

export function extractionInput(input: {
  transcript: { role: string; content: string }[];
  ideaTitle?: string;
  knownIdeas?: string[];
}) {
  const lines = [`CURRENT IDEA: ${input.ideaTitle || "None identified yet."}`];
  const others = (input.knownIdeas ?? []).filter((title) => title !== input.ideaTitle).slice(0, 12);
  if (others.length > 0) lines.push(`OTHER IDEAS: ${others.join("; ")}`);
  lines.push("", "CONVERSATION");
  for (const message of input.transcript.slice(-20)) lines.push(`${message.role}: ${message.content}`);
  return lines.join("\n");
}

export async function extractMemories(input: {
  userId: string;
  conversationId: string;
  transcript: { role: string; content: string }[];
  ideaTitle?: string;
  knownIdeas?: string[];
}): Promise<ExtractionOutcome> {
  const none: ExtractionOutcome = { ideaId: null, progress: false, kinds: [] };
  const provider = getLLMProvider();
  let raw = "";
  try {
    const response = await provider.generate({
      messages: [
        { role: "system", content: MEMORY_EXTRACTION_PROMPT },
        { role: "user", content: extractionInput(input) },
      ],
    });
    raw = response.text;
  } catch (error) {
    logEvent("extraction_failed", { userId: input.userId, message: error instanceof Error ? error.message : "failed" });
    await recordLog("error", { phase: "extraction" }, input.userId, input.conversationId).catch(() => undefined);
    return none;
  }

  const draft = parseExtraction(raw);
  const memories = validateMemories(draft);
  const idea = validateIdea(draft.idea);
  await recordActivity(input.userId, "analyzed", `${memories.length} kept`, null, input.conversationId);
  if (memories.length === 0 && !idea) return none;

  let ideaId: string | null = null;
  let ideaMoved = false;
  if (idea) {
    const before = await findIdeaByTitle(input.userId, idea.title);
    const saved = await upsertIdea(input.userId, idea);
    ideaId = saved.id;
    ideaMoved = !before || before.status !== saved.status;
  } else if (input.ideaTitle) {
    const current = await findIdeaByTitle(input.userId, input.ideaTitle);
    ideaId = current?.id ?? null;
  }

  const existing = await new PostgresMemoryIndex().list(input.userId);
  const progress = isMeaningfulProgress(existing, memories, ideaMoved);

  const store = getMemoryStore();
  if (!store) {
    await recordLog("walrus", { failure: "not_configured", phase: "store" }, input.userId, input.conversationId).catch(
      () => undefined,
    );
    return { ideaId, progress, kinds: [] };
  }

  const kinds: MemoryType[] = [];
  for (const memory of memories) {
    const plan = planMemoryWrite(existing, memory);
    if (plan.action === "skip") continue;
    await recordActivity(input.userId, "validated", memory.type, null, input.conversationId);
    try {
      const draftMemory: MemoryDraft = {
        ...memory,
        supersedes: plan.supersedeId ? memory.supersedes : memory.supersedes,
      };
      const created = plan.supersedeId
        ? await store.update(input.userId, plan.supersedeId, {
            type: draftMemory.type,
            content: draftMemory.content,
            reason: draftMemory.reason,
            ideaTitle: draftMemory.ideaTitle,
          })
        : await store.create(input.userId, draftMemory);
      if (ideaId) {
        await getDb()
          .update(memoryIndex)
          .set({ ideaId })
          .where(and(eq(memoryIndex.id, created.id), eq(memoryIndex.userId, input.userId)));
      }
      await recordActivity(input.userId, "stored", memory.type, created.id, input.conversationId);
      kinds.push(memory.type);
      if (plan.supersedeId) {
        await recordActivity(input.userId, "superseded", memory.type, plan.supersedeId, input.conversationId);
      }
      existing.push(created);
      if (ideaId && shouldCreateIdeaEvent(memory)) {
        await addIdeaEvent({
          ideaId,
          userId: input.userId,
          kind: memory.type,
          summary: memory.content,
          memoryId: created.id,
          conversationId: input.conversationId,
        });
        await getDb()
          .update(ideas)
          .set({ updatedAt: new Date() })
          .where(and(eq(ideas.id, ideaId), eq(ideas.userId, input.userId)));
      }
    } catch (error) {
      logEvent("memory_persist_failed", {
        userId: input.userId,
        message: error instanceof Error ? error.message : "failed",
      });
      await recordActivity(input.userId, "error", "persist_failed", null, input.conversationId);
    }
  }
  return { ideaId, progress, kinds };
}

export async function resolveIdea(userId: string, message: string, currentIdeaId: string | null) {
  const ideas = await listIdeas(userId);
  const namedId = matchIdeaTitle(message, ideas)?.id;
  const named = ideas.find((idea) => idea.id === namedId);
  if (currentIdeaId) {
    const current = ideas.find((idea) => idea.id === currentIdeaId);
    if (named && named.id !== currentIdeaId) return named;
    if (current) return current;
  }
  return named ?? closestIdea(message, ideas);
}
