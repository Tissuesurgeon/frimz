import type { ConversationStrategy, ConversationalMove } from "../conversation-types";

const MOVES: Record<ConversationalMove, string> = {
  answer: "Answer the question. If the current work makes it concrete, add one sentence. Do not turn it into an interview.",
  ask: "One question that helps them think. On a blank start, do not preface it with a method.",
  clarify: "One framing, then one question, and another door they can take. No feature list.",
  explore: "Understand, contribute one useful step, leave room to react. Do not restate them. No automatic frameworks, category lists, or numbered menus. While exploring, do not push MVP, roadmap, or business model unless they do.",
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
  const shortOpen = strategy.thinkingStage === "discover" && strategy.responseDepth === "short" && strategy.questionCount === 1;
  const lines = [
    "THIS TURN",
    "These labels are internal. Do not mention them, and do not mention memory ids.",
    shortOpen
      ? "Move: explore. Yeah, that's okay. One sentence that the idea does not have to be figured out yet. Then one question about what got them thinking about it. Stop."
      : `Move: ${strategy.conversationalMove}. ${MOVES[strategy.conversationalMove]}`,
  ];
  if (strategy.reasoningFocus) lines.push(strategy.reasoningFocus);
  lines.push(
    strategy.bareQuestion
      ? "Ask one question. Do not preface it."
      : shortOpen
        ? "Stop after the question. Do not illustrate how they might answer."
        : strategy.shouldAskQuestion
          ? "You may ask one question, after the one thing you added."
          : "Do not ask a question in this reply.",
  );
  lines.push(
    strategy.shouldUseMemory
      ? "Use only the memories selected for this turn. Weave them in as reasoning. Do not invent steps that are not in that history."
      : "Do not invent earlier conversations. If the needed history is absent, say so.",
  );
  if (strategy.exclusions.length > 0) {
    lines.push(`Do not discuss: ${strategy.exclusions.join("; ")}.`);
  }
  if (strategy.userDirection) lines.push(`Current direction from this message: ${strategy.userDirection}.`);
  lines.push(
    `Depth: ${strategy.responseDepth}. Questions allowed: ${strategy.questionCount}. Structure: ${strategy.shouldStructure ? "only if it helps" : "no"}.`,
  );
  if (!shortOpen) lines.push("Understand, contribute, leave room. Do not finish their thinking for them.");
  lines.push("Talk with them. Do not explain what they just said.");
  lines.push("The user owns the decision.");
  return lines.join("\n");
}
