import type { ConversationalIntent, IntentSignal } from "./conversation-types";

export type IntentAnalysis = {
  signal: IntentSignal;
  intent: ConversationalIntent;
  explicit: boolean;
};

const RULES: Array<{ signal: IntentSignal; intent: ConversationalIntent; pattern: RegExp }> = [
  { signal: "reset", intent: "direction_change", pattern: /forget everything|start from (zero|scratch)|fresh start/i },
  { signal: "aside", intent: "direction_change", pattern: /forget the .{1,48} for a (second|minute|sec|moment)|wait,? forget\b/i },
  { signal: "focus_shift", intent: "exploration", pattern: /don'?t talk about|keep .{0,96} as context but|focus (on|specifically on) the/i },
  { signal: "return_idea", intent: "reflection", pattern: /go back to (the )?|let'?s go back to|pick (this|it) back up|continue the .{0,48} idea\b|i'?m back\b|let'?s continue (planning|with)\b/i },
  { signal: "switch_topic", intent: "direction_change", pattern: /tired of thinking about|let'?s switch|forget the .{0,72}\.\s*i want to work on|work on a .{0,40} idea instead|let'?s work on .{0,48} instead/i },
  { signal: "connect_familiar", intent: "exploration", pattern: /feels familiar somehow|connection to something|reminds me of something/i },
  { signal: "mind_change", intent: "decision", pattern: /i'?ve changed my mind|changed my mind|don'?t think .{1,80} anymore|isn'?t what (we|i) want anymore|not what (we|i) want anymore/i },
  { signal: "reject_boundary", intent: "decision", pattern: /don'?t want (this|it) to become|i don'?t want this to become/i },
  { signal: "reframe", intent: "exploration", pattern: /maybe the problem isn'?t|maybe it'?s (that|actually)/i },
  { signal: "fed_up", intent: "reflection", pattern: /this (idea )?sucks|i hate this idea|going nowhere|we'?re forcing it/i },
  { signal: "excited", intent: "exploration", pattern: /just figured it out|i figured it out/i },
  { signal: "joke", intent: "casual", pattern: /would be funny|you know what would be funny|uber for /i },
  { signal: "pushback", intent: "exploration", pattern: /i don'?t think that'?s right|that'?s not right|no, i don'?t think/i },
  { signal: "disagree", intent: "exploration", pattern: /\bi disagree\b/i },
  { signal: "noticed", intent: "exploration", pattern: /i'?ve noticed|i guess i'?ve noticed|use it almost like|using it (almost )?like|like google/i },
  { signal: "mean_phrase", intent: "exploration", pattern: /doesn'?t really know|doesn'?t really (understand|remember)|i think the .{1,80} doesn'?t really/i },
  { signal: "landed", intent: "exploration", pattern: /already covered|where they'?re struggling|starting from zero|what they'?ve already|instead of starting/i },
  { signal: "insight", intent: "exploration", pattern: /the actual problem isn'?t|isn'?t that .{1,80} it'?s that/i },
  { signal: "pause", intent: "reflection", pattern: /i'?ll think about it|come back later|i'?ll come back/i },
  { signal: "open_plan", intent: "exploration", pattern: /haven'?t (really )?(decided|picked|chosen)\b/i },
  { signal: "tentative", intent: "exploration", pattern: /i was thinking .{1,80} but i'?m not sure|i'?m thinking .{1,60},? but i'?m not sure/i },
  { signal: "set_aside", intent: "decision", pattern: /too predictable|somewhere else|look at something else/i },
  { signal: "reason_shift", intent: "exploration", pattern: /we realized\b|mostly want to\b/i },
  { signal: "budget_first", intent: "planning", pattern: /figure out the (budget|cost|money|numbers) first|want to figure out the .{1,40} first/i },
  { signal: "spend_light", intent: "exploration", pattern: /don'?t want .{0,24}spend(ing)? too much|not spend too much/i },
  { signal: "tally", intent: "planning", pattern: /let'?s say (\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|\$\d+\s*each|\d+ people/i },
  { signal: "sketch", intent: "planning", pattern: /we could .{10,220}\bthen\b/i },
  { signal: "loose_contrast", intent: "exploration", pattern: /every hour|planning every|don'?t want .{0,40}(packed|itinerary)/i },
  { signal: "want_shape", intent: "exploration", pattern: /\bi just want\b|we don'?t want to spend the whole/i },
  { signal: "add_on", intent: "exploration", pattern: /^(exactly|yeah|right)\.\s+\S.{0,120}\btoo\b/i },
  { signal: "float_option", intent: "exploration", pattern: /\bmaybe somewhere\b/i },
  { signal: "agree", intent: "exploration", pattern: /^(yeah|yes|exactly|right)\.?$/i },
  { signal: "ambiguous", intent: "unclear", pattern: /i don'?t believe that anymore|i no longer believe that\b|i don'?t think that anymore/i },
  { signal: "stocktake", intent: "reflection", pattern: /what have we (actually )?(figured|worked) out/i },
  { signal: "frustrated", intent: "reflection", pattern: /frustrat|going in circles|around in circles|in circles|getting lost|i'?m lost\b|i'?m completely lost|where are we\b/i },
  { signal: "draft", intent: "writing", pattern: /\bjust write\b|\bwrite the (proposal|pitch|draft|description|readme)\b|\bdraft the\b|\bproject brief\b|\bturn (everything|this|it) into\b/i },
  { signal: "reflect", intent: "reflection", pattern: /why did we|how did we (arrive|get|end|choose)|originally choose|what did we decide|why did we reject/i },
  { signal: "compare", intent: "problem_solving", pattern: /what should (i|we) do\b|\bcompare\b/i },
  { signal: "perspective", intent: "problem_solving", pattern: /what do you think\b/i },
  { signal: "reversal", intent: "decision", pattern: /\bactually\b[\s\S]{0,80}\binstead\b|\blet'?s do\b[\s\S]{0,80}\binstead\b/i },
  { signal: "confirm", intent: "decision", pattern: /let'?s go with\b|we'?ll go with\b|let'?s start with\b/i },
  { signal: "brainstorm", intent: "exploration", pattern: /give me ideas|what (else )?could we build|ideas for what we could build/i },
  { signal: "challenge", intent: "problem_solving", pattern: /\bchallenge this\b|\bi think (we|i) should\b|\bdefinitely\b/i },
  { signal: "stuck", intent: "exploration", pattern: /i'?m stuck|not sure where to (go|start|take)|don'?t know where to (go|take|start)/i },
  { signal: "direction", intent: "exploration", pattern: /don'?t know what direction|what direction to take|which direction to take/i },
  { signal: "develop", intent: "exploration", pattern: /seem to (struggle|have)|most .{0,40}(get|receive)|run out before|students often|that makes (the |this )?(idea|problem)/i },
  { signal: "weighing", intent: "exploration", pattern: /maybe .{0,96}(although|but) .{0,96}(not sure|i'?m not sure|might be better)/i },
  { signal: "vague", intent: "exploration", pattern: /not sure if it'?s good|not sure if this is good|i have an idea but/i },
  { signal: "discover", intent: "exploration", pattern: /been thinking about|i want to build something|building something for|i have an idea\b/i },
  { signal: "blank", intent: "exploration", pattern: /don'?t have (the |an )?idea yet|this is the start|help me explore an idea\b|let'?s (just )?(think|brainstorm)\b|i want to (think|brainstorm)\b/i },
  { signal: "clarify", intent: "exploration", pattern: /the real problem is|what i mean is|more specifically/i },
  { signal: "uncertain", intent: "exploration", pattern: /i don'?t really know|i just feel like/i },
  { signal: "plan", intent: "planning", pattern: /give me a plan|how (would|do) we launch|let'?s figure out how|for the next two weeks|let'?s make a plan|we'?ve got the idea|enough thinking|let'?s build it\b|okay, enough thinking/i },
  { signal: "factual", intent: "question", pattern: /what does .{1,80} mean\??$|^(what is|who is|define)\b|should we use .{1,80} or /i },
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
