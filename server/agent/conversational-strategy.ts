import type { Mode } from "@/lib/modes";
import { WRITE_UP_FORMATS } from "@/lib/write-up";
import type { MemoryRecord } from "@/server/memory/types";
import { analyzeIntent } from "./intent-analyzer";
import { conflictingMemories, deriveConversationState, deriveUserDirection } from "./conversation-state";
import type { ConversationStrategy, ConversationalMove, IntentSignal, ResponseDepth, ThinkingStage, UncertaintyLevel } from "./conversation-types";

const HISTORY_LIMIT = 8;

function ids(memories: MemoryRecord[]) {
  return memories.slice(0, HISTORY_LIMIT).map((memory) => memory.id);
}

function strategy(partial: Omit<ConversationStrategy, "relevantMemoryIds" | "shouldUseMemory" | "responseMove" | "uncertaintyLevel" | "questionCount" | "shouldStructure" | "shouldChallenge" | "shouldSynthesize" | "responseDepth" | "exclusions"> & {
  relevantMemoryIds?: string[];
  shouldUseMemory?: boolean;
  uncertaintyLevel?: UncertaintyLevel;
  questionCount?: 0 | 1 | 2;
  shouldStructure?: boolean;
  shouldChallenge?: boolean;
  shouldSynthesize?: boolean;
  responseDepth?: ResponseDepth;
  exclusions?: string[];
}): ConversationStrategy {
  const relevantMemoryIds = partial.relevantMemoryIds ?? [];
  const move = partial.conversationalMove;
  const structured = ["plan", "draft", "compare", "synthesize", "reflect", "summarize"].includes(move);
  return {
    ...partial,
    responseMove: move,
    relevantMemoryIds,
    shouldUseMemory: partial.shouldUseMemory ?? relevantMemoryIds.length > 0,
    uncertaintyLevel: partial.uncertaintyLevel ?? "medium",
    questionCount: partial.questionCount ?? (partial.shouldAskQuestion ? 1 : 0),
    shouldStructure: partial.shouldStructure ?? structured,
    shouldChallenge: partial.shouldChallenge ?? move === "challenge",
    shouldSynthesize: partial.shouldSynthesize ?? (move === "synthesize" || move === "compare"),
    responseDepth: partial.responseDepth ?? (move === "answer" ? "short" : move === "draft" || move === "plan" ? "deep" : "normal"),
    exclusions: partial.exclusions ?? [],
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
    case "fed_up":
      return strategy({
        intent: "reflection",
        thinkingStage: "reflect",
        conversationalMove: "synthesize",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "They are done with this idea. Say so in a sentence and stop forcing it. One question about what bothered them. Do not comfort them or evaluate the idea.",
      });
    case "excited":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "ask",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "They are excited. React in a few words, then ask what they figured out. Do not document the insight or list implications.",
      });
    case "joke":
      return strategy({
        intent: "casual",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Get the joke in one line, then the useful point underneath if there is one. Do not answer like a consultant.",
      });
    case "pushback":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "ask",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Fair. Ask what you are missing. Do not open with a hedged defense.",
      });
    case "insight":
      return strategy({
        intent: "exploration",
        thinkingStage: "develop",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "normal",
        reasoningFocus: "Engage the distinction they just made. Do not turn it into a product specification.",
      });
    case "noticed":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus:
          "Yeah, then one consequence they did not name, in a sentence. Then one question about whether something is missing. Do not propose a product.",
      });
    case "mean_phrase":
      return strategy({
        intent: "exploration",
        thinkingStage: "clarify",
        conversationalMove: "ask",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "That's interesting, then one question asking what their phrase would actually mean. Do not define it for them.",
      });
    case "landed":
      return strategy({
        intent: "exploration",
        thinkingStage: "develop",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus:
          "Yeah. One contrast with the obvious version of the product. One sentence naming the journey they just described. No question.",
      });
    case "aside":
      return strategy({
        intent: "direction_change",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Sure. That is the whole reply. Follow the new thread on the next turn. Do not cling to the one they paused.",
      });
    case "stocktake":
      return strategy({
        intent: "reflection",
        thinkingStage: "reflect",
        conversationalMove: "synthesize",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "normal",
        reasoningFocus:
          "Tell how the thinking evolved: how it started, what was set aside and why, what was chosen and why, what changed since, and what is still open. A few short paragraphs. The old choice is history if they have moved on. Do not announce memory. Do not dump section labels.",
      });
    case "pause":
      return strategy({
        intent: "reflection",
        thinkingStage: "reflect",
        conversationalMove: "summarize",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Sounds good. Stop there. Do not recap and do not offer a draft.",
      });
    case "open_plan":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus:
          "Yeah, that's fine. One sentence that you can figure it out as you go. Then one question: what kind of thing are they imagining? Stop after the question. Do not list options.",
      });
    case "want_shape":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "So, one contrast with the version they do not want. A short liking is enough. No question. Do not recite it back as a saved preference.",
      });
    case "add_on":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Fold the added want into the picture in one line. Do not announce that you are storing it. No question.",
      });
    case "float_option":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus:
          "If it fits what they already want, one sentence that it fits. If it changes the shape, say what still holds and what is new. Do not say they previously said it. No question.",
      });
    case "tentative":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "ask",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "The option could work. One question about the real tension in how it should feel. Do not interview them or list alternatives.",
      });
    case "loose_contrast":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Yeah, then one contrast: the lighter version rather than the rigid one. No question.",
      });
    case "set_aside":
      return strategy({
        intent: "decision",
        thinkingStage: "decide",
        conversationalMove: "confirm",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Sure. Drop that option for now, in one sentence. Do not defend it. The reason they gave is what gets kept.",
      });
    case "reason_shift":
      return strategy({
        intent: "exploration",
        thinkingStage: "develop",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus:
          "The reason changed. Say how that changes the earlier choice. The old choice is history, not an instruction. No question.",
      });
    case "sketch":
      return strategy({
        intent: "planning",
        thinkingStage: "plan",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "That lines up with what they wanted at the start. Say so in one or two sentences. Do not turn it into a checklist. No question.",
      });
    case "spend_light":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Keep the practical parts simple and spend on the parts they actually care about. One or two sentences. No question.",
      });
    case "budget_first":
      return strategy({
        intent: "planning",
        thinkingStage: "plan",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "Yeah, that makes sense before locking anything in. One sentence. Follow this thread. No question.",
      });
    case "tally":
      return strategy({
        intent: "planning",
        thinkingStage: "plan",
        conversationalMove: "synthesize",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "The simple total, in one sentence. No advice yet. No question.",
      });
    case "agree":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: false,
        responseDepth: "short",
        reasoningFocus: "They agreed. One next step that uses what you now understand. No question. Do not recap.",
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
        intent: "comparison",
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
        shouldAskQuestion: true,
        questionCount: 1,
        reasoningFocus:
          historyIds.length > 0
            ? "Recall the picture in a few sentences: where things were leaning, the qualities that still hold, and a number or rough shape if the history has one. Then ask where they want to pick it back up. Do not assume they still agree. Do not explain how you remember."
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
        intent: "direction_change",
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
          "Fair enough. What changed? Accept the new direction. The previous decision stays history. Do not reject the new choice.",
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
        reasoningFocus: "Yeah. One sentence on why the new choice fits. The new direction is current. Keep the earlier direction as history. Do not reopen it.",
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
        intent: "challenge",
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
        reasoningFocus: "They seem stuck on direction. Offer a few possibilities in prose, not a numbered framework or checklist. Do not pick one.",
      });
    case "stuck":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "They seem stuck. Offer a few possibilities conversationally. No numbered categories or checklist unless they asked for structure.",
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
          "Create space. They may not know the idea yet. Stay conversational; permission to explore without identifying a problem. No categories, checklist, or target-user drill.",
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
        uncertaintyLevel: "high",
        shouldStructure: false,
        shouldChallenge: false,
        responseDepth: "short",
        reasoningFocus:
          "Uncertainty is fine. A short okay is enough. Do not break their uncertainty into a process. Do not rush problem, customer, MVP, or numbered exploration menus.",
      });
    case "discover":
      return strategy({
        intent: "exploration",
        thinkingStage: "discover",
        conversationalMove: "explore",
        shouldAskQuestion: true,
        uncertaintyLevel: "high",
        questionCount: 1,
        shouldStructure: false,
        shouldChallenge: false,
        responseDepth: "short",
        reasoningFocus:
          "They named a space and do not know the idea yet. Yeah, that's okay, then one sentence that the idea does not have to be figured out yet, then one question: what got them thinking about the thing they named. Stop after the question. Do not give examples of possible answers. Do not define a problem or list categories.",
      });
    case "develop":
      return strategy({
        intent: "exploration",
        thinkingStage: "develop",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        reasoningFocus: "Respond to the concrete thought. Contribute a distinction. Do not jump to a business plan or interrogation.",
      });
    case "brainstorm":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldAskQuestion: false,
        shouldStructure: true,
        responseDepth: "deep",
        reasoningFocus: "They asked for ideas. Offer several directions they can react to. Do not pick one.",
      });
    case "disagree":
      return strategy({
        intent: "exploration",
        thinkingStage: "explore",
        conversationalMove: "explore",
        shouldUseMemory: historyIds.length > 0,
        relevantMemoryIds: historyIds,
        shouldAskQuestion: false,
        reasoningFocus: "Drop the previous view and build on theirs. Separate concerns if that keeps both true. Do not defend or repeat the same challenge.",
      });
    case "reset":
      return strategy({
        intent: "direction_change",
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
        responseDepth: "short",
        shouldStructure: false,
        reasoningFocus: "Answer the question directly. Do not turn it into a broader conversation or an interview.",
      });
    case "ambiguous":
      return strategy({
        intent: "unclear",
        thinkingStage: "clarify",
        conversationalMove: "ask",
        shouldAskQuestion: true,
        questionCount: 1,
        shouldStructure: false,
        reasoningFocus: "The referent is ambiguous. Ask one concise clarification. Do not guess which belief they dropped.",
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
      focus: "Stay with what they just said. One useful step, then stop. Do not run a startup workshop. Do not explain it back.",
    };
  }
  return null;
}

const DRAFT_OFFER = `They are wrapping up and the current thinking has substance. In two or three sentences, say where the thinking landed, using the context brief. Then ask once whether they would like a written draft of it, naming the two or three formats from this list that fit the work best: ${WRITE_UP_FORMATS.map((format) => format.label).join(", ")}. Keep the offer to one short sentence.`;

const HIGH_UNCERTAINTY: IntentSignal[] = ["blank", "discover", "uncertain", "vague", "weighing", "stuck"];

function highUncertainty(signal: IntentSignal) {
  return HIGH_UNCERTAINTY.includes(signal);
}

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
  const direction = deriveUserDirection(input.userMessage);
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
        shouldAskQuestion: false,
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

  return {
    ...chosen,
    uncertaintyLevel: highUncertainty(analysis.signal) ? "high" : chosen.uncertaintyLevel,
    userDirection: direction.topic ?? chosen.userDirection,
    exclusions: direction.exclusions,
  };
}
