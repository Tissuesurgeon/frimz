import type { MemoryDraft, MemoryRecord, MemoryStore, MemoryUpdate } from "../types";
import { encodeMemoryText } from "../memory-text";
import { namespaceForUser } from "../namespace";
import { filterRecalledMemories, rankMemories } from "../memory-retrieval";

export type WalrusHit = {
  blob_id: string;
  text: string;
  distance: number;
};

export interface WalrusClient {
  rememberAndWait(text: string, namespace: string): Promise<{ blob_id: string }>;
  recall(params: {
    query: string;
    limit?: number;
    namespace?: string;
    maxDistance?: number;
  }): Promise<{ results: WalrusHit[] }>;
}

export interface MemoryIndex {
  insert(row: Omit<MemoryRecord, "distance">): Promise<MemoryRecord>;
  list(userId: string): Promise<MemoryRecord[]>;
  listActive(userId: string): Promise<MemoryRecord[]>;
  get(userId: string, id: string): Promise<MemoryRecord | null>;
  markStatus(userId: string, id: string, status: MemoryRecord["status"]): Promise<void>;
  linkSupersedes(userId: string, id: string, supersedesId: string): Promise<void>;
}

export class WalrusMemoryStore implements MemoryStore {
  constructor(
    private readonly client: WalrusClient,
    private readonly index: MemoryIndex,
  ) {}

  async create(userId: string, memory: MemoryDraft) {
    const namespace = namespaceForUser(userId);
    const stored = await this.client.rememberAndWait(encodeMemoryText(memory), namespace);
    const now = new Date().toISOString();
    return this.index.insert({
      id: crypto.randomUUID(),
      userId,
      blobId: stored.blob_id,
      namespace,
      type: memory.type,
      status: "active",
      content: memory.content,
      reason: memory.reason,
      importance: memory.importance,
      ideaId: null,
      ideaTitle: memory.ideaTitle,
      supersedesId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async search(query: { userId: string; query: string; limit?: number }) {
    const namespace = namespaceForUser(query.userId);
    const recalled = await this.client.recall({
      query: query.query,
      limit: query.limit ?? 8,
      namespace,
      maxDistance: 0.6,
    });
    const rows = await this.index.list(query.userId);
    return rankMemories(
      filterRecalledMemories(
        recalled.results.map((hit) => ({
          blobId: hit.blob_id,
          distance: hit.distance,
          text: hit.text,
        })),
        rows,
        query.userId,
      ),
    );
  }

  async update(userId: string, id: string, update: MemoryUpdate) {
    const current = await this.get(userId, id);
    if (!current || current.status === "forgotten") {
      throw new Error("Memory not found");
    }
    const created = await this.create(userId, {
      type: update.type ?? current.type,
      content: update.content ?? current.content,
      reason: update.reason ?? current.reason,
      importance: current.importance,
      ideaTitle: update.ideaTitle ?? current.ideaTitle,
      supersedes: current.content,
      changesIdea: false,
    });
    await this.index.markStatus(userId, current.id, "superseded");
    await this.index.linkSupersedes(userId, created.id, current.id);
    return { ...created, supersedesId: current.id };
  }

  async delete(userId: string, id: string) {
    const current = await this.get(userId, id);
    if (!current) throw new Error("Memory not found");
    await this.index.markStatus(userId, id, "forgotten");
  }

  list(userId: string) {
    return this.index.list(userId);
  }

  get(userId: string, id: string) {
    return this.index.get(userId, id);
  }
}
