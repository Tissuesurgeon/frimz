import type { Mode } from "@/lib/modes";
import { WRITE_UP_FORMATS } from "@/lib/write-up";
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
        reasoningFocus: "They are circling or lost. Name what is already settled and the tradeoff underneath. Do not ask another question.",
      });
    case "draft":
      return strategy({
        intent: "writing",
        thinkingStage: "develop",
        conversationalMove: "draft",
        shouldAskQuestion: false,
        reasoningFocus: "Produce the requested piece. Mark a missing fact. Leave choices they have not made explicit.",
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
        reasoningFocus:
          "Compare and synthesize: each side's core value, strength, and risk. Note if they combine. Do not choose for them. One optional next step they can take or leave.",
      });
    case "return_idea":
      return strategy({
        intent: "reflection",
        thinkingStage: "reflect",
        conversationalMove: "reflect",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: false,
        reasoningFocus:
          historyIds.length > 0
            ? "Recall the last direction, a rejection or decision that mattered, and the open question. Do not assume they still agree. Offer to continue or rethink."
            : "The history needed is not in context. Say so and ask what to pick up.",
      });
    case "connect_familiar":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "connect",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: false,
        reasoningFocus:
          "Name the connection to earlier work and the difference that matters now. Do not cite a memory id or announce that you remember.",
      });
    case "switch_topic":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: true,
        reasoningFocus: "Switch with them. Leave the old topic aside. One question that opens the new thread. Do not force the previous topic back.",
      });
    case "focus_shift":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: true,
        reasoningFocus: "Follow the branch they chose. Keep the rest as background only. Contribute one useful angle on the new focus, then one question or let them pick a starting angle.",
      });
    case "mind_change":
      return strategy({
        intent: "decision",
        thinkingStage: "decide",
        conversationalMove: "confirm",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: true,
        reasoningFocus:
          "Accept the new direction. Recall the previous decision and its reason as history. Ask one question about what changed their assessment. Do not reject the new choice.",
      });
    case "reject_boundary":
      return strategy({
        intent: "decision",
        thinkingStage: "decide",
        conversationalMove: "confirm",
        shouldAskQuestion: false,
        reasoningFocus: "Treat this as a rejected direction and a constraint. Reflect the boundary. Do not claim you decided.",
      });
    case "reframe":
      return strategy({
        intent: "exploration",
        thinkingStage: "develop",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Recognize the conceptual shift and develop it with one distinction. Do not jump to a feature list.",
      });
    case "perspective":
      return strategy({
        intent: "problem_solving",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Add one perspective they can push back on. The user decides.",
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
        reasoningFocus: "Reflect the decision they just made and the reason they gave. Do not claim you decided. Do not reopen it.",
      });
    case "challenge":
      return strategy({
        intent: "problem_solving",
        thinkingStage: "challenge",
        conversationalMove: "challenge",
        shouldAskQuestion: false,
        reasoningFocus: "Name the assumption, say why it matters, and offer a clearer framing. Do not decide. If they disagree, adapt. Do not repeat the same challenge.",
      });
    case "direction":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Offer a few directions they can react to. Do not pick one.",
      });
    case "weighing":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "synthesize",
        shouldAskQuestion: false,
        reasoningFocus: "They are thinking aloud between options. Name the tradeoff they are weighing. Do not force a choice yet.",
      });
    case "vague":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus:
          "Create space. They may not have a concrete idea yet. Offer a few directions they can enter. Do not force problem, persona, or MVP. No feature list.",
      });
    case "clarify":
      return strategy({
        intent: "exploration",
        thinkingStage: "clarify",
        conversationalMove: "clarify",
        shouldAskQuestion: true,
        reasoningFocus: "Say the sharper problem in one sentence, then ask one question that tests it.",
      });
    case "blank":
      return strategy({
        intent: "exploration",
        thinkingStage: "discover",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus:
          "They have not put an idea down yet. Create space. We do not need the exact idea yet. Do not teach them how to phrase it or run a methodology interview.",
      });
    case "uncertain":
      return strategy({
        intent: "exploration",
        thinkingStage: "discover",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus:
          "Stay broad. They may not have a problem or product yet. Offer a few angles or create space. Do not force problem, persona, market, or MVP.",
      });
    case "discover":
      return strategy({
        intent: "exploration",
        thinkingStage: "discover",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus:
          "Early interest in a space, not necessarily a problem yet. Create space and offer a few directions they can enter. Do not interview them into a startup workshop.",
      });
    case "brainstorm":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Offer a few directions they can react to. Do not pick one.",
      });
    case "disagree":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: false,
        reasoningFocus: "Drop the previous view and build on theirs. Do not defend it.",
      });
    case "reset":
      return strategy({
        intent: "exploration",
        thinkingStage: "discover",
        conversationalMove: "ask",
        shouldUseMemory: false,
        shouldAskQuestion: true,
        freshStart: true,
        reasoningFocus: "They want a fresh exploration. Do not use previous idea context to steer. One question that opens the new thread.",
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
        reasoningFocus: "Offer a short sequence they can mark up. Keep undecided choices open. Do not lock a decision.",
      });
    case "wrap_up":
      return strategy({
        intent: "reflection",
        thinkingStage: "reflect",
        conversationalMove: "summarize",
        shouldAskQuestion: false,
        reasoningFocus: "They are wrapping up. Close in a sentence or two and leave the thread where they put it.",
      });
    default:
      return strategy({
        intent: "unclear",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Pick up where they left off. Add one useful step. Do not explain what they just said. Do not force a methodology.",
      });
  }
}

function modeMove(mode: Mode): { move: ConversationalMove; stage: ThinkingStage; focus: string } | null {
  if (mode === "challenge") {
    return {
      move: "challenge",
      stage: "challenge",
      focus: "Name the assumption doing the work, in a sentence. Do not decide.",
    };
  }
  if (mode === "plan") {
    return {
      move: "plan",
      stage: "plan",
      focus: "Turn the current thought into a short direction they can mark up.",
    };
  }
  if (mode === "think") {
    return {
      move: "explore",
      stage: "explore",
      focus: "Create space or offer directions they can enter. Do not run a startup workshop. Do not explain it back.",
    };
  }
  return null;
}

const DRAFT_OFFER = `They are wrapping up and the current thinking has substance. In two or three sentences, say where the thinking landed, using the context brief. Then ask once whether they would like a written draft of it, naming the two or three formats from this list that fit the work best: ${WRITE_UP_FORMATS.map((format) => format.label).join(", ")}. Keep the offer to one short sentence.`;

export function chooseConversationStrategy(input: {
  mode: Mode;
  userMessage: string;
  memories?: MemoryRecord[];
  preferences?: MemoryRecord[];
  ideaTitle?: string;
  /** The brief is ready for a draft and none has been offered at this version. */
  offerDraft?: boolean;
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

  if (analysis.signal === "wrap_up" && input.offerDraft) {
    chosen = strategy({
      intent: "reflection",
      thinkingStage: "reflect",
      conversationalMove: "summarize",
      shouldAskQuestion: true,
      reasoningFocus: DRAFT_OFFER,
      offersDraft: true,
    });
  }

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

  const locked: ConversationalMove[] = ["draft", "reflect", "synthesize", "confirm", "answer", "summarize"];
  const hold = chosen.freshStart || /do not defend/i.test(chosen.reasoningFocus ?? "");
  if (!hold && !locked.includes(chosen.conversationalMove)) {
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
