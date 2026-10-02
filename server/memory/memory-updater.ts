import type { MemoryDraft, MemoryRecord } from "./types";

export function normalizeMemoryText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export type WritePlan =
  | { action: "skip"; reason: "duplicate" }
  | { action: "create"; supersedeId?: string };

export function planMemoryWrite(existing: MemoryRecord[], incoming: MemoryDraft): WritePlan {
  const content = normalizeMemoryText(incoming.content);
  const duplicate = existing.find(
    (memory) =>
      memory.status === "active" &&
      memory.type === incoming.type &&
      normalizeMemoryText(memory.content) === content,
  );
  if (duplicate) return { action: "skip", reason: "duplicate" };

  let supersedeId: string | undefined;
  if (incoming.supersedes) {
    const needle = normalizeMemoryText(incoming.supersedes);
    const previous = existing.find(
      (memory) => memory.status === "active" && normalizeMemoryText(memory.content).includes(needle),
    );
    if (previous && previous.id) supersedeId = previous.id;
  }

  return { action: "create", supersedeId };
}
