import { describe, expect, it } from "vitest";
import {
  changedFields,
  isDraftable,
  isEmptyBrief,
  normalizeBrief,
  renderBriefForPrompt,
  renderBriefMarkdown,
  sameBrief,
} from "@/lib/context-brief";

describe("context brief data", () => {
  it("keeps only filled sections and drops placeholders", () => {
    const data = normalizeBrief({
      problem: "  Students lose   the thread between study sessions. ",
      targetUser: "N/A",
      goal: "TBD",
      keyInsights: ["Short sessions work best", "none", "", "Short sessions work best!"],
      decisions: ["Start with individual students", { text: "Not specified" }],
      unknownField: "dropped",
    });
    expect(data).toEqual({
      problem: "Students lose the thread between study sessions.",
      keyInsights: ["Short sessions work best"],
      decisions: [{ text: "Start with individual students" }],
    });
  });

  it("keeps reasons on decisions and caps long lists", () => {
    const data = normalizeBrief({
      decisions: [{ text: "Start with individual students", reason: "The feedback loop is faster" }],
      nextAreasToExplore: ["a1", "b2", "c3", "d4", "e5", "f6", "g7"].map((item) => `Explore ${item}`),
    });
    expect(data.decisions).toEqual([{ text: "Start with individual students", reason: "The feedback loop is faster" }]);
    expect(data.nextAreasToExplore).toHaveLength(5);
  });

  it("treats malformed input as an empty brief", () => {
    expect(normalizeBrief(null)).toEqual({});
    expect(normalizeBrief(["problem"])).toEqual({});
    expect(isEmptyBrief(normalizeBrief({ problem: "  " }))).toBe(true);
  });

  it("reports which sections changed", () => {
    const before = normalizeBrief({ problem: "Students forget", openQuestions: ["How much should come back?"] });
    const after = normalizeBrief({ problem: "Students lose the thread", openQuestions: ["How much should come back?"] });
    expect(changedFields(before, after)).toEqual(["problem"]);
    expect(sameBrief(before, normalizeBrief(structuredClone(before)))).toBe(true);
  });

  it("is draftable only once the thinking has a subject, a direction, and substance", () => {
    const thin = normalizeBrief({ problem: "Students lose the thread", currentDirection: "Start with students" });
    expect(isDraftable(thin)).toBe(false);
    const settled = normalizeBrief({
      context: "A study partner for individual students.",
      problem: "Students lose the thread between sessions",
      decisions: [{ text: "Start with individual students" }],
      openQuestions: ["How much of the last session should come back?"],
    });
    expect(isDraftable(settled)).toBe(true);
    const directionless = normalizeBrief({
      context: "A study partner.",
      problem: "Students lose the thread",
      keyInsights: ["Short sessions work best"],
      openQuestions: ["Who pays?"],
    });
    expect(isDraftable(directionless)).toBe(false);
  });

  it("renders Markdown for copying and plain text for prompts", () => {
    const data = normalizeBrief({
      context: "A study partner that remembers the last session.",
      problem: "Students lose the thread between sessions",
      decisions: [{ text: "Start with individual students", reason: "Faster feedback" }],
    });
    const markdown = renderBriefMarkdown("Study partner", data);
    expect(markdown).toBe(
      [
        "# Study partner",
        "",
        "A study partner that remembers the last session.",
        "",
        "## Problem",
        "Students lose the thread between sessions",
        "",
        "## Decisions",
        "- Start with individual students Reason: Faster feedback",
      ].join("\n"),
    );
    const prompt = renderBriefForPrompt(data, ["problem"]);
    expect(prompt).toContain("PROBLEM (corrected by the user)");
    expect(prompt).toContain("DECISIONS\n- Start with individual students Reason: Faster feedback");
  });
});
