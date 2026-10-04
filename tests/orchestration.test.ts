import { describe, expect, it } from "vitest";
import { chooseConversationStrategy } from "@/server/agent/conversational-strategy";
import { orchestrationViolations } from "@/server/agent/response-check";
import { MEMORY_EXTRACTION_PROMPT } from "@/server/agent/prompts/memory-extraction";

function turn(userMessage: string) {
  return chooseConversationStrategy({ mode: "think", userMessage });
}

describe("conversation orchestration", () => {
  it("treats a vague student idea as high-uncertainty exploration", () => {
    const result = turn("I've been thinking about building something for university students, but I don't really know what yet.");
    expect(result.intent).toBe("exploration");
    expect(result.thinkingStage).toBe("discover");
    expect(result.uncertaintyLevel).toBe("high");
    expect(result.shouldStructure).toBe(false);
    expect(result.shouldChallenge).toBe(false);
    expect(result.questionCount).toBeLessThanOrEqual(1);
  });

  it("keeps an observation in exploration without a plan", () => {
    const result = turn("Students use AI a lot for studying, but every time they start a new conversation they have to explain what they're studying.");
    expect(result.conversationalMove).toBe("explore");
    expect(result.shouldStructure).toBe(false);
    expect(result.conversationalMove).not.toBe("plan");
  });

  it("challenges when asked, without a question stack", () => {
    const result = turn("Challenge this idea: the AI should remember everything about the student.");
    expect(result.intent).toBe("challenge");
    expect(result.shouldChallenge).toBe(true);
    expect(result.questionCount).toBe(0);
  });

  it("stops arguing when they disagree", () => {
    const result = turn("I disagree. I think remembering everything is important.");
    expect(result.reasoningFocus).toMatch(/do not defend/i);
    expect(result.shouldAskQuestion).toBe(false);
  });

  it("changes direction immediately", () => {
    const result = turn("Actually, I'm tired of thinking about education. Let's work on a crypto idea instead.");
    expect(result.intent).toBe("direction_change");
    expect(result.reasoningFocus).toMatch(/Do not force the previous topic/i);
  });

  it("honors an explicit exclusion", () => {
    const result = turn("Let's continue the education idea, but don't talk about product features. I want to understand the business opportunity.");
    expect(result.exclusions.join(" ")).toMatch(/product features/i);
    expect(result.userDirection).toMatch(/business opportunity/i);
  });

  it("answers a definition without exploring", () => {
    const result = turn("What does MVP mean?");
    expect(result.conversationalMove).toBe("answer");
    expect(result.responseDepth).toBe("short");
    expect(result.questionCount).toBe(0);
    expect(result.shouldStructure).toBe(false);
  });

  it("answers a technical choice directly", () => {
    const result = turn("Should we use PostgreSQL or MongoDB for this?");
    expect(result.conversationalMove).toBe("answer");
    expect(result.questionCount).toBe(0);
  });

  it("structures a brainstorm without choosing", () => {
    const result = turn("Give me some ideas for what we could build on top of persistent AI memory.");
    expect(result.shouldStructure).toBe(true);
    expect(result.responseDepth).toBe("deep");
    expect(result.reasoningFocus).toMatch(/do not pick/i);
  });

  it("synthesizes when they are lost", () => {
    const result = turn("I'm completely lost. Where are we?");
    expect(result.conversationalMove).toBe("synthesize");
    expect(result.shouldSynthesize).toBe(true);
    expect(result.questionCount).toBe(0);
  });

  it("drafts a readme without questions", () => {
    const result = turn("Write the README now.");
    expect(result.conversationalMove).toBe("draft");
    expect(result.questionCount).toBe(0);
  });

  it("asks once when the belief they dropped is ambiguous", () => {
    const result = turn("Actually, I don't believe that anymore.");
    expect(result.questionCount).toBe(1);
    expect(result.reasoningFocus).toMatch(/do not guess/i);
  });

  it("flags a framework reply during open exploration", () => {
    const strategy = turn("I've been thinking about building something for university students, but I don't really know what yet.");
    const violations = orchestrationViolations(
      "Let's identify the problem. Here are five categories. Who is your target persona? What year are they in?",
      strategy,
    );
    expect(violations).toContain("unwanted_framework");
    expect(violations).toContain("too_many_questions");
  });

  it("does not store a suggestion as a decision in the extraction rules", () => {
    expect(MEMORY_EXTRACTION_PROMPT).toMatch(/not a decision/i);
    expect(MEMORY_EXTRACTION_PROMPT).toMatch(/accepts it/i);
  });
});
