export type ConversationalIntent =
  | "question"
  | "exploration"
  | "decision"
  | "planning"
  | "writing"
  | "reflection"
  | "problem_solving"
  | "casual"
  | "unclear";

export type ThinkingStage =
  | "discover"
  | "explore"
  | "clarify"
  | "challenge"
  | "decide"
  | "develop"
  | "plan"
  | "reflect";

export type ConversationalMove =
  | "answer"
  | "ask"
  | "clarify"
  | "explore"
  | "challenge"
  | "compare"
  | "connect"
  | "confirm"
  | "synthesize"
  | "reflect"
  | "plan"
  | "draft"
  | "summarize";

export type ConversationStrategy = {
  intent: ConversationalIntent;
  thinkingStage: ThinkingStage;
  conversationalMove: ConversationalMove;
  shouldUseMemory: boolean;
  relevantMemoryIds: string[];
  shouldAskQuestion: boolean;
  reasoningFocus?: string;
  /** This reply ends by offering a written draft of the current thinking. */
  offersDraft?: boolean;
  /** A blank start: one question, with no lesson in front of it. */
  bareQuestion?: boolean;
  /** This turn does not steer from the brief or recalled memories. */
  freshStart?: boolean;
};

export type IntentSignal =
  | "frustrated"
  | "draft"
  | "reflect"
  | "compare"
  | "perspective"
  | "reversal"
  | "confirm"
  | "challenge"
  | "direction"
  | "vague"
  | "blank"
  | "discover"
  | "clarify"
  | "factual"
  | "plan"
  | "brainstorm"
  | "disagree"
  | "uncertain"
  | "reset"
  | "switch_topic"
  | "focus_shift"
  | "return_idea"
  | "reject_boundary"
  | "mind_change"
  | "reframe"
  | "connect_familiar"
  | "wrap_up"
  | "unclear";
