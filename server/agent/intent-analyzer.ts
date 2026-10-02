import type { ConversationalIntent, IntentSignal } from "./conversation-types";

export type IntentAnalysis = {
  signal: IntentSignal;
  intent: ConversationalIntent;
  explicit: boolean;
};

const RULES: Array<{ signal: IntentSignal; intent: ConversationalIntent; pattern: RegExp }> = [
  { signal: "frustrated", intent: "reflection", pattern: /frustrat|going in circles|around in circles|in circles/i },
  { signal: "draft", intent: "writing", pattern: /\bjust write\b|\bwrite the (proposal|pitch|draft|description)\b|\bdraft the\b/i },
  { signal: "reflect", intent: "reflection", pattern: /why did we|how did we (arrive|get|end|choose)|originally choose/i },
  { signal: "compare", intent: "problem_solving", pattern: /what should (i|we) do\b/i },
  { signal: "perspective", intent: "problem_solving", pattern: /what do you think\b/i },
  { signal: "reversal", intent: "decision", pattern: /\bactually\b[\s\S]{0,80}\binstead\b|\blet'?s do\b[\s\S]{0,80}\binstead\b/i },
  { signal: "confirm", intent: "decision", pattern: /let'?s go with\b|we'?ll go with\b/i },
  { signal: "challenge", intent: "problem_solving", pattern: /\bi think (we|i) should\b|\bdefinitely\b/i },
  { signal: "direction", intent: "exploration", pattern: /don'?t know what direction|what direction to take|which direction to take/i },
  { signal: "vague", intent: "exploration", pattern: /not sure if it'?s good|not sure if this is good|i have an idea but/i },
  { signal: "clarify", intent: "exploration", pattern: /the real problem is|what i mean is|more specifically/i },
  { signal: "discover", intent: "exploration", pattern: /been thinking about|i want to build something|i have an idea\b/i },
  { signal: "plan", intent: "planning", pattern: /give me a plan|how (would|do) we launch|let'?s figure out how|for the next two weeks/i },
  { signal: "factual", intent: "question", pattern: /what does .{1,80} mean\??$|^(what is|who is|define)\b/i },
];

export function analyzeIntent(message: string): IntentAnalysis {
  const text = message.trim();
  if (/^what should (i|we) do\b/i.test(text) || /^what do you think\b/i.test(text)) {
    const rule = RULES.find((item) => item.pattern.test(text) && (item.signal === "compare" || item.signal === "perspective"));
    if (rule) return { signal: rule.signal, intent: rule.intent, explicit: true };
  }
  for (const rule of RULES) {
    if (rule.signal === "factual" && text.length > 120) continue;
    if (rule.pattern.test(text)) return { signal: rule.signal, intent: rule.intent, explicit: true };
  }
  if (text.length < 24 && /^(hi|hello|hey|thanks|thank you)\b/i.test(text)) {
    return { signal: "unclear", intent: "casual", explicit: false };
  }
  return { signal: "unclear", intent: "unclear", explicit: false };
}
