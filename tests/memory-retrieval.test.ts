import { describe, expect, it } from "vitest";
import { filterRecalledMemories, mergePreferences, rankMemories } from "@/server/memory/memory-retrieval";
import type { MemoryRecord } from "@/server/memory/types";

function row(partial: Partial<MemoryRecord> & Pick<MemoryRecord, "id" | "userId" | "content" | "type">): MemoryRecord {
  return {
    blobId: partial.id,
    namespace: `frimz-user-${partial.userId}`,
    status: "active",
    reason: "",
    importance: 0.5,
    ideaId: null,
    ideaTitle: "",
    supersedesId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("memory retrieval", () => {
  it("drops forgotten, superseded, weak, and other users' memories", () => {
    const userA = "11111111-1111-1111-1111-111111111111";
    const userB = "22222222-2222-2222-2222-222222222222";
    const index = [
      row({ id: "a1", userId: userA, blobId: "blob-a", type: "decision", content: "Target students" }),
      row({ id: "gone", userId: userA, blobId: "blob-gone", type: "decision", content: "Old", status: "forgotten" }),
      row({ id: "old", userId: userA, blobId: "blob-old", type: "decision", content: "Superseded", status: "superseded" }),
      row({ id: "b1", userId: userB, blobId: "blob-b", type: "decision", content: "Other user" }),
    ];
    const kept = filterRecalledMemories(
      [
        { blobId: "blob-a", distance: 0.2, text: "Target students" },
        { blobId: "blob-gone", distance: 0.1, text: "Old" },
        { blobId: "blob-old", distance: 0.1, text: "Superseded" },
        { blobId: "blob-b", distance: 0.1, text: "Other user" },
        { blobId: "blob-weak", distance: 0.9, text: "Weak" },
      ],
      index,
      userA,
    );
    expect(kept.map((memory) => memory.id)).toEqual(["a1"]);
  });

  it("ranks preferences and the current idea first", () => {
    const user = "11111111-1111-1111-1111-111111111111";
    const ranked = rankMemories(
      [
        row({ id: "1", userId: user, type: "insight", content: "Other", ideaTitle: "Other", importance: 0.9, distance: 0.1 }),
        row({ id: "2", userId: user, type: "user_preference", content: "Prefers alternatives", importance: 0.4, distance: 0.4 }),
        row({ id: "3", userId: user, type: "decision", content: "Current", ideaTitle: "Study partner", importance: 0.6, distance: 0.3 }),
      ],
      "Study partner",
    );
    expect(ranked.map((memory) => memory.id)).toEqual(["2", "3", "1"]);
  });

  it("merges stored preferences that semantic recall missed", () => {
    const user = "11111111-1111-1111-1111-111111111111";
    const preference = row({ id: "p", userId: user, type: "user_preference", content: "Prefers concise replies" });
    const merged = mergePreferences([], [preference]);
    expect(merged).toHaveLength(1);
  });
});
