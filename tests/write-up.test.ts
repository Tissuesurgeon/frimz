import { describe, expect, it, vi } from "vitest";
import { matchWriteUpFormat, writeUpFormat } from "@/lib/write-up";
import { WRITE_UP_PROMPT } from "@/server/agent/prompts/write-up";
import { messageForAnalysis, toTranscriptLines, type StoredMessage } from "@/server/context/transcript";
import { LLMWriteUpGenerator, buildWriteUpMessages, planWriteUp, type WriteUpInput } from "@/server/context/write-up";
import type { LLMChunk, LLMProvider, LLMRequest } from "@/server/llm/llm-provider";
import type { MemoryRecord } from "@/server/memory/types";

const offer: StoredMessage = {
  role: "assistant",
  content: "You landed on individual students first. Would a project brief or a proposal help?",
  metadata: { draftOffer: { briefVersion: 3 } },
};

const draft: StoredMessage = {
  role: "assistant",
  content: "# Study partner proposal\n\n## Summary\nA study partner for individual students.",
  metadata: { writeUp: { format: "proposal", briefVersion: 3 } },
};

const plain: StoredMessage = { role: "assistant", content: "That keeps the feedback loop short." };

function memory(partial: Pick<MemoryRecord, "id" | "type" | "content"> & Partial<MemoryRecord>): MemoryRecord {
  return {
    userId: "user-a",
    blobId: partial.id,
    namespace: "frimz-user-user-a",
    status: "active",
    reason: "",
    importance: 0.8,
    ideaId: "idea-a",
    ideaTitle: "Study partner",
    supersedesId: null,
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...partial,
  };
}

describe("write-up routing", () => {
  it("takes up an offer when the user says yes or names a format", () => {
    expect(planWriteUp({ message: "Yes please", previous: offer })).toEqual({ kind: "accept", format: null });
    expect(planWriteUp({ message: "Sure, a proposal would help", previous: offer })).toMatchObject({
      kind: "accept",
      format: { id: "proposal" },
    });
    expect(planWriteUp({ message: "A one-pager for investors", previous: offer })).toMatchObject({
      kind: "accept",
      format: { id: "project_brief" },
    });
    expect(planWriteUp({ message: "Could you put it in a doc for my cofounder", previous: offer })).toMatchObject({
      kind: "accept",
      format: null,
    });
  });

  it("lets the user decline or move on from an offer", () => {
    expect(planWriteUp({ message: "No thanks", previous: offer })).toBeNull();
    expect(planWriteUp({ message: "Not now, maybe later", previous: offer })).toBeNull();
    expect(planWriteUp({ message: "What about pricing though?", previous: offer })).toBeNull();
  });

  it("writes on request at any point", () => {
    expect(planWriteUp({ message: "Can you write this up as a proposal?", previous: plain })).toMatchObject({
      kind: "request",
      format: { id: "proposal" },
    });
    expect(planWriteUp({ message: "Draft a project brief for this", previous: null })).toMatchObject({
      kind: "request",
      format: { id: "project_brief" },
    });
    expect(planWriteUp({ message: "Turn our thinking into a strategy document", previous: null })).toMatchObject({
      kind: "request",
      format: { id: "strategy_document" },
    });
  });

  it("leaves ordinary messages to the conversation", () => {
    expect(planWriteUp({ message: "I want to write better essays", previous: plain })).toBeNull();
    expect(planWriteUp({ message: "Make it shorter", previous: plain })).toBeNull();
    expect(planWriteUp({ message: "Let's go with students first", previous: null })).toBeNull();
  });

  it("revises the draft just above when asked", () => {
    expect(planWriteUp({ message: "Make it shorter and more formal", previous: draft })).toEqual({
      kind: "revise",
      format: writeUpFormat("proposal"),
      previousDraft: draft.content,
    });
    expect(planWriteUp({ message: "Add a section on risks", previous: draft })?.kind).toBe("revise");
    expect(planWriteUp({ message: "Can we go back to pricing?", previous: draft })).toBeNull();
  });

  it("matches the formats Frimz knows", () => {
    expect(matchWriteUpFormat("a technical spec")?.id).toBe("technical_concept");
    expect(matchWriteUpFormat("a quick recap")?.id).toBe("thinking_summary");
    expect(matchWriteUpFormat("a problem statement")?.id).toBe("problem_statement");
    expect(matchWriteUpFormat("something nice")).toBeNull();
    expect(writeUpFormat("unknown").id).toBe("custom");
  });
});

describe("write-up generation", () => {
  const input: WriteUpInput = {
    plan: { kind: "accept", format: writeUpFormat("project_brief") },
    request: "Yes please",
    ideaTitle: "Study partner",
    brief: {
      version: 3,
      data: {
        problem: "Students lose the thread between sessions",
        decisions: [{ text: "Start with individual students", reason: "Faster feedback" }],
        openQuestions: ["How much of the last session should come back?"],
      },
      userFields: ["problem"],
    },
    memories: [
      memory({ id: "m1", type: "insight", content: "Short sessions work best." }),
      memory({ id: "m2", type: "decision", content: "Charge schools per seat.", status: "forgotten" }),
      memory({ id: "m3", type: "user_preference", content: "Prefers short answers." }),
    ],
    transcript: [
      { role: "user", content: "Students lose the thread between sessions." },
      { role: "assistant", content: "Frimz could not reply.", metadata: { error: true } },
      draft,
      offer,
    ],
  };

  it("builds the draft from the brief, active memories, and the conversation", () => {
    const [system, prompt] = buildWriteUpMessages(input);
    expect(system).toEqual({ role: "system", content: WRITE_UP_PROMPT });
    expect(system.content).toMatch(/Invent no names, numbers/);
    expect(prompt.content).toContain("Format: Project brief.");
    expect(prompt.content).toContain(`The user's words: "Yes please"`);
    expect(prompt.content).toContain("CURRENT CONTEXT BRIEF (version 3)");
    expect(prompt.content).toContain("PROBLEM (corrected by the user)");
    expect(prompt.content).toContain("MEMORIES FOR STUDY PARTNER\n- [insight] Short sessions work best.");
    expect(prompt.content).not.toContain("Charge schools per seat.");
    expect(prompt.content).not.toContain("Prefers short answers.");
    expect(prompt.content).toContain("USER: Students lose the thread between sessions.");
    expect(prompt.content).not.toContain("Frimz could not reply.");
    expect(prompt.content).toContain("FRIMZ: [Frimz drafted a proposal from the current thinking.]");
    expect(prompt.content).not.toContain("PREVIOUS DRAFT");
  });

  it("works without a brief and carries the previous draft into a revision", () => {
    const [, prompt] = buildWriteUpMessages({
      ...input,
      brief: null,
      plan: { kind: "revise", format: null, previousDraft: draft.content },
      request: "Make it shorter",
    });
    expect(prompt.content).toContain("None yet. Rely on the conversation and the memories.");
    expect(prompt.content).toContain("Format: keep the format of the previous draft.");
    expect(prompt.content).toContain(`PREVIOUS DRAFT\n${draft.content}`);
  });

  it("streams through the model provider", async () => {
    const requests: LLMRequest[] = [];
    const provider: LLMProvider = {
      generate: vi.fn(),
      stream(request) {
        requests.push(request);
        return (async function* (): AsyncGenerator<LLMChunk> {
          yield { text: "# Study partner" };
          yield { text: "\n\nA brief." };
        })();
      },
    };
    const controller = new AbortController();
    let text = "";
    for await (const chunk of new LLMWriteUpGenerator(provider).stream(input, controller.signal)) text += chunk.text;
    expect(text).toBe("# Study partner\n\nA brief.");
    expect(requests).toHaveLength(1);
    expect(requests[0].signal).toBe(controller.signal);
    expect(requests[0].messages).toEqual(buildWriteUpMessages(input));
  });
});

describe("analysis transcript", () => {
  it("collapses drafts so they never feed memories or the brief", () => {
    expect(messageForAnalysis(draft)).toBe("[Frimz drafted a proposal from the current thinking.]");
    expect(messageForAnalysis({ role: "user", content: "Write this up", metadata: { writeUp: { format: "proposal", briefVersion: 1 } } })).toBe(
      "Write this up",
    );
    const lines = toTranscriptLines(
      [
        { role: "user", content: "One", createdAt: "2026-10-01T09:00:00.000Z" },
        { role: "assistant", content: "Failed", metadata: { error: true } },
        { role: "system", content: "Hidden" },
        draft,
      ],
      30,
    );
    expect(lines).toEqual([
      { role: "user", content: "One", createdAt: "2026-10-01T09:00:00.000Z" },
      { role: "assistant", content: "[Frimz drafted a proposal from the current thinking.]", createdAt: undefined },
    ]);
  });
});
