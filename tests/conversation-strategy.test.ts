import { describe, expect, it } from "vitest";
import { chooseConversationStrategy } from "@/server/agent/conversational-strategy";
import { renderConversationStrategy } from "@/server/agent/prompts/conversation-strategy";
import type { MemoryRecord } from "@/server/memory/types";

function memory(partial: Pick<MemoryRecord, "id" | "type" | "content">): MemoryRecord {
  return {
    userId: "user",
    blobId: partial.id,
    namespace: "frimz-user-user",
    status: "active",
    reason: "",
    importance: 0.8,
    ideaId: null,
    ideaTitle: "Study partner",
    supersedesId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const decision = memory({
  id: "dec",
  type: "decision",
  content: "The first version targets individual students.",
});

const preference = memory({
  id: "pref",
  type: "user_preference",
  content: "User prefers simple initial products and fast validation.",
});

function turn(userMessage: string, memories: MemoryRecord[] = []) {
  return chooseConversationStrategy({ mode: "think", userMessage, memories, preferences: memories.filter((item) => item.type === "user_preference") });
}

describe("conversation strategy", () => {
  it("explores a vague idea instead of judging it", () => {
    const result = turn("I have an idea but I'm not sure if it's good.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/not judge/i);
  });

  it("helps when the direction is unknown", () => {
    const result = turn("I don't know what direction to take.");
    expect(["explore", "compare"]).toContain(result.conversationalMove);
    expect(result.reasoningFocus).toMatch(/do not pick/i);
  });

  it("examines a proposed direction", () => {
    const result = turn("I think we should do X.");
    expect(result.conversationalMove).toBe("challenge");
    expect(result.reasoningFocus).toMatch(/do not decide/i);
  });

  it("recognizes a decision", () => {
    const result = turn("Let's go with X.");
    expect(result.conversationalMove).toBe("confirm");
    expect(result.shouldAskQuestion).toBe(false);
    expect(result.reasoningFocus).toMatch(/do not reopen/i);
  });

  it("treats a reversal as the current direction", () => {
    const result = turn("Actually, let's do Y instead.", [decision]);
    expect(result.conversationalMove).toBe("confirm");
    expect(result.shouldUseMemory).toBe(true);
    expect(result.relevantMemoryIds).toContain(decision.id);
    expect(result.reasoningFocus).toMatch(/current/);
    expect(result.reasoningFocus).toMatch(/earlier direction/);
  });

  it("reconstructs history when asked why", () => {
    const result = turn("Why did we originally choose X?", [decision]);
    expect(result.conversationalMove).toBe("reflect");
    expect(result.shouldUseMemory).toBe(true);
    expect(result.relevantMemoryIds).toContain(decision.id);
    expect(renderConversationStrategy(result)).toMatch(/Do not invent/);
  });

  it("says the history is missing when nothing was stored", () => {
    const result = turn("Why did we originally choose X?");
    expect(result.conversationalMove).toBe("reflect");
    expect(result.shouldUseMemory).toBe(false);
    expect(result.reasoningFocus).toMatch(/do not have it/i);
  });

  it("contributes a perspective without deciding", () => {
    const result = turn("What do you think?");
    expect(result.conversationalMove).toBe("explore");
    expect(result.shouldAskQuestion).toBe(false);
    expect(result.reasoningFocus).toMatch(/user decides/i);
  });

  it("drafts when asked to write", () => {
    const result = turn("Just write the proposal.");
    expect(result.intent).toBe("writing");
    expect(result.conversationalMove).toBe("draft");
    expect(result.shouldAskQuestion).toBe(false);
  });

  it("synthesizes frustration instead of asking again", () => {
    const result = turn("I'm frustrated. We're going in circles.");
    expect(result.conversationalMove).toBe("synthesize");
    expect(result.shouldAskQuestion).toBe(false);
  });

  it("compares options when asked what to do", () => {
    const result = turn("What should I do?");
    expect(result.conversationalMove).toBe("compare");
    expect(result.reasoningFocus).toMatch(/do not choose/i);
  });

  it("answers a factual question even in challenge mode", () => {
    const result = chooseConversationStrategy({ mode: "challenge", userMessage: "What does MVP mean?" });
    expect(result.conversationalMove).toBe("answer");
    expect(result.shouldAskQuestion).toBe(false);
  });

  it("connects a conflicting preference without announcing it", () => {
    const result = turn("I'm thinking we should launch with 15 features.", [preference]);
    expect(result.conversationalMove).toBe("connect");
    expect(result.shouldUseMemory).toBe(true);
    expect(result.relevantMemoryIds).toContain(preference.id);
    expect(result.reasoningFocus).toMatch(/do not cite/i);
  });
});
