import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { conversations } from "@/db/schema";
import { logEvent } from "@/lib/logger";
import { recordLog } from "@/server/conversations/conversation-service";
import { recentIdeaTitles } from "@/server/ideas/idea-service";
import { extractMemories } from "@/server/memory/memory-orchestrator";
import { briefDeps, hasNewerUserMessage, markContextChecked } from "./brief-runtime";
import { synthesizeBrief } from "./brief-service";
import { messageForAnalysis, type StoredMessage } from "./transcript";

/**
 * Runs after the reply has streamed: durable memories first, then the brief when the turn moved the thinking.
 * Every failure stays here, so chat never sees it and the brief keeps its previous version.
 */
export async function updateThinkingAfterTurn(input: {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  ideaTitle?: string;
  transcript: StoredMessage[];
}) {
  let handedOff = false;
  try {
    const extraction = await extractMemories({
      userId: input.userId,
      conversationId: input.conversationId,
      ideaTitle: input.ideaTitle,
      knownIdeas: await recentIdeaTitles(input.userId),
      transcript: input.transcript
        .filter((message) => (message.role === "user" || message.role === "assistant") && !message.metadata?.error)
        .map((message) => ({ role: message.role, content: messageForAnalysis(message) })),
    });

    const [conversation] = await getDb()
      .select({ currentIdeaId: conversations.currentIdeaId })
      .from(conversations)
      .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId)))
      .limit(1);
    if (!conversation) return;
    const ideaId = extraction.ideaId ?? conversation.currentIdeaId;
    if (!ideaId) return;
    if (ideaId !== conversation.currentIdeaId) {
      await getDb()
        .update(conversations)
        .set({ currentIdeaId: ideaId })
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId)));
    }

    const deps = briefDeps();
    if (extraction.progress) {
      const idea = await deps.sources.idea(input.userId, ideaId);
      if (!idea) return;
      const brief = await deps.repo.ensure(input.userId, ideaId, idea.title);
      await deps.repo.markStale(input.userId, brief.id, new Date());
    }

    // A newer message is already on its way; its turn picks up this progress too.
    if (await hasNewerUserMessage(input.conversationId, input.assistantMessageId)) {
      handedOff = true;
      return;
    }

    const outcome = await synthesizeBrief(deps, {
      userId: input.userId,
      ideaId,
      conversationId: input.conversationId,
      skipEvents: extraction.kinds.includes("idea_change") ? ["direction"] : [],
    });
    // The running update re-checks the stale mark and finishes this turn as well.
    if (outcome.status === "busy") handedOff = true;
    if (outcome.status === "failed") {
      await recordLog("error", { phase: "brief" }, input.userId, input.conversationId).catch(() => undefined);
    }
  } catch (error) {
    logEvent("thinking_update_failed", {
      userId: input.userId,
      message: error instanceof Error ? error.message : "failed",
    });
    await recordLog("error", { phase: "brief" }, input.userId, input.conversationId).catch(() => undefined);
  } finally {
    if (!handedOff) await markContextChecked(input.userId, input.conversationId).catch(() => undefined);
  }
}
