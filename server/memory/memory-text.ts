import type { MemoryDraft, MemoryType } from "./types";

export type StoredMemoryText = {
  type: MemoryType;
  importance: number;
  status: string;
  idea: string;
  content: string;
  reason: string;
};

export function encodeMemoryText(memory: MemoryDraft) {
  return JSON.stringify({
    type: memory.type,
    importance: memory.importance,
    status: "active",
    idea: memory.ideaTitle,
    content: memory.content,
    reason: memory.reason,
  });
}

export function decodeMemoryText(text: string): StoredMemoryText | null {
  try {
    const value = JSON.parse(text) as Partial<StoredMemoryText>;
    if (!value || typeof value.content !== "string" || typeof value.type !== "string") return null;
    return {
      type: value.type as MemoryType,
      importance: typeof value.importance === "number" ? value.importance : 0.5,
      status: typeof value.status === "string" ? value.status : "active",
      idea: typeof value.idea === "string" ? value.idea : "",
      content: value.content,
      reason: typeof value.reason === "string" ? value.reason : "",
    };
  } catch {
    return null;
  }
}
