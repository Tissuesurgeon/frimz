import type { ConversationStrategy, ConversationalMove } from "../conversation-types";

const MOVES: Record<ConversationalMove, string> = {
  answer: "Answer in a sentence or two. Do not turn it into a lesson.",
  ask: "Add one observation, then one question.",
  clarify: "Say the sharper version in one sentence, then one question.",
  explore: "Add one adjacent thought. Leave the choice open. Do not explain their idea back.",
  challenge: "Name the assumption in a sentence, then one other way to see it.",
  compare: "Name the real tradeoff in a few sentences. Do not pick a winner.",
  connect: "Bring in the relevant earlier context as reasoning, without labeling it as a memory lookup.",
  confirm: "Recognize the decision they just made. Do not reopen it.",
  synthesize: "Name what is already settled, in a sentence or two.",
  reflect: "Say how the thinking moved. Skip the tour.",
  plan: "Offer a short sequence they can react to. Do not lock a decision.",
  draft: "Write the piece they asked for.",
  summarize: "Close in a sentence or two. Do not recap the whole thread.",
};

export function renderConversationStrategy(strategy: ConversationStrategy) {
  const lines = [
    "THIS TURN",
    "These labels are internal. Do not mention them, and do not mention memory ids.",
    `Move: ${strategy.conversationalMove}. ${MOVES[strategy.conversationalMove]}`,
  ];
  if (strategy.reasoningFocus) lines.push(strategy.reasoningFocus);
  lines.push(
    strategy.shouldAskQuestion
      ? "You may ask one question, after you have contributed something."
      : "Do not ask a question in this reply.",
  );
  lines.push(
    strategy.shouldUseMemory
      ? "Use only the memories selected for this turn. Weave them in as reasoning. Do not invent steps that are not in that history."
      : "Do not invent earlier conversations. If the needed history is absent, say so.",
  );
  lines.push("Talk with them. Do not explain what they just said.");
  lines.push("The user owns the decision.");
  return lines.join("\n");
}
