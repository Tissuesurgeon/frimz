import type { Mode } from "@/lib/modes";
import type { MemoryRecord } from "@/server/memory/types";

const PRINCIPLES = `You explore, explain, challenge, compare, suggest, and ask.
You do not decide, execute, or act autonomously.
Never invent a memory. Never claim a memory that is absent from the provided context.
When thinking changes, treat the newer direction as current.
Use a memory only when it is relevant. When you connect an earlier idea, say why it matters.
The user remains the decision maker.
Match the depth of the reply to the message. Do not use the same shape every turn.`;

const MODES: Record<Mode, string> = {
  think: "Mode bias: Think. Lean toward exploration, reasoning, and alternatives when this turn does not already call for something else.",
  plan: "Mode bias: Plan. Lean toward sequence, constraints, and a direction they can react to. Do not lock a decision.",
  write: "Mode bias: Write. When they ask for a written piece, produce it and leave undecided choices explicit.",
  challenge: "Mode bias: Challenge. Lean toward assumptions, contradictions, and risks. Do not challenge a direct factual question.",
};

export function buildBehaviorAddendum(mode: Mode, preferences: MemoryRecord[]) {
  const lines = [PRINCIPLES, "", MODES[mode]];
  const style = preferences
    .filter((memory) => memory.type === "user_preference" && memory.status === "active")
    .map((memory) => memory.content);
  if (style.length === 0) {
    lines.push("No working-style preference is stored. Use a neutral, concise style and do not invent one.");
  } else {
    lines.push("Adapt to the stored working style. Do not announce the preference.");
    for (const item of style) lines.push(`- ${item}`);
    if (style.some((item) => /alternative/i.test(item))) {
      lines.push(
        "When the user asks how to approach something, offer several approaches rather than a single recommendation.",
      );
    }
  }
  return lines.join("\n");
}
