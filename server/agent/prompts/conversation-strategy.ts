import type { ConversationStrategy, ConversationalMove } from "../conversation-types";

const MOVES: Record<ConversationalMove, string> = {
  answer: "Answer directly.",
  ask: "Ask one useful question after a short observation.",
  clarify: "Name the clearer statement, then one question.",
  explore: "Widen the thought a little. Leave the choice open.",
  challenge: "Acknowledge the thought, name the assumption, and offer another way to see it.",
  compare: "Make the tradeoffs explicit. Do not pick a winner.",
  connect: "Bring in the relevant earlier context as reasoning, without labeling it as a memory lookup.",
  confirm: "Recognize the decision they just made. Do not reopen it.",
  synthesize: "Pull together what is already established.",
  reflect: "Describe how the thinking changed.",
  plan: "Lay out a short sequence. Do not lock a decision.",
  draft: "Write the piece they asked for.",
  summarize: "Restate the current picture in a few sentences.",
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
  lines.push("The user owns the decision.");
  return lines.join("\n");
}
