import { and, desc, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contextBriefVersions, contextBriefs } from "@/db/schema";
import type { BriefField, ContextBriefData } from "@/lib/context-brief";

export type BriefSource = "synthesis" | "edit" | "regenerate";
export type BriefRecord = typeof contextBriefs.$inferSelect;
export type BriefVersionRecord = typeof contextBriefVersions.$inferSelect;

export type SaveVersionInput = {
  userId: string;
  briefId: string;
  expectedVersion: number;
  data: ContextBriefData;
  title: string;
  userFields: BriefField[];
  /** Leave undefined to keep the current value. */
  userEditedAt?: Date | null;
  source: BriefSource;
  changeSummary: string;
  conversationId: string | null;
  /** Clears the stale mark only when nothing marked it again after this time. */
  clearStaleBefore?: Date;
};

export interface BriefRepository {
  findByIdea(userId: string, ideaId: string): Promise<BriefRecord | null>;
  findById(userId: string, briefId: string): Promise<BriefRecord | null>;
  listForUser(userId: string): Promise<BriefRecord[]>;
  ensure(userId: string, ideaId: string, title: string): Promise<BriefRecord>;
  markStale(userId: string, briefId: string, at: Date): Promise<void>;
  clearStale(userId: string, briefId: string, before: Date): Promise<void>;
  acquire(userId: string, briefId: string, now: Date, ttlMs: number): Promise<BriefRecord | null>;
  release(userId: string, briefId: string): Promise<void>;
  /** Returns null when the brief moved past `expectedVersion`. */
  saveVersion(input: SaveVersionInput): Promise<BriefRecord | null>;
  listVersions(userId: string, briefId: string): Promise<BriefVersionRecord[]>;
}

export class PostgresBriefRepository implements BriefRepository {
  async findByIdea(userId: string, ideaId: string) {
    const [row] = await getDb()
      .select()
      .from(contextBriefs)
      .where(and(eq(contextBriefs.userId, userId), eq(contextBriefs.ideaId, ideaId)))
      .limit(1);
    return row ?? null;
  }

  async findById(userId: string, briefId: string) {
    const [row] = await getDb()
      .select()
      .from(contextBriefs)
      .where(and(eq(contextBriefs.userId, userId), eq(contextBriefs.id, briefId)))
      .limit(1);
    return row ?? null;
  }

  async listForUser(userId: string) {
    return getDb()
      .select()
      .from(contextBriefs)
      .where(and(eq(contextBriefs.userId, userId), gt(contextBriefs.version, 0)))
      .orderBy(desc(contextBriefs.updatedAt));
  }

  async ensure(userId: string, ideaId: string, title: string) {
    await getDb().insert(contextBriefs).values({ userId, ideaId, title }).onConflictDoNothing({ target: contextBriefs.ideaId });
    const brief = await this.findByIdea(userId, ideaId);
    if (!brief) throw new Error("The brief could not be created.");
    return brief;
  }

  async markStale(userId: string, briefId: string, at: Date) {
    await getDb()
      .update(contextBriefs)
      .set({ staleSince: at })
      .where(and(eq(contextBriefs.userId, userId), eq(contextBriefs.id, briefId)));
  }

  async clearStale(userId: string, briefId: string, before: Date) {
    await getDb()
      .update(contextBriefs)
      .set({ staleSince: null })
      .where(and(eq(contextBriefs.userId, userId), eq(contextBriefs.id, briefId), lte(contextBriefs.staleSince, before)));
  }

  async acquire(userId: string, briefId: string, now: Date, ttlMs: number) {
    const expired = new Date(now.getTime() - ttlMs);
    const [row] = await getDb()
      .update(contextBriefs)
      .set({ synthesizingAt: now })
      .where(
        and(
          eq(contextBriefs.userId, userId),
          eq(contextBriefs.id, briefId),
          or(isNull(contextBriefs.synthesizingAt), lt(contextBriefs.synthesizingAt, expired)),
        ),
      )
      .returning();
    return row ?? null;
  }

  async release(userId: string, briefId: string) {
    await getDb()
      .update(contextBriefs)
      .set({ synthesizingAt: null })
      .where(and(eq(contextBriefs.userId, userId), eq(contextBriefs.id, briefId)));
  }

  async saveVersion(input: SaveVersionInput) {
    return getDb().transaction(async (tx) => {
      const version = input.expectedVersion + 1;
      const staleCutoff = input.clearStaleBefore?.toISOString();
      const [row] = await tx
        .update(contextBriefs)
        .set({
          version,
          data: input.data,
          title: input.title,
          changeSummary: input.changeSummary,
          userFields: input.userFields,
          updatedAt: new Date(),
          ...(input.userEditedAt !== undefined ? { userEditedAt: input.userEditedAt } : {}),
          ...(input.conversationId ? { lastConversationId: input.conversationId } : {}),
          ...(staleCutoff
            ? {
                staleSince: sql`case when ${contextBriefs.staleSince} <= ${staleCutoff}::timestamptz then null else ${contextBriefs.staleSince} end`,
              }
            : {}),
        })
        .where(
          and(
            eq(contextBriefs.userId, input.userId),
            eq(contextBriefs.id, input.briefId),
            eq(contextBriefs.version, input.expectedVersion),
          ),
        )
        .returning();
      if (!row) return null;
      await tx.insert(contextBriefVersions).values({
        briefId: input.briefId,
        userId: input.userId,
        version,
        source: input.source,
        changeSummary: input.changeSummary,
        data: input.data,
        conversationId: input.conversationId,
      });
      return row;
    });
  }

  async listVersions(userId: string, briefId: string) {
    return getDb()
      .select()
      .from(contextBriefVersions)
      .where(and(eq(contextBriefVersions.userId, userId), eq(contextBriefVersions.briefId, briefId)))
      .orderBy(desc(contextBriefVersions.version));
  }
}
