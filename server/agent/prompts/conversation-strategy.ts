import type { ConversationStrategy, ConversationalMove } from "../conversation-types";

const MOVES: Record<ConversationalMove, string> = {
  answer: "Answer the question. If the current work makes it concrete, add one sentence. Do not turn it into an interview.",
  ask: "One question that helps them think. On a blank start, do not preface it with a method.",
  clarify: "One framing, then one question, and another door they can take. No feature list.",
  explore: "Add one distinction that develops their point. Do not agree by restating them, and do not produce a feature list.",
  challenge: "Name the assumption, say why it matters, and offer a clearer framing. They decide. If they disagree, drop your previous view and build on theirs.",
  compare: "Compare and synthesize: value, strength, and risk on each side. Note if they combine. One optional next step. Do not pick a winner.",
  connect: "Bring in the relevant earlier context as reasoning, without labeling it as a memory lookup.",
  confirm: "Reflect the decision they just made and the reason they gave. Do not claim you decided. Do not reopen it.",
  synthesize: "Name what is already settled and the tradeoff underneath. Do not ask another question.",
  reflect: "Say how the thinking moved, from the stored history only. Skip the tour.",
  plan: "Offer a short sequence they can mark up. Do not lock a decision.",
  draft: "Write the piece they asked for. Mark a missing fact instead of inventing it or asking a tour of questions.",
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
    strategy.bareQuestion
      ? "Ask one question. Do not preface it."
      : strategy.shouldAskQuestion
        ? "You may ask one question, after the one thing you added."
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
