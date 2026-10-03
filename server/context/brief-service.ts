import {
  briefSection,
  changedFields,
  isEmptyBrief,
  normalizeBrief,
  sameBrief,
  type BriefField,
  type BriefSnapshot,
  type BriefVersionSnapshot,
  type ContextBriefData,
} from "@/lib/context-brief";
import { logEvent } from "@/lib/logger";
import type { MemoryRecord } from "@/server/memory/types";
import { applyBriefGuards, contentTokens, type TranscriptLine } from "./brief-guards";
import type { BriefRecord, BriefRepository, BriefVersionRecord } from "./brief-repository";
import type { ContextSynthesizer } from "./context-synthesizer";

export const SYNTHESIS_LOCK_MS = 3 * 60_000;
const MAX_ROUNDS = 3;

export type IdeaSummary = { id: string; title: string; description: string };
export type BriefEvent = { kind: string; summary: string };

export type BriefSources = {
  idea(userId: string, ideaId: string): Promise<IdeaSummary | null>;
  transcript(
    userId: string,
    scope: { ideaId: string; conversationId: string | null; rebuild: boolean },
  ): Promise<{ lines: TranscriptLine[]; conversationId: string | null }>;
  memories(userId: string, ideaId: string): Promise<MemoryRecord[]>;
  recordEvents(input: { userId: string; ideaId: string; conversationId: string | null; events: BriefEvent[] }): Promise<void>;
};

export type BriefDeps = {
  repo: BriefRepository;
  synthesizer: ContextSynthesizer;
  sources: BriefSources;
  now?: () => Date;
};

export type SynthesisStatus = "updated" | "unchanged" | "busy" | "skipped" | "failed";

const EVENT_FIELDS: Array<[BriefField, string]> = [
  ["problem", "problem"],
  ["targetUser", "target_user"],
  ["goal", "goal"],
  ["currentDirection", "direction"],
];

function sameMeaning(a: string, b: string) {
  const left = contentTokens(a);
  const right = new Set(contentTokens(b));
  if (left.length === 0 || right.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase();
  const shared = left.filter((token) => right.has(token)).length;
  return shared / Math.max(left.length, right.size) >= 0.8;
}

/** Timeline entries for the parts of the brief that describe where the idea is heading. */
export function briefEvents(previous: ContextBriefData, next: ContextBriefData): BriefEvent[] {
  const events: BriefEvent[] = [];
  for (const [field, kind] of EVENT_FIELDS) {
    const before = previous[field];
    const after = next[field];
    if (typeof after !== "string" || !after) continue;
    if (typeof before === "string" && sameMeaning(before, after)) continue;
    events.push({ kind, summary: after });
  }
  return events;
}

function humanList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function describeChange(previous: ContextBriefData, next: ContextBriefData) {
  if (isEmptyBrief(previous)) return "First picture of the idea";
  const labels = changedFields(previous, next)
    .filter((field) => field !== "context")
    .map((field) => briefSection(field).label.toLowerCase());
  return labels.length > 0 ? `Updated ${humanList(labels.slice(0, 3))}` : "Updated where it stands";
}

function editSummary(fields: BriefField[]) {
  return `You corrected ${humanList(fields.slice(0, 3).map((field) => briefSection(field).label.toLowerCase()))}`;
}

export async function synthesizeBrief(
  deps: BriefDeps,
  input: {
    userId: string;
    ideaId: string;
    conversationId: string | null;
    rebuild?: boolean;
    /** Event kinds the same turn already put on the timeline. */
    skipEvents?: string[];
  },
): Promise<{ status: SynthesisStatus; brief: BriefRecord | null }> {
  const now = deps.now ?? (() => new Date());
  const idea = await deps.sources.idea(input.userId, input.ideaId);
  if (!idea) return { status: "skipped", brief: null };
  let brief = await deps.repo.ensure(input.userId, input.ideaId, idea.title);
  if (!input.rebuild && !brief.staleSince) return { status: "unchanged", brief };
  if (!(await deps.repo.acquire(input.userId, brief.id, now(), SYNTHESIS_LOCK_MS))) return { status: "busy", brief };

  let updated = false;
  let failed = false;
  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const startedAt = now();
      const current = (await deps.repo.findById(input.userId, brief.id)) ?? brief;
      const { lines, conversationId } = await deps.sources.transcript(input.userId, {
        ideaId: input.ideaId,
        conversationId: input.conversationId ?? current.lastConversationId,
        rebuild: Boolean(input.rebuild),
      });
      const memories = await deps.sources.memories(input.userId, input.ideaId);
      const result = await deps.synthesizer.updateContext({
        idea,
        existing: current.version > 0 ? { data: current.data, version: current.version, userFields: current.userFields } : null,
        conversation: lines,
        memories,
        rebuild: input.rebuild,
      });
      const guarded = applyBriefGuards({
        previous: current.data,
        proposed: result.data,
        removed: result.removed,
        transcript: lines,
        memories,
        userFields: current.userFields,
        userEditedAt: current.userEditedAt,
        rebuild: input.rebuild,
      });
      if (guarded.dropped.length > 0 || guarded.restored.length > 0) {
        logEvent("brief_guarded", {
          userId: input.userId,
          ideaId: input.ideaId,
          dropped: guarded.dropped.length,
          restored: guarded.restored.length,
        });
      }

      const declined = !result.changed && !input.rebuild && current.version > 0;
      const unchanged = isEmptyBrief(guarded.data) || declined || sameBrief(guarded.data, current.data);
      if (unchanged) {
        await deps.repo.clearStale(input.userId, brief.id, startedAt);
      } else {
        const saved = await deps.repo.saveVersion({
          userId: input.userId,
          briefId: brief.id,
          expectedVersion: current.version,
          data: guarded.data,
          title: idea.title,
          userFields: guarded.userFields,
          source: input.rebuild ? "regenerate" : "synthesis",
          changeSummary: result.changeSummary || describeChange(current.data, guarded.data),
          conversationId,
          clearStaleBefore: startedAt,
        });
        // A user edit landed first; the next round builds on top of it.
        if (!saved) continue;
        updated = true;
        brief = saved;
        const events = briefEvents(current.data, guarded.data).filter((event) => !input.skipEvents?.includes(event.kind));
        if (events.length > 0) {
          await deps.sources.recordEvents({ userId: input.userId, ideaId: input.ideaId, conversationId, events });
        }
      }

      const latest = await deps.repo.findById(input.userId, brief.id);
      if (latest) brief = latest;
      if (input.rebuild || !latest?.staleSince) break;
    }
  } catch (error) {
    failed = true;
    logEvent("brief_synthesis_failed", {
      userId: input.userId,
      ideaId: input.ideaId,
      message: error instanceof Error ? error.message : "failed",
    });
  } finally {
    await deps.repo.release(input.userId, brief.id).catch(() => undefined);
  }

  const latest = (await deps.repo.findById(input.userId, brief.id).catch(() => null)) ?? brief;
  return { status: updated ? "updated" : failed ? "failed" : "unchanged", brief: latest };
}

export async function editBrief(
  deps: Pick<BriefDeps, "repo" | "sources" | "now">,
  input: { userId: string; ideaId: string; baseVersion: number; data: unknown },
): Promise<{ status: "saved" | "unchanged" | "conflict" | "missing"; brief: BriefRecord | null }> {
  const now = deps.now ?? (() => new Date());
  const idea = await deps.sources.idea(input.userId, input.ideaId);
  if (!idea) return { status: "missing", brief: null };
  const brief = await deps.repo.ensure(input.userId, input.ideaId, idea.title);
  if (brief.version !== input.baseVersion) return { status: "conflict", brief };
  const data = normalizeBrief(input.data);
  if (sameBrief(data, brief.data)) return { status: "unchanged", brief };
  const changed = changedFields(brief.data, data);
  const saved = await deps.repo.saveVersion({
    userId: input.userId,
    briefId: brief.id,
    expectedVersion: brief.version,
    data,
    title: idea.title,
    userFields: [...new Set([...brief.userFields, ...changed])],
    userEditedAt: now(),
    source: "edit",
    changeSummary: editSummary(changed),
    conversationId: null,
  });
  if (!saved) return { status: "conflict", brief: await deps.repo.findById(input.userId, brief.id) };
  const events = briefEvents(brief.data, data);
  if (events.length > 0) {
    await deps.sources.recordEvents({ userId: input.userId, ideaId: input.ideaId, conversationId: null, events });
  }
  return { status: "saved", brief: saved };
}

export function isSynthesizing(brief: Pick<BriefRecord, "synthesizingAt">, now = new Date()) {
  return Boolean(brief.synthesizingAt && now.getTime() - brief.synthesizingAt.getTime() < SYNTHESIS_LOCK_MS);
}

export function toBriefSnapshot(brief: BriefRecord): BriefSnapshot {
  return {
    id: brief.id,
    ideaId: brief.ideaId,
    title: brief.title,
    version: brief.version,
    data: brief.data,
    userFields: brief.userFields,
    changeSummary: brief.changeSummary,
    updatedAt: brief.updatedAt.toISOString(),
  };
}

export function toVersionSnapshot(version: BriefVersionRecord): BriefVersionSnapshot {
  return {
    version: version.version,
    source: version.source as BriefVersionSnapshot["source"],
    changeSummary: version.changeSummary,
    data: version.data,
    createdAt: version.createdAt.toISOString(),
  };
}
