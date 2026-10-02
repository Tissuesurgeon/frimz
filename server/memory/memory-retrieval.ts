import type { MemoryRecord, MemoryType } from "./types";

export const MEMORY_MAX_DISTANCE = 0.6;

export function filterRecalledMemories(
  recalled: Array<{ blobId: string; distance: number; text: string }>,
  indexRows: MemoryRecord[],
  userId: string,
) {
  const byBlob = new Map(indexRows.map((row) => [row.blobId, row]));
  const kept: MemoryRecord[] = [];
  for (const hit of recalled) {
    const row = byBlob.get(hit.blobId);
    if (!row) continue;
    if (row.userId !== userId) continue;
    if (row.status !== "active") continue;
    if (hit.distance >= MEMORY_MAX_DISTANCE) continue;
    kept.push({ ...row, distance: hit.distance });
  }
  return kept;
}

export function rankMemories(memories: MemoryRecord[], ideaTitle?: string) {
  return [...memories]
    .sort((a, b) => {
      const preference = score(a, ideaTitle) - score(b, ideaTitle);
      if (preference !== 0) return preference;
      if (b.importance !== a.importance) return b.importance - a.importance;
      return (a.distance ?? 1) - (b.distance ?? 1);
    })
    .slice(0, 8);
}

function score(memory: MemoryRecord, ideaTitle?: string) {
  if (memory.type === "user_preference") return 0;
  if (ideaTitle && memory.ideaTitle.toLowerCase() === ideaTitle.toLowerCase()) return 1;
  return 2;
}

export function mergePreferences(recalled: MemoryRecord[], preferences: MemoryRecord[]) {
  const seen = new Set(recalled.map((memory) => memory.id));
  const extras = preferences.filter((memory) => memory.status === "active" && !seen.has(memory.id));
  return [...extras, ...recalled];
}

export function indicatorMemories(memories: MemoryRecord[], currentIdeaTitle?: string) {
  return memories
    .filter((memory) => memory.type !== "user_preference")
    .map((memory) => ({
      type:
        currentIdeaTitle &&
        memory.ideaTitle &&
        memory.ideaTitle.toLowerCase() !== currentIdeaTitle.toLowerCase()
          ? ("connected" as const)
          : ("remembered" as const),
      memoryId: memory.id,
    }));
}

export function isMemoryType(value: string): value is MemoryType {
  return [
    "user_preference",
    "idea",
    "decision",
    "rejection",
    "insight",
    "open_question",
    "idea_change",
  ].includes(value);
}
