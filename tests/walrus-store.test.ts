import { describe, expect, it } from "vitest";
import { namespaceForUser } from "@/server/memory/namespace";
import { WalrusMemoryStore, type MemoryIndex, type WalrusClient } from "@/server/memory/walrus/walrus-memory-store";
import type { MemoryRecord } from "@/server/memory/types";

const userA = "11111111-1111-1111-1111-111111111111";
const userB = "22222222-2222-2222-2222-222222222222";

function memoryIndex(rows: MemoryRecord[]): MemoryIndex {
  return {
    async insert(row) {
      rows.push(row);
      return row;
    },
    async list(userId) {
      return rows.filter((row) => row.userId === userId);
    },
    async listActive(userId) {
      return rows.filter((row) => row.userId === userId && row.status === "active");
    },
    async get(userId, id) {
      return rows.find((row) => row.userId === userId && row.id === id) ?? null;
    },
    async markStatus(userId, id, status) {
      const row = rows.find((item) => item.userId === userId && item.id === id);
      if (row) row.status = status;
    },
    async linkSupersedes(userId, id, supersedesId) {
      const row = rows.find((item) => item.userId === userId && item.id === id);
      if (row) row.supersedesId = supersedesId;
    },
  };
}

describe("walrus adapter", () => {
  it("writes and searches only inside the caller's namespace", async () => {
    const calls: string[] = [];
    const client: WalrusClient = {
      async rememberAndWait(text, namespace) {
        calls.push(namespace);
        return { blob_id: `blob-${calls.length}` };
      },
      async recall(params) {
        calls.push(params.namespace ?? "");
        return {
          results: [
            { blob_id: "blob-1", text: "kept", distance: 0.1 },
            { blob_id: "blob-other", text: "other", distance: 0.1 },
          ],
        };
      },
    };
    const rows: MemoryRecord[] = [];
    const store = new WalrusMemoryStore(client, memoryIndex(rows));
    await store.create(userA, {
      type: "decision",
      content: "Target individual students first.",
      reason: "Feedback",
      importance: 0.9,
      ideaTitle: "Study partner",
      supersedes: "",
      changesIdea: false,
    });
    rows.push({
      ...rows[0],
      id: "other",
      userId: userB,
      blobId: "blob-other",
      content: "Secret",
    });
    const found = await store.search({ userId: userA, query: "students" });
    expect(calls.every((namespace) => namespace === namespaceForUser(userA))).toBe(true);
    expect(found.map((memory) => memory.userId)).toEqual([userA]);
    expect(namespaceForUser(userA)).not.toBe(namespaceForUser(userB));
  });
});
