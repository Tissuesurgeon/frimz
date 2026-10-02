import { IDEA_STATUSES, MEMORY_TYPES, type IdeaStatus, type MemoryDraft, type MemoryType } from "./types";

const MIN_IMPORTANCE = 0.45;
const MIN_LENGTH = 12;

const EPHEMERAL = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)[.!]?$/i;
const INJECTION = /ignore (all|previous|prior) instructions/i;

export type RawMemory = {
  type?: unknown;
  content?: unknown;
  reason?: unknown;
  importance?: unknown;
  ideaTitle?: unknown;
  supersedes?: unknown;
  changesIdea?: unknown;
};

export type RawIdea = {
  title?: unknown;
  description?: unknown;
  status?: unknown;
};

export type ExtractionDraft = {
  memories: RawMemory[];
  idea?: RawIdea;
};

export function parseExtraction(text: string): ExtractionDraft {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const value = JSON.parse(trimmed) as { memories?: unknown; idea?: unknown };
    const memories = Array.isArray(value.memories) ? (value.memories.filter(isRecord) as RawMemory[]) : [];
    const idea = isRecord(value.idea) ? value.idea : undefined;
    return { memories, idea };
  } catch {
    return { memories: [] };
  }
}

export function validateMemories(draft: ExtractionDraft): MemoryDraft[] {
  const accepted: MemoryDraft[] = [];
  for (const raw of draft.memories) {
    const memory = validateMemory(raw);
    if (memory) accepted.push(memory);
  }
  return accepted;
}

export function validateMemory(raw: RawMemory): MemoryDraft | null {
  if (!isMemoryType(raw.type)) return null;
  if (typeof raw.content !== "string") return null;
  const content = raw.content.trim();
  if (content.length < MIN_LENGTH || content.length > 2000) return null;
  if (EPHEMERAL.test(content) || INJECTION.test(content)) return null;
  const importance = typeof raw.importance === "number" ? raw.importance : 0.55;
  if (importance < MIN_IMPORTANCE || importance > 1) return null;
  const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, 1000) : "";
  const ideaTitle = typeof raw.ideaTitle === "string" ? raw.ideaTitle.trim().slice(0, 160) : "";
  const supersedes = typeof raw.supersedes === "string" ? raw.supersedes.trim().slice(0, 500) : "";
  return {
    type: raw.type,
    content,
    reason,
    importance,
    ideaTitle,
    supersedes,
    changesIdea: raw.changesIdea === true,
  };
}

export function validateIdea(raw: RawIdea | undefined): { title: string; description: string; status: IdeaStatus } | null {
  if (!raw || typeof raw.title !== "string") return null;
  const title = raw.title.trim();
  if (title.length < 3 || title.length > 160) return null;
  const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 2000) : "";
  const status = isIdeaStatus(raw.status) ? raw.status : "exploring";
  return { title, description, status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMemoryType(value: unknown): value is MemoryType {
  return typeof value === "string" && (MEMORY_TYPES as readonly string[]).includes(value);
}

function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === "string" && (IDEA_STATUSES as readonly string[]).includes(value);
}
