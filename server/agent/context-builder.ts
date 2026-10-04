import { isEmptyBrief, renderBriefForPrompt, type BriefField, type ContextBriefData } from "@/lib/context-brief";
import type { MemoryRecord } from "@/server/memory/types";
import type { ConversationStrategy } from "./conversation-types";
import { renderConversationStrategy } from "./prompts/conversation-strategy";

export type ContextBriefInput = {
  version: number;
  data: ContextBriefData;
  userFields: BriefField[];
};

export type ContextInput = {
  preferences: MemoryRecord[];
  memories: MemoryRecord[];
  ideaTitle?: string;
  ideaDescription?: string;
  brief?: ContextBriefInput | null;
  transcript: { role: string; content: string }[];
  userMessage: string;
  strategy?: ConversationStrategy;
};

function section(lines: string[], title: string, items: string[]) {
  lines.push(title);
  if (items.length === 0) lines.push("- None.");
  else for (const item of items) lines.push(`- ${item}`);
  lines.push("");
}

function line(memory: MemoryRecord) {
  const reason = memory.reason ? ` Reason: ${memory.reason}` : "";
  return `[${memory.type}] ${memory.content}${reason}`;
}

export function buildFrimzContext(input: ContextInput) {
  const fresh = input.strategy?.freshStart === true;
  const preferences = input.preferences.filter((memory) => memory.type === "user_preference" && memory.status === "active");
  const active = fresh
    ? []
    : input.memories.filter((memory) => memory.status === "active" && memory.type !== "user_preference");
  const ofType = (type: MemoryRecord["type"]) => active.filter((memory) => memory.type === type).map(line);
  const lines = ["FRIMZ CONTEXT", ""];

  if (!fresh && input.brief && !isEmptyBrief(input.brief.data)) {
    lines.push(`CURRENT CONTEXT BRIEF (version ${input.brief.version})`);
    lines.push(
      "The working understanding of this work. It informs this reply but does not override the user's latest explicit intent in the latest message.",
    );
    lines.push("");
    lines.push(renderBriefForPrompt(input.brief.data, input.brief.userFields));
    lines.push("");
  }

  lines.push("CURRENT IDEA");
  lines.push(!fresh && input.ideaTitle ? input.ideaTitle : "None identified yet.");
  if (!fresh && input.ideaDescription) lines.push(input.ideaDescription);
  lines.push("");

  section(lines, "DECISIONS", ofType("decision"));
  section(lines, "REJECTED DIRECTIONS", ofType("rejection"));
  section(lines, "OPEN QUESTIONS", ofType("open_question"));
  section(lines, "IDEA CHANGES", ofType("idea_change"));

  lines.push("WORKING STYLE");
  if (preferences.length === 0) lines.push("- No stored working-style preferences. Stay neutral.");
  else {
    lines.push("Use these as behavior. Do not quote them back as memories.");
    for (const preference of preferences) lines.push(`- ${preference.content}`);
  }
  lines.push("");

  section(
    lines,
    "OTHER RELEVANT MEMORIES",
    active.filter((memory) => memory.type === "idea" || memory.type === "insight").map(line),
  );

  lines.push("CURRENT CONVERSATION");
  const transcript = input.transcript.slice(-30);
  if (transcript.length === 0) lines.push("(This is the start of the conversation.)");
  else {
    for (const message of transcript) lines.push(`${message.role}: ${message.content}`);
  }
  lines.push("");
  lines.push("LATEST USER MESSAGE");
  lines.push(input.userMessage);
  if (input.strategy?.exclusions.length) {
    lines.push("");
    lines.push("ACTIVE CONSTRAINT");
    lines.push(`Do not discuss: ${input.strategy.exclusions.join("; ")}. Follow this over the brief.`);
  }
  if (input.strategy) {
    lines.push("");
    lines.push(renderConversationStrategy(input.strategy));
  }
  return lines.join("\n");
}
