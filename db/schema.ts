import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { BriefField, ContextBriefData } from "@/lib/context-brief";

export type IndicatorType = "remembered" | "connected";

export type MessageMetadata = {
  memoryUsed?: boolean;
  indicators?: { type: IndicatorType; memoryId: string }[];
  error?: boolean;
  draftOffer?: { briefVersion: number };
  writeUp?: { format: string; briefVersion: number };
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("exploring"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ideas_user_idx").on(table.userId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    currentIdeaId: uuid("current_idea_id").references(() => ideas.id, { onDelete: "set null" }),
    contextCheckedMessageId: uuid("context_checked_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("conversations_user_idx").on(table.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<MessageMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId)],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  theme: text("theme").notNull().default("system"),
});

export const memoryIndex = pgTable(
  "memory_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blobId: text("blob_id").notNull(),
    namespace: text("namespace").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("active"),
    content: text("content").notNull(),
    reason: text("reason").notNull().default(""),
    importance: real("importance").notNull().default(0.5),
    ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "set null" }),
    ideaTitle: text("idea_title").notNull().default(""),
    supersedesId: uuid("supersedes_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("memory_index_user_idx").on(table.userId),
    uniqueIndex("memory_index_user_blob_idx").on(table.userId, table.blobId),
  ],
);

export const ideaEvents = pgTable(
  "idea_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    memoryId: uuid("memory_id").references(() => memoryIndex.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idea_events_idea_idx").on(table.ideaId)],
);

export const memoryActivity = pgTable(
  "memory_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    memoryId: uuid("memory_id").references(() => memoryIndex.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    event: text("event").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("memory_activity_user_idx").on(table.userId)],
);

export const contextBriefs = pgTable(
  "context_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    version: integer("version").notNull().default(0),
    data: jsonb("data").$type<ContextBriefData>().notNull().default({}),
    changeSummary: text("change_summary").notNull().default(""),
    userFields: jsonb("user_fields").$type<BriefField[]>().notNull().default([]),
    userEditedAt: timestamp("user_edited_at", { withTimezone: true }),
    lastConversationId: uuid("last_conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    staleSince: timestamp("stale_since", { withTimezone: true }),
    synthesizingAt: timestamp("synthesizing_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("context_briefs_idea_idx").on(table.ideaId),
    index("context_briefs_user_idx").on(table.userId),
  ],
);

export const contextBriefVersions = pgTable(
  "context_brief_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    briefId: uuid("brief_id")
      .notNull()
      .references(() => contextBriefs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: text("source").notNull(),
    changeSummary: text("change_summary").notNull().default(""),
    data: jsonb("data").$type<ContextBriefData>().notNull(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("context_brief_versions_brief_version_idx").on(table.briefId, table.version)],
);

export const appLogs = pgTable(
  "app_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id"),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("app_logs_user_idx").on(table.userId)],
);
