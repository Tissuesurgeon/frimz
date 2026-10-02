import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memoryIndex } from "@/db/schema";
import type { MemoryRecord, MemoryStatus, MemoryType } from "./types";
import type { MemoryIndex } from "./walrus/walrus-memory-store";

function toRecord(row: typeof memoryIndex.$inferSelect): MemoryRecord {
  return {
    id: row.id,
    userId: row.userId,
    blobId: row.blobId,
    namespace: row.namespace,
    type: row.type as MemoryType,
    status: row.status as MemoryStatus,
    content: row.content,
    reason: row.reason,
    importance: row.importance,
    ideaId: row.ideaId,
    ideaTitle: row.ideaTitle,
    supersedesId: row.supersedesId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PostgresMemoryIndex implements MemoryIndex {
  async insert(row: MemoryRecord) {
    const db = getDb();
    const [created] = await db
      .insert(memoryIndex)
      .values({
        id: row.id,
        userId: row.userId,
        blobId: row.blobId,
        namespace: row.namespace,
        type: row.type,
        status: row.status,
        content: row.content,
        reason: row.reason,
        importance: row.importance,
        ideaId: row.ideaId,
        ideaTitle: row.ideaTitle,
        supersedesId: row.supersedesId,
      })
      .returning();
    return toRecord(created);
  }

  async list(userId: string) {
    const rows = await getDb()
      .select()
      .from(memoryIndex)
      .where(eq(memoryIndex.userId, userId))
      .orderBy(desc(memoryIndex.createdAt));
    return rows.map(toRecord);
  }

  async listActive(userId: string) {
    const rows = await getDb()
      .select()
      .from(memoryIndex)
      .where(and(eq(memoryIndex.userId, userId), eq(memoryIndex.status, "active")))
      .orderBy(desc(memoryIndex.createdAt));
    return rows.map(toRecord);
  }

  async get(userId: string, id: string) {
    const [row] = await getDb()
      .select()
      .from(memoryIndex)
      .where(and(eq(memoryIndex.userId, userId), eq(memoryIndex.id, id)))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async markStatus(userId: string, id: string, status: MemoryStatus) {
    await getDb()
      .update(memoryIndex)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(memoryIndex.userId, userId), eq(memoryIndex.id, id)));
  }

  async linkSupersedes(userId: string, id: string, supersedesId: string) {
    await getDb()
      .update(memoryIndex)
      .set({ supersedesId, updatedAt: new Date() })
      .where(and(eq(memoryIndex.userId, userId), eq(memoryIndex.id, id)));
  }
}
