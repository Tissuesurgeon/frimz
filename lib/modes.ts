export const MODES = [
  { id: "think", label: "Think", hint: "Explore possibilities." },
  { id: "plan", label: "Plan", hint: "Turn thinking into a structured direction." },
  { id: "write", label: "Write", hint: "Turn ideas into polished output." },
  { id: "challenge", label: "Challenge", hint: "Question assumptions and expose alternatives." },
] as const;

export type Mode = (typeof MODES)[number]["id"];

export function parseMode(value: unknown): Mode {
  if (typeof value === "string" && MODES.some((mode) => mode.id === value)) {
    return value as Mode;
  }
  return "think";
}
