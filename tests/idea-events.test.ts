import { describe, expect, it } from "vitest";
import { shouldCreateIdeaEvent } from "@/server/ideas/idea-events";

describe("idea events", () => {
  it("records a decision and an idea change, and skips preferences", () => {
    expect(shouldCreateIdeaEvent({ type: "decision", ideaTitle: "Study partner", changesIdea: false })).toBe(true);
    expect(shouldCreateIdeaEvent({ type: "idea_change", ideaTitle: "Study partner", changesIdea: false })).toBe(true);
    expect(shouldCreateIdeaEvent({ type: "user_preference", ideaTitle: "Study partner", changesIdea: false })).toBe(false);
    expect(shouldCreateIdeaEvent({ type: "insight", ideaTitle: "Study partner", changesIdea: false })).toBe(false);
    expect(shouldCreateIdeaEvent({ type: "insight", ideaTitle: "Study partner", changesIdea: true })).toBe(true);
    expect(shouldCreateIdeaEvent({ type: "decision", ideaTitle: "", changesIdea: false })).toBe(false);
  });
});
