import { and, desc, eq, gt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { conversations, ideaEvents, ideas, messages } from "@/db/schema";
import { addIdeaEvent } from "@/server/ideas/idea-service";
import { getLLMProvider } from "@/server/llm/cursor-provider";
import { PostgresMemoryIndex } from "@/server/memory/memory-index";
import { PostgresBriefRepository } from "./brief-repository";
import { isSynthesizing, toBriefSnapshot, toVersionSnapshot, type BriefDeps, type BriefSources } from "./brief-service";
import { LLMContextSynthesizer } from "./context-synthesizer";
import { toTranscriptLines } from "./transcript";

const TURN_WINDOW = 30;
const REBUILD_WINDOW = 60;

const sources: BriefSources = {
  async idea(userId, ideaId) {
    const [idea] = await getDb()
      .select({ id: ideas.id, title: ideas.title, description: ideas.description })
      .from(ideas)
      .where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId)))
      .limit(1);
    return idea ?? null;
  },

  async transcript(userId, scope) {
    const columns = {
      role: messages.role,
      content: messages.content,
      metadata: messages.metadata,
      createdAt: messages.createdAt,
      conversationId: messages.conversationId,
    };
    const single = !scope.rebuild && scope.conversationId;
    const where = single
      ? and(eq(conversations.userId, userId), eq(conversations.id, scope.conversationId!))
      : and(
          eq(conversations.userId, userId),
          or(
            eq(conversations.currentIdeaId, scope.ideaId),
            scope.conversationId ? eq(conversations.id, scope.conversationId) : undefined,
          ),
        );
    const rows = await getDb()
      .select(columns)
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(single ? TURN_WINDOW + 10 : REBUILD_WINDOW + 20);
    const ordered = rows.reverse();
    return {
      lines: toTranscriptLines(ordered, single ? TURN_WINDOW : REBUILD_WINDOW),
      conversationId: single ? scope.conversationId : (ordered.at(-1)?.conversationId ?? null),
    };
  },

  async memories(userId, ideaId) {
    return new PostgresMemoryIndex().listActiveForIdea(userId, ideaId);
  },

  async recordEvents({ userId, ideaId, conversationId, events }) {
    for (const event of events) {
      await addIdeaEvent({ ideaId, userId, kind: event.kind, summary: event.summary, conversationId });
    }
    await getDb()
      .update(ideas)
      .set({ updatedAt: new Date() })
      .where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId)));
  },
};

export function briefDeps(): BriefDeps {
  return {
    repo: new PostgresBriefRepository(),
    synthesizer: new LLMContextSynthesizer(getLLMProvider()),
    sources,
  };
}

/** The brief Frimz reads during a turn, once a first version exists. */
export async function briefForIdea(userId: string, ideaId: string) {
  const brief = await new PostgresBriefRepository().findByIdea(userId, ideaId);
  return brief && brief.version > 0 ? brief : null;
}

/** Older conversations never stored their idea, so the timeline fills the gap. */
async function conversationIdea(userId: string, conversation: { id: string; currentIdeaId: string | null }) {
  if (conversation.currentIdeaId) return conversation.currentIdeaId;
  const [event] = await getDb()
    .select({ ideaId: ideaEvents.ideaId })
    .from(ideaEvents)
    .where(and(eq(ideaEvents.userId, userId), eq(ideaEvents.conversationId, conversation.id)))
    .orderBy(desc(ideaEvents.createdAt))
    .limit(1);
  if (!event) return null;
  await getDb()
    .update(conversations)
    .set({ currentIdeaId: event.ideaId })
    .where(and(eq(conversations.id, conversation.id), eq(conversations.userId, userId)));
  return event.ideaId;
}

export async function loadConversationBrief(userId: string, conversationId: string) {
  const [conversation] = await getDb()
    .select({
      id: conversations.id,
      currentIdeaId: conversations.currentIdeaId,
      checkedMessageId: conversations.contextCheckedMessageId,
    })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  if (!conversation) return null;
  const ideaId = await conversationIdea(userId, conversation);
  const brief = ideaId ? await new PostgresBriefRepository().findByIdea(userId, ideaId) : null;
  return {
    ideaId,
    brief: brief && brief.version > 0 ? toBriefSnapshot(brief) : null,
    updating: brief ? isSynthesizing(brief) : false,
    checkedMessageId: conversation.checkedMessageId,
  };
}

export async function loadIdeaBrief(userId: string, ideaId: string) {
  const repo = new PostgresBriefRepository();
  const brief = await repo.findByIdea(userId, ideaId);
  if (!brief || brief.version === 0) {
    return { brief: null, versions: [], updating: brief ? isSynthesizing(brief) : false };
  }
  const versions = await repo.listVersions(userId, brief.id);
  return { brief: toBriefSnapshot(brief), versions: versions.map(toVersionSnapshot), updating: isSynthesizing(brief) };
}

export async function listUserBriefs(userId: string) {
  const rows = await new PostgresBriefRepository().listForUser(userId);
  return rows.map(toBriefSnapshot);
}

/** Lets the chat stop waiting once the background step has seen the latest reply. */
export async function markContextChecked(userId: string, conversationId: string) {
  const [latest] = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "assistant")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (!latest) return;
  await getDb()
    .update(conversations)
    .set({ contextCheckedMessageId: latest.id })
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
}

export async function hasNewerUserMessage(conversationId: string, messageId: string) {
  const [anchor] = await getDb()
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .limit(1);
  if (!anchor) return false;
  const [newer] = await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(eq(messages.conversationId, conversationId), eq(messages.role, "user"), gt(messages.createdAt, anchor.createdAt)),
    )
    .limit(1);
  return Boolean(newer);
}
