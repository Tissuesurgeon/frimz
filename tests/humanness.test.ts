import { describe, expect, it } from "vitest";
import { chooseConversationStrategy } from "@/server/agent/conversational-strategy";
import { renderConversationStrategy } from "@/server/agent/prompts/conversation-strategy";
import { HUMAN_CONVERSATION_POLICY } from "@/server/agent/prompts/human-conversation";
import { orchestrationViolations } from "@/server/agent/response-check";

function turn(userMessage: string) {
  return chooseConversationStrategy({ mode: "think", userMessage });
}

describe("humanness", () => {
  it("keeps uncertainty to a short okay", () => {
    const result = turn("I don't really know.");
    expect(result.responseDepth).toBe("short");
    expect(result.shouldStructure).toBe(false);
    expect(result.reasoningFocus).toMatch(/short okay/i);
    expect(result.reasoningFocus).toMatch(/do not break their uncertainty/i);
  });

  it("reacts to excitement with one question", () => {
    const result = turn("Wait, I think I just figured it out.");
    expect(result.conversationalMove).toBe("ask");
    expect(result.responseDepth).toBe("short");
    expect(result.questionCount).toBe(1);
    expect(result.shouldStructure).toBe(false);
    expect(result.reasoningFocus).toMatch(/what they figured out/i);
  });

  it("stops forcing an idea they hate", () => {
    const result = turn("This idea sucks.");
    expect(result.responseDepth).toBe("short");
    expect(result.shouldStructure).toBe(false);
    expect(result.questionCount).toBe(1);
    expect(result.reasoningFocus).toMatch(/stop forcing/i);
    expect(result.reasoningFocus).toMatch(/do not comfort/i);
  });

  it("asks what it is missing when they say that is not right", () => {
    const result = turn("No, I don't think that's right.");
    expect(result.questionCount).toBe(1);
    expect(result.responseDepth).toBe("short");
    expect(result.reasoningFocus).toMatch(/what you are missing/i);
    expect(renderConversationStrategy(result)).not.toMatch(/I understand your perspective/i);
  });

  it("gets a joke before analyzing it", () => {
    const result = turn("You know what would be funny?");
    expect(result.intent).toBe("casual");
    expect(result.responseDepth).toBe("short");
    expect(result.questionCount).toBe(0);
    expect(result.reasoningFocus).toMatch(/do not answer like a consultant/i);
  });

  it("engages a real distinction without a product spec", () => {
    const result = turn(
      "I think the actual problem isn't that students forget what they learned. It's that they don't know what they should be learning next.",
    );
    expect(result.conversationalMove).toBe("explore");
    expect(result.shouldStructure).toBe(false);
    expect(result.responseDepth).toBe("normal");
    expect(result.reasoningFocus).toMatch(/do not turn it into a product specification/i);
  });

  it("bans assistant phrasing in the policy and the checker", () => {
    expect(HUMAN_CONVERSATION_POLICY).toMatch(/let's unpack/i);
    expect(HUMAN_CONVERSATION_POLICY).toMatch(/great point/i);
    const strategy = turn("I don't really know.");
    expect(orchestrationViolations("That's a valuable insight. Let's unpack that. Absolutely.", strategy)).toContain(
      "assistant_tell",
    );
  });
});
