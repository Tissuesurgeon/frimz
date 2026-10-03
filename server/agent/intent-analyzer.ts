import type { ConversationalIntent, IntentSignal } from "./conversation-types";

export type IntentAnalysis = {
  signal: IntentSignal;
  intent: ConversationalIntent;
  explicit: boolean;
};

const RULES: Array<{ signal: IntentSignal; intent: ConversationalIntent; pattern: RegExp }> = [
  { signal: "reset", intent: "exploration", pattern: /forget everything|start from (zero|scratch)|fresh start/i },
  { signal: "return_idea", intent: "reflection", pattern: /go back to (the )?|let'?s go back to|pick (this|it) back up|continue the .{0,48} idea\b/i },
  { signal: "connect_familiar", intent: "exploration", pattern: /feels familiar somehow|connection to something|reminds me of something/i },
  { signal: "switch_topic", intent: "exploration", pattern: /tired of thinking about|let'?s switch|forget the .{0,72}\.\s*i want to work on|work on a .{0,40} idea instead|let'?s work on .{0,48} instead/i },
  { signal: "focus_shift", intent: "exploration", pattern: /don'?t talk about|keep .{0,96} as context but|focus (on|specifically on) the/i },
  { signal: "mind_change", intent: "decision", pattern: /i'?ve changed my mind|changed my mind/i },
  { signal: "reject_boundary", intent: "decision", pattern: /don'?t want (this|it) to become|i don'?t want this to become/i },
  { signal: "reframe", intent: "exploration", pattern: /maybe the problem isn'?t|maybe it'?s (that|actually)/i },
  { signal: "disagree", intent: "exploration", pattern: /\bi disagree\b/i },
  { signal: "frustrated", intent: "reflection", pattern: /frustrat|going in circles|around in circles|in circles|getting lost|i'?m lost\b|what have we (actually )?(figured|worked) out/i },
  { signal: "draft", intent: "writing", pattern: /\bjust write\b|\bwrite the (proposal|pitch|draft|description|readme)\b|\bdraft the\b|\bproject brief\b|\bturn (everything|this|it) into\b/i },
  { signal: "reflect", intent: "reflection", pattern: /why did we|how did we (arrive|get|end|choose)|originally choose|what did we decide|why did we reject/i },
  { signal: "compare", intent: "problem_solving", pattern: /what should (i|we) do\b|\bcompare\b/i },
  { signal: "perspective", intent: "problem_solving", pattern: /what do you think\b/i },
  { signal: "reversal", intent: "decision", pattern: /\bactually\b[\s\S]{0,80}\binstead\b|\blet'?s do\b[\s\S]{0,80}\binstead\b/i },
  { signal: "confirm", intent: "decision", pattern: /let'?s go with\b|we'?ll go with\b|let'?s start with\b/i },
  { signal: "brainstorm", intent: "exploration", pattern: /give me ideas|what (else )?could we build|ideas for what we could build/i },
  { signal: "challenge", intent: "problem_solving", pattern: /\bchallenge this\b|\bi think (we|i) should\b|\bdefinitely\b/i },
  { signal: "direction", intent: "exploration", pattern: /don'?t know what direction|what direction to take|which direction to take/i },
  { signal: "weighing", intent: "exploration", pattern: /maybe .{0,96}(although|but) .{0,96}(not sure|i'?m not sure|might be better)/i },
  { signal: "discover", intent: "exploration", pattern: /been thinking about|i want to build something|building something for|i have an idea\b/i },
  { signal: "blank", intent: "exploration", pattern: /don'?t have (the |an )?idea yet|this is the start|help me explore an idea\b|let'?s (just )?(think|brainstorm)\b|i want to (think|brainstorm)\b/i },
  { signal: "vague", intent: "exploration", pattern: /not sure if it'?s good|not sure if this is good|i have an idea but/i },
  { signal: "clarify", intent: "exploration", pattern: /the real problem is|what i mean is|more specifically/i },
  { signal: "uncertain", intent: "exploration", pattern: /i don'?t really know|i just feel like/i },
  { signal: "plan", intent: "planning", pattern: /give me a plan|how (would|do) we launch|let'?s figure out how|for the next two weeks|let'?s make a plan|we'?ve got the idea|enough thinking|let'?s build it\b|okay, enough thinking/i },
  { signal: "factual", intent: "question", pattern: /what does .{1,80} mean\??$|^(what is|who is|define)\b/i },
];

const CLOSING =
  /\b(thanks|thank you|that'?s (all|it|everything|enough)( for (now|today))?|that (helps|helped)|(this|that) (was|is|has been) (really |very |super )?helpful|i (think i )?(have|got) what i need|i'?m (done|good)( for (now|today))?|good for (now|today)|let'?s (stop|pause|wrap( this| it)? up)|i'?ll start (building|on it|there|with (that|this))|time to (build|start)|that'?s the plan|i know what to (build|do) now)\b/i;
const CONTINUING =
  /\?|(?<!(?:for|build|do) )\bnow\b|\b(next|but|however|also|what about|how (do|would|should|can|could)|can you|could you|would you|let'?s (talk|think|look|explore|figure|discuss|move|go back)|i want to|i'?d like to|tell me|help me)\b/i;

/** The user is closing the conversation and is not opening a new thread. */
export function isWrapUp(message: string) {
  const text = message.trim();
  return text.length <= 160 && CLOSING.test(text) && !CONTINUING.test(text);
}

export function analyzeIntent(message: string): IntentAnalysis {
  const text = message.trim();
  if (/^what should (i|we) do\b/i.test(text) || /^what do you think\b/i.test(text)) {
    const rule = RULES.find((item) => item.pattern.test(text) && (item.signal === "compare" || item.signal === "perspective"));
    if (rule) return { signal: rule.signal, intent: rule.intent, explicit: true };
  }
  for (const rule of RULES) {
    if (rule.signal === "factual" && text.length > 120) continue;
    if (rule.signal === "blank" && text.length > 360) continue;
    if (rule.pattern.test(text)) return { signal: rule.signal, intent: rule.intent, explicit: true };
  }
  if (isWrapUp(text)) return { signal: "wrap_up", intent: "reflection", explicit: true };
  if (text.length < 24 && /^(hi|hello|hey|thanks|thank you)\b/i.test(text)) {
    return { signal: "unclear", intent: "casual", explicit: false };
  }
  return { signal: "unclear", intent: "unclear", explicit: false };
}
