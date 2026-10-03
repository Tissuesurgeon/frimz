import { describe, expect, it, vi } from "vitest";
import type { ContextBriefData } from "@/lib/context-brief";
import type { TranscriptLine } from "@/server/context/brief-guards";
import type {
  BriefRecord,
  BriefRepository,
  BriefVersionRecord,
  SaveVersionInput,
} from "@/server/context/brief-repository";
import {
  SYNTHESIS_LOCK_MS,
  briefEvents,
  describeChange,
  editBrief,
  isSynthesizing,
  synthesizeBrief,
  type BriefDeps,
} from "@/server/context/brief-service";
import type { ContextSynthesizer, SynthesisInput, SynthesisResult } from "@/server/context/context-synthesizer";

const USER_A = "user-a";
const USER_B = "user-b";
const IDEA_A = "idea-a";

/** Mirrors the user scoping, lock, version check, and stale cutoff of the Postgres repository. */
class InMemoryBriefRepository implements BriefRepository {
  briefs = new Map<string, BriefRecord>();
  versions: BriefVersionRecord[] = [];
  private seq = 0;

  constructor(private readonly clock: () => Date) {}

  private owned(userId: string, briefId: string) {
    const brief = this.briefs.get(briefId);
    return brief && brief.userId === userId ? brief : null;
  }

  async findByIdea(userId: string, ideaId: string) {
    const brief = [...this.briefs.values()].find((item) => item.userId === userId && item.ideaId === ideaId);
    return brief ? structuredClone(brief) : null;
  }

  async findById(userId: string, briefId: string) {
    const brief = this.owned(userId, briefId);
    return brief ? structuredClone(brief) : null;
  }

  async listForUser(userId: string) {
    return [...this.briefs.values()].filter((item) => item.userId === userId && item.version > 0).map((item) => structuredClone(item));
  }

  async ensure(userId: string, ideaId: string, title: string) {
    if (![...this.briefs.values()].some((item) => item.ideaId === ideaId)) {
      const id = `brief-${++this.seq}`;
      const at = this.clock();
      this.briefs.set(id, {
        id,
        userId,
        ideaId,
        title,
        version: 0,
        data: {},
        changeSummary: "",
        userFields: [],
        userEditedAt: null,
        lastConversationId: null,
        staleSince: null,
        synthesizingAt: null,
        createdAt: at,
        updatedAt: at,
      });
    }
    const brief = await this.findByIdea(userId, ideaId);
    if (!brief) throw new Error("The brief could not be created.");
    return brief;
  }

  async markStale(userId: string, briefId: string, at: Date) {
    const brief = this.owned(userId, briefId);
    if (brief) brief.staleSince = at;
  }

  async clearStale(userId: string, briefId: string, before: Date) {
    const brief = this.owned(userId, briefId);
    if (brief?.staleSince && brief.staleSince.getTime() <= before.getTime()) brief.staleSince = null;
  }

  async acquire(userId: string, briefId: string, now: Date, ttlMs: number) {
    const brief = this.owned(userId, briefId);
    if (!brief) return null;
    if (brief.synthesizingAt && brief.synthesizingAt.getTime() >= now.getTime() - ttlMs) return null;
    brief.synthesizingAt = now;
    return structuredClone(brief);
  }

  async release(userId: string, briefId: string) {
    const brief = this.owned(userId, briefId);
    if (brief) brief.synthesizingAt = null;
  }

  async saveVersion(input: SaveVersionInput) {
    const brief = this.owned(input.userId, input.briefId);
    if (!brief || brief.version !== input.expectedVersion) return null;
    const version = input.expectedVersion + 1;
    Object.assign(brief, {
      version,
      data: structuredClone(input.data),
      title: input.title,
      changeSummary: input.changeSummary,
      userFields: [...input.userFields],
      updatedAt: this.clock(),
    });
    if (input.userEditedAt !== undefined) brief.userEditedAt = input.userEditedAt;
    if (input.conversationId) brief.lastConversationId = input.conversationId;
    if (input.clearStaleBefore && brief.staleSince && brief.staleSince.getTime() <= input.clearStaleBefore.getTime()) {
      brief.staleSince = null;
    }
    this.versions.push({
      id: `version-${this.versions.length + 1}`,
      briefId: input.briefId,
      userId: input.userId,
      version,
      source: input.source,
      changeSummary: input.changeSummary,
      data: structuredClone(input.data),
      conversationId: input.conversationId,
      createdAt: this.clock(),
    });
    return structuredClone(brief);
  }

  async listVersions(userId: string, briefId: string) {
    return this.versions
      .filter((item) => item.userId === userId && item.briefId === briefId)
      .sort((a, b) => b.version - a.version);
  }
}

const conversation: TranscriptLine[] = [
  { role: "user", content: "Students lose the thread between study sessions.", createdAt: "2026-10-01T09:00:00.000Z" },
  { role: "assistant", content: "So the gap is between sessions, more than inside one." },
  {
    role: "user",
    content: "Right. I've decided to start with individual students because the feedback loop is faster.",
    createdAt: "2026-10-01T09:01:00.000Z",
  },
];

const first: ContextBriefData = {
  context: "A study partner that keeps the thread between sessions for individual students.",
  problem: "Students lose the thread between study sessions",
  decisions: [{ text: "Start with individual students", reason: "The feedback loop is faster" }],
};

function result(data: ContextBriefData, extra: Partial<SynthesisResult> = {}): SynthesisResult {
  return { changed: true, changeSummary: "", data, removed: [], ...extra };
}

function setup(options: { lines?: TranscriptLine[] } = {}) {
  let tick = Date.parse("2026-10-01T12:00:00.000Z");
  const clock = () => new Date((tick += 1000));
  const repo = new InMemoryBriefRepository(clock);
  const recordEvents = vi.fn(async () => undefined);
  const updateContext = vi.fn(async (input: SynthesisInput): Promise<SynthesisResult> => {
    void input;
    return result(first);
  });
  const synthesizer: ContextSynthesizer = { updateContext };
  const ideas = new Map([[IDEA_A, { userId: USER_A, title: "Study partner", description: "" }]]);
  const deps: BriefDeps = {
    repo,
    synthesizer,
    now: clock,
    sources: {
      async idea(userId, ideaId) {
        const idea = ideas.get(ideaId);
        return idea && idea.userId === userId ? { id: ideaId, title: idea.title, description: idea.description } : null;
      },
      async transcript() {
        return { lines: options.lines ?? conversation, conversationId: "conversation-a" };
      },
      async memories() {
        return [];
      },
      recordEvents,
    },
  };
  return { repo, deps, clock, updateContext, recordEvents };
}

async function staleBrief(env: ReturnType<typeof setup>) {
  const brief = await env.repo.ensure(USER_A, IDEA_A, "Study partner");
  await env.repo.markStale(USER_A, brief.id, env.clock());
  return brief;
}

const run = (deps: BriefDeps, extra: { rebuild?: boolean; skipEvents?: string[] } = {}) =>
  synthesizeBrief(deps, { userId: USER_A, ideaId: IDEA_A, conversationId: "conversation-a", ...extra });

describe("brief service", () => {
  it("creates the first version from meaningful progress", async () => {
    const env = setup();
    await staleBrief(env);
    const outcome = await run(env.deps);
    expect(outcome.status).toBe("updated");
    expect(outcome.brief).toMatchObject({ version: 1, data: first, changeSummary: "First picture of the idea" });
    expect(outcome.brief?.staleSince).toBeNull();
    expect(outcome.brief?.synthesizingAt).toBeNull();
    expect(outcome.brief?.lastConversationId).toBe("conversation-a");
    expect(env.repo.versions).toHaveLength(1);
    expect(env.repo.versions[0]).toMatchObject({ version: 1, source: "synthesis", conversationId: "conversation-a" });
    expect(env.updateContext.mock.calls[0][0].existing).toBeNull();
  });

  it("leaves the brief alone when nothing moved", async () => {
    const env = setup();
    await env.repo.ensure(USER_A, IDEA_A, "Study partner");
    const outcome = await run(env.deps);
    expect(outcome.status).toBe("unchanged");
    expect(env.updateContext).not.toHaveBeenCalled();
  });

  it("keeps the version when synthesis finds nothing new", async () => {
    const env = setup();
    await staleBrief(env);
    await run(env.deps);
    await env.repo.markStale(USER_A, "brief-1", env.clock());
    env.updateContext.mockResolvedValueOnce(result(first, { changed: false }));
    const outcome = await run(env.deps);
    expect(outcome.status).toBe("unchanged");
    expect(outcome.brief?.version).toBe(1);
    expect(outcome.brief?.staleSince).toBeNull();
    expect(env.repo.versions).toHaveLength(1);
  });

  it("passes the current brief and the user's corrections to the next update", async () => {
    const env = setup();
    await staleBrief(env);
    await run(env.deps);
    await editBrief(env.deps, {
      userId: USER_A,
      ideaId: IDEA_A,
      baseVersion: 1,
      data: { ...first, problem: "Students lose the thread between sessions" },
    });
    await env.repo.markStale(USER_A, "brief-1", env.clock());
    await run(env.deps);
    expect(env.updateContext.mock.calls[1][0].existing).toEqual({
      version: 2,
      data: { ...first, problem: "Students lose the thread between sessions" },
      userFields: ["problem"],
    });
  });

  it("tells a second update to wait while one is running", async () => {
    const env = setup();
    const brief = await staleBrief(env);
    await env.repo.acquire(USER_A, brief.id, env.clock(), SYNTHESIS_LOCK_MS);
    const outcome = await run(env.deps);
    expect(outcome.status).toBe("busy");
    expect(env.updateContext).not.toHaveBeenCalled();
    expect(isSynthesizing(outcome.brief!, env.clock())).toBe(true);
  });

  it("takes over a lock abandoned for more than three minutes", async () => {
    const env = setup();
    const brief = await staleBrief(env);
    await env.repo.acquire(USER_A, brief.id, new Date(env.clock().getTime() - SYNTHESIS_LOCK_MS - 1000), SYNTHESIS_LOCK_MS);
    const outcome = await run(env.deps);
    expect(outcome.status).toBe("updated");
  });

  it("covers progress that lands while synthesis is running", async () => {
    const env = setup();
    const brief = await staleBrief(env);
    env.updateContext.mockImplementationOnce(async () => {
      await env.repo.markStale(USER_A, brief.id, env.clock());
      return result(first);
    });
    env.updateContext.mockImplementationOnce(async () =>
      result({ ...first, openQuestions: ["How much of the last session should come back?"] }),
    );
    const outcome = await run(env.deps);
    expect(env.updateContext).toHaveBeenCalledTimes(2);
    expect(outcome.brief?.version).toBe(2);
    expect(outcome.brief?.data.openQuestions).toEqual(["How much of the last session should come back?"]);
    expect(outcome.brief?.staleSince).toBeNull();
  });

  it("stops after three rounds and leaves the rest for the next turn", async () => {
    const env = setup();
    const brief = await staleBrief(env);
    let round = 0;
    env.updateContext.mockImplementation(async () => {
      round += 1;
      await env.repo.markStale(USER_A, brief.id, env.clock());
      return result({ ...first, keyInsights: [`Students study in short bursts ${round}`] });
    });
    const outcome = await run(env.deps);
    expect(env.updateContext).toHaveBeenCalledTimes(3);
    expect(outcome.status).toBe("updated");
    expect(outcome.brief?.staleSince).not.toBeNull();
    expect(outcome.brief?.synthesizingAt).toBeNull();
  });

  it("builds on a user edit that lands mid-synthesis", async () => {
    const env = setup();
    const brief = await staleBrief(env);
    await run(env.deps);
    await env.repo.markStale(USER_A, brief.id, env.clock());
    const corrected = "Students lose the thread between study sessions and give up";
    env.updateContext.mockImplementationOnce(async () => {
      await editBrief(env.deps, { userId: USER_A, ideaId: IDEA_A, baseVersion: 1, data: { ...first, problem: corrected } });
      return result({ ...first, goal: "Students keep the thread between study sessions" });
    });
    env.updateContext.mockImplementationOnce(async (input) =>
      result({ ...input.existing!.data, problem: "Students lose the thread", goal: "Students keep the thread between study sessions" }),
    );
    const outcome = await run(env.deps);
    expect(env.updateContext).toHaveBeenCalledTimes(3);
    expect(env.updateContext.mock.calls[2][0].existing).toMatchObject({ version: 2, userFields: ["problem"] });
    expect(outcome.brief?.version).toBe(3);
    expect(outcome.brief?.data.problem).toBe(corrected);
    expect(outcome.brief?.data.goal).toBe("Students keep the thread between study sessions");
    expect(outcome.brief?.userFields).toEqual(["problem"]);
    expect(env.repo.versions.map((item) => item.source)).toEqual(["synthesis", "edit", "synthesis"]);
  });

  it("keeps the previous version and frees the lock when synthesis fails", async () => {
    const env = setup();
    const brief = await staleBrief(env);
    await run(env.deps);
    await env.repo.markStale(USER_A, brief.id, env.clock());
    env.updateContext.mockRejectedValueOnce(new Error("The synthesis reply was not valid JSON."));
    const outcome = await run(env.deps);
    expect(outcome.status).toBe("failed");
    expect(outcome.brief?.version).toBe(1);
    expect(outcome.brief?.data).toEqual(first);
    expect(outcome.brief?.synthesizingAt).toBeNull();
    expect(outcome.brief?.staleSince).not.toBeNull();
  });

  it("records timeline events for a new direction unless the turn already did", async () => {
    const env = setup({
      lines: [...conversation, { role: "user", content: "Actually, let's start with tutors instead.", createdAt: "2026-10-01T09:05:00.000Z" }],
    });
    const brief = await staleBrief(env);
    env.updateContext.mockResolvedValueOnce(result({ ...first, currentDirection: "Start with tutors" }));
    await run(env.deps, { skipEvents: ["direction"] });
    expect(env.recordEvents).toHaveBeenCalledWith(
      expect.objectContaining({ events: [{ kind: "problem", summary: first.problem }] }),
    );

    await env.repo.markStale(USER_A, brief.id, env.clock());
    env.updateContext.mockResolvedValueOnce(result({ ...first, currentDirection: "Start with tutors in one school" }));
    await run(env.deps);
    expect(env.recordEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ events: [{ kind: "direction", summary: "Start with tutors in one school" }] }),
    );
  });

  it("regenerates on request and labels the version", async () => {
    const env = setup();
    await staleBrief(env);
    await run(env.deps);
    env.updateContext.mockResolvedValueOnce(result({ context: first.context, problem: first.problem }, { changed: false }));
    const outcome = await run(env.deps, { rebuild: true });
    expect(outcome.status).toBe("updated");
    expect(outcome.brief?.version).toBe(2);
    expect(outcome.brief?.data.decisions).toBeUndefined();
    expect(env.repo.versions.at(-1)?.source).toBe("regenerate");
    expect(env.updateContext.mock.calls.at(-1)?.[0].rebuild).toBe(true);
  });

  it("saves an edit as a version the user owns", async () => {
    const env = setup();
    await staleBrief(env);
    await run(env.deps);
    const saved = await editBrief(env.deps, {
      userId: USER_A,
      ideaId: IDEA_A,
      baseVersion: 1,
      data: { ...first, targetUser: "University students in their first year" },
    });
    expect(saved.status).toBe("saved");
    expect(saved.brief).toMatchObject({ version: 2, userFields: ["targetUser"], changeSummary: "You corrected target user" });
    expect(saved.brief?.userEditedAt).toBeInstanceOf(Date);
    expect(env.repo.versions.at(-1)).toMatchObject({ source: "edit", conversationId: null });
    expect(env.recordEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ events: [{ kind: "target_user", summary: "University students in their first year" }] }),
    );

    const same = await editBrief(env.deps, { userId: USER_A, ideaId: IDEA_A, baseVersion: 2, data: saved.brief!.data });
    expect(same.status).toBe("unchanged");
  });

  it("refuses an edit made against an older version", async () => {
    const env = setup();
    await staleBrief(env);
    await run(env.deps);
    const outcome = await editBrief(env.deps, { userId: USER_A, ideaId: IDEA_A, baseVersion: 0, data: { problem: "Older" } });
    expect(outcome.status).toBe("conflict");
    expect(outcome.brief?.version).toBe(1);
    expect(outcome.brief?.data).toEqual(first);
  });

  it("keeps one user's brief out of another user's reach", async () => {
    const env = setup();
    const brief = await staleBrief(env);
    await run(env.deps);

    const synthesis = await synthesizeBrief(env.deps, { userId: USER_B, ideaId: IDEA_A, conversationId: null, rebuild: true });
    expect(synthesis).toEqual({ status: "skipped", brief: null });
    const edit = await editBrief(env.deps, { userId: USER_B, ideaId: IDEA_A, baseVersion: 1, data: { problem: "Taken over" } });
    expect(edit).toEqual({ status: "missing", brief: null });
    expect(await env.repo.findById(USER_B, brief.id)).toBeNull();
    expect(await env.repo.listForUser(USER_B)).toEqual([]);
    expect(await env.repo.listVersions(USER_B, brief.id)).toEqual([]);
    expect((await env.repo.findById(USER_A, brief.id))?.data).toEqual(first);
  });

  it("describes changes for the version list and the timeline", () => {
    expect(describeChange({}, first)).toBe("First picture of the idea");
    expect(describeChange(first, { ...first, goal: "Keep the thread", openQuestions: ["Who pays?"] })).toBe(
      "Updated goal and open questions",
    );
    expect(briefEvents(first, { ...first, problem: "Students lose the thread between their study sessions" })).toEqual([]);
    expect(briefEvents(first, { ...first, targetUser: "First-year students" })).toEqual([
      { kind: "target_user", summary: "First-year students" },
    ]);
  });
});
