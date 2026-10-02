export const MEMORY_TYPES = [
  "user_preference",
  "idea",
  "decision",
  "rejection",
  "insight",
  "open_question",
  "idea_change",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = ["active", "superseded", "forgotten"] as const;

export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const IDEA_STATUSES = ["exploring", "developing", "active", "paused", "abandoned"] as const;

export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export type MemoryRecord = {
  id: string;
  userId: string;
  blobId: string;
  namespace: string;
  type: MemoryType;
  status: MemoryStatus;
  content: string;
  reason: string;
  importance: number;
  ideaId: string | null;
  ideaTitle: string;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
  distance?: number;
};

export type MemoryDraft = {
  type: MemoryType;
  content: string;
  reason: string;
  importance: number;
  ideaTitle: string;
  supersedes: string;
  changesIdea: boolean;
};

export type MemoryQuery = {
  userId: string;
  query: string;
  limit?: number;
};

export type MemoryUpdate = {
  content?: string;
  reason?: string;
  type?: MemoryType;
  ideaTitle?: string;
};

export interface MemoryStore {
  create(userId: string, memory: MemoryDraft): Promise<MemoryRecord>;
  search(query: MemoryQuery): Promise<MemoryRecord[]>;
  update(userId: string, id: string, update: MemoryUpdate): Promise<MemoryRecord>;
  delete(userId: string, id: string): Promise<void>;
  list(userId: string): Promise<MemoryRecord[]>;
  get(userId: string, id: string): Promise<MemoryRecord | null>;
}
