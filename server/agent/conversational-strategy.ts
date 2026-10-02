import type { Mode } from "@/lib/modes";
import type { MemoryRecord } from "@/server/memory/types";
import { analyzeIntent } from "./intent-analyzer";
import { conflictingMemories, deriveConversationState } from "./conversation-state";
import type { ConversationStrategy, ConversationalMove, IntentSignal, ThinkingStage } from "./conversation-types";

const HISTORY_LIMIT = 8;

function ids(memories: MemoryRecord[]) {
  return memories.slice(0, HISTORY_LIMIT).map((memory) => memory.id);
}

function strategy(partial: Omit<ConversationStrategy, "relevantMemoryIds" | "shouldUseMemory"> & {
  relevantMemoryIds?: string[];
  shouldUseMemory?: boolean;
}): ConversationStrategy {
  const relevantMemoryIds = partial.relevantMemoryIds ?? [];
  return {
    ...partial,
    relevantMemoryIds,
    shouldUseMemory: partial.shouldUseMemory ?? relevantMemoryIds.length > 0,
  };
}

function fromSignal(signal: IntentSignal, historyIds: string[]): ConversationStrategy {
  switch (signal) {
    case "frustrated":
      return strategy({
        intent: "reflection",
        thinkingStage: "reflect",
        conversationalMove: "synthesize",
        shouldAskQuestion: false,
        reasoningFocus: "They are stuck. Summarize what is already established. Do not ask another question.",
      });
    case "draft":
      return strategy({
        intent: "writing",
        thinkingStage: "develop",
        conversationalMove: "draft",
        shouldAskQuestion: false,
        reasoningFocus: "Produce the requested piece. Leave choices they have not made explicit.",
      });
    case "reflect":
      return strategy({
        intent: "reflection",
        thinkingStage: "reflect",
        conversationalMove: "reflect",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: false,
        reasoningFocus:
          historyIds.length > 0
            ? "Reconstruct how the thinking changed. Use the history below. Do not invent steps."
            : "The history needed for this question is not in context. Say you do not have it.",
      });
    case "compare":
      return strategy({
        intent: "problem_solving",
        thinkingStage: "decide",
        conversationalMove: "compare",
        shouldAskQuestion: false,
        reasoningFocus: "Lay out the tradeoffs. Do not choose for them.",
      });
    case "perspective":
      return strategy({
        intent: "problem_solving",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Contribute a perspective. The user decides.",
      });
    case "reversal":
      return strategy({
        intent: "decision",
        thinkingStage: "decide",
        conversationalMove: "confirm",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: false,
        reasoningFocus: "The new direction is current. Keep the earlier direction as history.",
      });
    case "confirm":
      return strategy({
        intent: "decision",
        thinkingStage: "decide",
        conversationalMove: "confirm",
        shouldAskQuestion: false,
        reasoningFocus: "Recognize the decision. Do not reopen it.",
      });
    case "challenge":
      return strategy({
        intent: "problem_solving",
        thinkingStage: "challenge",
        conversationalMove: "challenge",
        shouldAskQuestion: false,
        reasoningFocus: "Name the assumption and another way to see it. Do not decide.",
      });
    case "direction":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Offer a few directions. Do not pick one.",
      });
    case "vague":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Explore the idea. Do not judge it and do not produce a plan.",
      });
    case "clarify":
      return strategy({
        intent: "exploration",
        thinkingStage: "clarify",
        conversationalMove: "clarify",
        shouldAskQuestion: true,
        reasoningFocus: "Restate the clearer problem, then ask one question that tests it.",
      });
    case "discover":
      return strategy({
        intent: "exploration",
        thinkingStage: "discover",
        conversationalMove: "ask",
        shouldAskQuestion: true,
        reasoningFocus: "The idea is still early. Contribute one observation, then ask the smallest useful question. Do not produce a plan.",
      });
    case "factual":
      return strategy({
        intent: "question",
        thinkingStage: "clarify",
        conversationalMove: "answer",
        shouldAskQuestion: false,
        reasoningFocus: "Answer the question. Do not turn it into a broader conversation.",
      });
    case "plan":
      return strategy({
        intent: "planning",
        thinkingStage: "plan",
        conversationalMove: "plan",
        shouldAskQuestion: false,
        reasoningFocus: "Offer a short sequence they can react to. Keep undecided choices open.",
      });
    default:
      return strategy({
        intent: "unclear",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: true,
        reasoningFocus: "Stay one step ahead of what they just said.",
      });
  }
}

function modeMove(mode: Mode): { move: ConversationalMove; stage: ThinkingStage; focus: string } | null {
  if (mode === "challenge") {
    return {
      move: "challenge",
      stage: "challenge",
      focus: "Look at the assumption doing the work. Do not decide.",
    };
  }
  if (mode === "plan") {
    return {
      move: "plan",
      stage: "plan",
      focus: "Turn the current thought into a short direction they can react to.",
    };
  }
  if (mode === "think") {
    return {
      move: "explore",
      stage: "explore",
      focus: "Explore the thought. Do not survey the whole category.",
    };
  }
  return null;
}

export function chooseConversationStrategy(input: {
  mode: Mode;
  userMessage: string;
  memories?: MemoryRecord[];
  preferences?: MemoryRecord[];
  ideaTitle?: string;
}): ConversationStrategy {
  const memories = input.memories ?? [];
  const preferences = input.preferences ?? [];
  const state = deriveConversationState({
    userMessage: input.userMessage,
    ideaTitle: input.ideaTitle,
    memories: [...preferences, ...memories],
    preferences,
  });
  const analysis = analyzeIntent(input.userMessage);
  const historyIds = ids([...state.decisions, ...state.ideaChanges, ...state.rejections]);
  let chosen = fromSignal(analysis.explicit ? analysis.signal : "unclear", historyIds);

  if (!analysis.explicit) {
    const bias = modeMove(input.mode);
    if (bias) {
      chosen = strategy({
        intent: input.mode === "plan" ? "planning" : input.mode === "challenge" ? "problem_solving" : "exploration",
        thinkingStage: bias.stage,
        conversationalMove: bias.move,
        shouldAskQuestion: bias.move === "explore",
        reasoningFocus: bias.focus,
      });
    }
  }

  const locked: ConversationalMove[] = ["draft", "reflect", "synthesize", "confirm", "answer"];
  if (!locked.includes(chosen.conversationalMove)) {
    const conflicts = conflictingMemories(input.userMessage, state);
    if (conflicts.length > 0) {
      chosen = strategy({
        intent: chosen.intent,
        thinkingStage: "challenge",
        conversationalMove: "connect",
        shouldUseMemory: true,
        relevantMemoryIds: ids(conflicts),
        shouldAskQuestion: false,
        reasoningFocus:
          "A stored preference or decision pulls against this message. Use that as reasoning. Do not cite a memory id or announce that you remember a preference.",
      });
    }
  }

  return chosen;
}
