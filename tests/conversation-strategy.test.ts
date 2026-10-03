import { describe, expect, it } from "vitest";
import { chooseConversationStrategy } from "@/server/agent/conversational-strategy";
import { buildFrimzContext } from "@/server/agent/context-builder";
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
  it("creates space when the idea is not on the table yet", () => {
    const result = turn("Help me explore an idea I'm working on. I don't have the idea yet.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.shouldAskQuestion).toBe(false);
    expect(result.reasoningFocus).toMatch(/Create space/i);
    expect(result.reasoningFocus).toMatch(/exact idea/i);
  });

  it("explores a vague idea instead of judging it", () => {
    const result = turn("I have an idea but I'm not sure if it's good.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/Create space|Do not force problem/i);
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

  it("closes warmly when the user wraps up", () => {
    const result = turn("Thanks, that's all for now.");
    expect(result.conversationalMove).toBe("summarize");
    expect(result.shouldAskQuestion).toBe(false);
    expect(result.offersDraft).toBeUndefined();
    expect(turn("I know what to build now.").conversationalMove).toBe("summarize");
    expect(turn("This was really helpful, I'll start building.").conversationalMove).toBe("summarize");
  });

  it("offers a draft once when the wrap-up meets substantial thinking", () => {
    const result = chooseConversationStrategy({
      mode: "challenge",
      userMessage: "Thanks, I have what I need.",
      memories: [decision],
      offerDraft: true,
    });
    expect(result.offersDraft).toBe(true);
    expect(result.conversationalMove).toBe("summarize");
    expect(result.shouldAskQuestion).toBe(true);
    expect(result.reasoningFocus).toMatch(/ask once/i);
    expect(result.reasoningFocus).toContain("Project brief");
  });

  it("keeps talking when a thank-you opens a new thread", () => {
    for (const message of ["Thanks! Now what about pricing?", "Thanks, but I'm not sure about the pricing", "Thanks. Next, let's look at onboarding"]) {
      const result = chooseConversationStrategy({ mode: "think", userMessage: message, offerDraft: true });
      expect(result.conversationalMove).not.toBe("summarize");
      expect(result.offersDraft).toBeUndefined();
    }
  });

  it("connects a conflicting preference without announcing it", () => {
    const result = turn("I'm thinking we should launch with 15 features.", [preference]);
    expect(result.conversationalMove).toBe("connect");
    expect(result.shouldUseMemory).toBe(true);
    expect(result.relevantMemoryIds).toContain(preference.id);
    expect(result.reasoningFocus).toMatch(/do not cite/i);
  });

  it("compares when asked to compare", () => {
    const result = turn("Compare the two ideas.");
    expect(result.conversationalMove).toBe("compare");
    expect(result.reasoningFocus).toMatch(/do not choose/i);
  });

  it("challenges when asked to challenge", () => {
    const result = turn("Challenge this idea.");
    expect(result.conversationalMove).toBe("challenge");
    expect(result.reasoningFocus).toMatch(/do not decide/i);
  });

  it("offers directions when asked for ideas", () => {
    const result = turn("Give me ideas for what we could build on top of this.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/do not pick/i);
  });

  it("synthesizes when they are lost", () => {
    const result = turn("I'm getting lost. What have we actually figured out?");
    expect(result.conversationalMove).toBe("synthesize");
    expect(result.shouldAskQuestion).toBe(false);
  });

  it("recalls a decision from stored history", () => {
    const result = turn("What did we decide about the target market?", [decision]);
    expect(result.conversationalMove).toBe("reflect");
    expect(result.shouldUseMemory).toBe(true);
    expect(result.relevantMemoryIds).toContain(decision.id);
  });

  it("adapts when they disagree", () => {
    const result = turn("I disagree. I actually think the other way is important.", [decision]);
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/do not defend/i);
  });

  it("recognizes let's start with as their decision", () => {
    const result = turn("Let's start with individual students.");
    expect(result.conversationalMove).toBe("confirm");
    expect(result.reasoningFocus).toMatch(/do not reopen/i);
  });

  it("plans when they say the idea is ready", () => {
    const result = turn("I think we've got the idea. Let's make a plan.");
    expect(result.conversationalMove).toBe("plan");
    expect(result.reasoningFocus).toMatch(/do not lock/i);
  });

  it("drafts a brief or a readme without a question tour", () => {
    expect(turn("Turn everything we've discussed into a project brief.").conversationalMove).toBe("draft");
    const readme = turn("Write the README now.");
    expect(readme.conversationalMove).toBe("draft");
    expect(readme.shouldAskQuestion).toBe(false);
  });

  it("stays broad when they are uncertain", () => {
    const result = turn("I don't really know. I just feel like there should be something there.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.shouldAskQuestion).toBe(false);
    expect(result.reasoningFocus).toMatch(/Stay broad/i);
    expect(result.reasoningFocus).toMatch(/Do not force problem/i);
  });

  it("synthesizes when they weigh options aloud", () => {
    const result = turn("Maybe students. Although universities might be better. Actually, I'm not sure.");
    expect(result.conversationalMove).toBe("synthesize");
    expect(result.shouldAskQuestion).toBe(false);
    expect(result.reasoningFocus).toMatch(/Do not force a choice/i);
  });

  it("does not workshop an early interest in a space", () => {
    const result = turn("I've been thinking about building something for university students, but I don't really know what yet.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/startup workshop/i);
  });

  it("switches topic without dragging the old one back", () => {
    const result = turn("Actually I'm tired of thinking about education. Let's work on a crypto idea instead.", [decision]);
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/Do not force the previous topic/i);
  });

  it("follows a focus branch within the same idea", () => {
    const result = turn("Let's continue the idea, but don't talk about product features. I want to understand the business opportunity.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/branch they chose/i);
  });

  it("returns to an earlier idea with memory", () => {
    const result = turn("Let's go back to the education idea.", [decision]);
    expect(result.conversationalMove).toBe("reflect");
    expect(result.shouldUseMemory).toBe(true);
    expect(result.reasoningFocus).toMatch(/Do not assume they still agree/i);
  });

  it("treats a boundary as a rejection constraint", () => {
    const result = turn("No, I don't want this to become another generic AI tutor.");
    expect(result.conversationalMove).toBe("confirm");
    expect(result.reasoningFocus).toMatch(/rejected direction/i);
  });

  it("develops a conceptual reframe", () => {
    const result = turn("Maybe the problem isn't that students forget things. Maybe it's that they don't know what to study next.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.reasoningFocus).toMatch(/conceptual shift/i);
  });

  it("accepts a mind change and asks what shifted", () => {
    const result = turn("I've changed my mind. I think universities should be the initial target.", [decision]);
    expect(result.conversationalMove).toBe("confirm");
    expect(result.shouldAskQuestion).toBe(true);
    expect(result.reasoningFocus).toMatch(/Do not reject the new choice/i);
  });

  it("plans when they want to build", () => {
    const result = turn("Okay, enough thinking. Let's build it.");
    expect(result.conversationalMove).toBe("plan");
  });

  it("does not steer from prior context on a fresh start", () => {
    const message = "Forget everything about this idea. I want to start from zero.";
    const result = turn(message, [decision]);
    expect(result.freshStart).toBe(true);
    expect(result.shouldUseMemory).toBe(false);
    const context = buildFrimzContext({
      preferences: [],
      memories: [decision],
      ideaTitle: "Study partner",
      brief: {
        version: 2,
        data: { problem: "Students lose the thread", decisions: [{ text: "Start with students" }] },
        userFields: [],
      },
      transcript: [],
      userMessage: message,
      strategy: result,
    });
    expect(context).not.toContain("CURRENT CONTEXT BRIEF");
    expect(context).not.toContain("Start with students");
    expect(context).not.toContain(decision.content);
    expect(context).toContain("None identified yet.");
  });
});
