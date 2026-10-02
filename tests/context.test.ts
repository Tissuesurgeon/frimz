import { describe, expect, it } from "vitest";
import { buildFrimzContext } from "@/server/agent/context-builder";
import { buildBehaviorAddendum } from "@/server/agent/response-strategy";
import type { MemoryRecord } from "@/server/memory/types";

const preference: MemoryRecord = {
  id: "pref",
  userId: "11111111-1111-1111-1111-111111111111",
  blobId: "b1",
  namespace: "frimz-user-11111111-1111-1111-1111-111111111111",
  type: "user_preference",
  status: "active",
  content: "User prefers 3-5 alternatives rather than one recommendation.",
  reason: "",
  importance: 0.8,
  ideaId: null,
  ideaTitle: "",
  supersedesId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const decision: MemoryRecord = {
  ...preference,
  id: "dec",
  type: "decision",
  content: "User wants to target individual students first.",
  ideaTitle: "Study partner",
};

describe("context and adaptation", () => {
  it("includes an earlier active memory in a later context", () => {
    const context = buildFrimzContext({
      preferences: [preference],
      memories: [preference, decision],
      ideaTitle: "Study partner",
      transcript: [],
      userMessage: "Let's continue the study partner idea.",
    });
    expect(context).toContain("WORKING STYLE");
    expect(context).toContain("DECISIONS");
    expect(context).toContain("User prefers 3-5 alternatives");
    expect(context).toContain("User wants to target individual students first.");
    expect(context).toContain("Let's continue the study partner idea.");
    expect(context).toContain("Do not quote them back as memories.");
  });

  it("changes the behavior addendum when a preference asks for alternatives", () => {
    const addendum = buildBehaviorAddendum("think", [preference]);
    expect(addendum).toContain("several approaches");
    expect(buildBehaviorAddendum("plan", [])).toContain("neutral");
    expect(addendum).toContain("do not decide");
  });
});
