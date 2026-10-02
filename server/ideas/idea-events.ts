import type { MemoryType } from "@/server/memory/types";

export function shouldCreateIdeaEvent(memory: {
  type: MemoryType;
  ideaTitle: string;
  changesIdea: boolean;
}) {
  if (!memory.ideaTitle.trim()) return false;
  if (memory.type === "user_preference") return false;
  if (memory.type === "insight") return memory.changesIdea;
  return (
    memory.type === "idea" ||
    memory.type === "decision" ||
    memory.type === "rejection" ||
    memory.type === "idea_change" ||
    memory.type === "open_question"
  );
}
