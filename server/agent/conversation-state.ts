import type { MemoryRecord } from "@/server/memory/types";
import type { UserDirection } from "./conversation-types";

export type ConversationState = {
  topic: string;
  ideaTitle?: string;
  decisions: MemoryRecord[];
  rejections: MemoryRecord[];
  openQuestions: MemoryRecord[];
  preferences: MemoryRecord[];
  ideaChanges: MemoryRecord[];
  other: MemoryRecord[];
  uncertainties: string[];
};

function active(memories: MemoryRecord[], type: MemoryRecord["type"]) {
  return memories.filter((memory) => memory.type === type && memory.status === "active");
}

export function deriveConversationState(input: {
  userMessage: string;
  ideaTitle?: string;
  memories: MemoryRecord[];
  preferences: MemoryRecord[];
}): ConversationState {
  const memories = input.memories.filter((memory) => memory.status === "active");
  const preferences = [
    ...input.preferences.filter((memory) => memory.type === "user_preference" && memory.status === "active"),
    ...active(memories, "user_preference"),
  ].filter((memory, index, all) => all.findIndex((item) => item.id === memory.id) === index);
  const uncertainties = active(memories, "open_question").map((memory) => memory.content);
  if (/\b(not sure|don'?t know|maybe|i think)\b/i.test(input.userMessage)) {
    uncertainties.push(input.userMessage.trim());
  }
  return {
    topic: input.ideaTitle || input.userMessage.trim().slice(0, 80),
    ideaTitle: input.ideaTitle,
    decisions: active(memories, "decision"),
    rejections: active(memories, "rejection"),
    openQuestions: active(memories, "open_question"),
    preferences,
    ideaChanges: active(memories, "idea_change"),
    other: memories.filter((memory) => memory.type === "idea" || memory.type === "insight"),
    uncertainties,
  };
}

const CONFLICTS: Array<[RegExp, RegExp]> = [
  [/simple|fast validation|fast feedback|extremely simple/, /15 features|many features|lots of features|full suite/],
  [/individual students/, /universit/],
  [/universit/, /individual students/],
  [/sneaker|not a general social/, /general social/],
];

/** Short-lived direction from the latest message. Current intent outranks stored context. */
export function deriveUserDirection(message: string): UserDirection {
  const exclusions: string[] = [];
  const constraints: string[] = [];
  for (const match of message.matchAll(/don'?t (?:talk|discuss) about ([^.?!]+)/gi)) {
    exclusions.push(match[1].trim());
  }
  for (const match of message.matchAll(/\b(?:only|just) (?:talk|focus) (?:about|on) ([^.?!]+)/gi)) {
    constraints.push(match[1].trim());
  }
  const topic = message.match(
    /(?:let'?s|i want to) (?:work on|explore|talk about|focus on|understand) (?:the |a )?([^.?!]+)/i,
  )?.[1]?.trim();
  return {
    topic,
    constraints,
    exclusions,
    explicitInstruction: exclusions.length || constraints.length ? message.trim() : undefined,
  };
}

export function conflictingMemories(message: string, state: ConversationState) {
  const text = message.toLowerCase();
  const pool = [...state.preferences, ...state.decisions, ...state.rejections];
  return pool.filter((memory) => {
    const content = memory.content.toLowerCase();
    return CONFLICTS.some(([memoryPattern, messagePattern]) => memoryPattern.test(content) && messagePattern.test(text));
  });
}
