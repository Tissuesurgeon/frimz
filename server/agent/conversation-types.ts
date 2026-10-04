export type ConversationalIntent =
  | "question"
  | "exploration"
  | "decision"
  | "planning"
  | "writing"
  | "reflection"
  | "problem_solving"
  | "challenge"
  | "comparison"
  | "direction_change"
  | "casual"
  | "unclear";

export type UncertaintyLevel = "low" | "medium" | "high";
export type ResponseDepth = "short" | "normal" | "deep";

export type UserDirection = {
  topic?: string;
  constraints: string[];
  exclusions: string[];
  explicitInstruction?: string;
};

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
  /** Same move, named for the orchestration budget. */
  responseMove: ConversationalMove;
  shouldUseMemory: boolean;
  relevantMemoryIds: string[];
  shouldAskQuestion: boolean;
  uncertaintyLevel: UncertaintyLevel;
  questionCount: 0 | 1 | 2;
  shouldStructure: boolean;
  shouldChallenge: boolean;
  shouldSynthesize: boolean;
  responseDepth: ResponseDepth;
  userDirection?: string;
  exclusions: string[];
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
  | "weighing"
  | "stuck"
  | "develop"
  | "reset"
  | "switch_topic"
  | "focus_shift"
  | "return_idea"
  | "reject_boundary"
  | "mind_change"
  | "reframe"
  | "connect_familiar"
  | "ambiguous"
  | "excited"
  | "fed_up"
  | "joke"
  | "pushback"
  | "insight"
  | "noticed"
  | "mean_phrase"
  | "landed"
  | "wrap_up"
  | "unclear";
