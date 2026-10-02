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
  | "discover"
  | "clarify"
  | "factual"
  | "plan"
  | "unclear";
