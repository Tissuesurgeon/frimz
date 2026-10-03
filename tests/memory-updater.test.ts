import { describe, expect, it } from "vitest";
import { isMeaningfulProgress, planMemoryWrite } from "@/server/memory/memory-updater";
import type { MemoryDraft, MemoryRecord } from "@/server/memory/types";

const existing: MemoryRecord = {
  id: "old",
  userId: "11111111-1111-1111-1111-111111111111",
  blobId: "blob",
  namespace: "frimz-user-11111111-1111-1111-1111-111111111111",
  type: "decision",
  status: "active",
  content: "User wants to target universities.",
  reason: "",
  importance: 0.8,
  ideaId: null,
  ideaTitle: "Study partner",
  supersedesId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("memory supersede", () => {
  it("supersedes a conflicting decision", () => {
    const plan = planMemoryWrite([existing], {
      type: "decision",
      content: "User wants to target individual students first.",
      reason: "Faster feedback.",
      importance: 0.9,
      ideaTitle: "Study partner",
      supersedes: "target universities",
      changesIdea: false,
    });
    expect(plan).toEqual({ action: "create", supersedeId: "old" });
  });

  it("supersedes a conflicting preference", () => {
    const preference: MemoryRecord = { ...existing, id: "pref", type: "user_preference", content: "User wants one recommendation." };
    const plan = planMemoryWrite([preference], {
      type: "user_preference",
      content: "User prefers 3-5 alternatives rather than one recommendation.",
      reason: "",
      importance: 0.8,
      ideaTitle: "",
      supersedes: "one recommendation",
      changesIdea: false,
    });
    expect(plan).toEqual({ action: "create", supersedeId: "pref" });
  });

  it("counts a turn as progress for the brief only when it moves the thinking", () => {
    const draft = (partial: Partial<MemoryDraft>): MemoryDraft => ({
      type: "decision",
      content: "User wants to target individual students first.",
      reason: "",
      importance: 0.8,
      ideaTitle: "Study partner",
      supersedes: "",
      changesIdea: false,
      ...partial,
    });
    expect(isMeaningfulProgress([existing], [draft({})], false)).toBe(true);
    expect(isMeaningfulProgress([existing], [draft({ type: "open_question", content: "Who pays for it?" })], false)).toBe(true);
    expect(isMeaningfulProgress([existing], [draft({ content: "User wants to target universities." })], false)).toBe(false);
    expect(isMeaningfulProgress([existing], [draft({ type: "user_preference", content: "User prefers short answers." })], false)).toBe(
      false,
    );
    expect(isMeaningfulProgress([existing], [], false)).toBe(false);
    expect(isMeaningfulProgress([existing], [], true)).toBe(true);
  });

  it("skips duplicates", () => {
    const plan = planMemoryWrite([existing], {
      type: "decision",
      content: "User wants to target universities.",
      reason: "",
      importance: 0.8,
      ideaTitle: "Study partner",
      supersedes: "",
      changesIdea: false,
    });
    expect(plan).toEqual({ action: "skip", reason: "duplicate" });
  });
});
