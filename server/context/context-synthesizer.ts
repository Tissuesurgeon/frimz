import {
  BRIEF_ITEM_MAX,
  BRIEF_REASON_MAX,
  cleanBriefText,
  normalizeBrief,
  type BriefField,
  type ContextBriefData,
} from "@/lib/context-brief";
import { CONTEXT_REBUILD_NOTE, CONTEXT_SYNTHESIS_PROMPT } from "@/server/agent/prompts/context-synthesis";
import type { LLMMessage, LLMProvider } from "@/server/llm/llm-provider";
import type { MemoryRecord } from "@/server/memory/types";
import type { RemovedItem, RetiredSection, TranscriptLine } from "./brief-guards";

export type SynthesisInput = {
  idea: { title: string; description: string };
  existing: { data: ContextBriefData; version: number; userFields: BriefField[] } | null;
  conversation: TranscriptLine[];
  memories: MemoryRecord[];
  rebuild?: boolean;
};

export type SynthesisResult = {
  changed: boolean;
  changeSummary: string;
  data: ContextBriefData;
  removed: RemovedItem[];
};

export interface ContextSynthesizer {
  updateContext(input: SynthesisInput): Promise<SynthesisResult>;
}

const MEMORY_LIMIT = 40;
const RETIRED: RetiredSection[] = ["decisions", "rejectedDirections", "openQuestions"];

export function buildSynthesisMessages(input: SynthesisInput): LLMMessage[] {
  const lines = ["IDEA", input.idea.title];
  if (input.idea.description) lines.push(input.idea.description);
  lines.push("");

  if (input.existing && input.existing.version > 0) {
    lines.push(`CURRENT BRIEF (version ${input.existing.version})`, JSON.stringify(input.existing.data, null, 2), "");
    lines.push("CORRECTED BY THE USER");
    if (input.existing.userFields.length === 0) lines.push("- None.");
    else for (const field of input.existing.userFields) lines.push(`- ${field}`);
  } else {
    lines.push("CURRENT BRIEF", "None yet. This will be the first version.");
  }
  lines.push("");

  lines.push("MEMORIES FOR THIS IDEA");
  const memories = input.memories
    .filter((memory) => memory.status === "active" && memory.type !== "user_preference")
    .slice(0, MEMORY_LIMIT);
  if (memories.length === 0) lines.push("- None.");
  for (const memory of memories) {
    lines.push(`- [${memory.type}] ${memory.content}${memory.reason ? ` Reason: ${memory.reason}` : ""}`);
  }
  lines.push("");

  lines.push("CONVERSATION (oldest first; USER is the person, FRIMZ is the assistant)");
  if (input.conversation.length === 0) lines.push("(No messages.)");
  for (const line of input.conversation) lines.push(`${line.role === "user" ? "USER" : "FRIMZ"}: ${line.content}`);
  if (input.rebuild) lines.push("", CONTEXT_REBUILD_NOTE);

  return [
    { role: "system", content: CONTEXT_SYNTHESIS_PROMPT },
    { role: "user", content: lines.join("\n") },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

export function parseSynthesis(text: string): SynthesisResult | null {
  const value = extractJson(text);
  if (!isRecord(value) || !isRecord(value.brief)) return null;
  const removed: RemovedItem[] = [];
  for (const entry of Array.isArray(value.removed) ? value.removed : []) {
    if (!isRecord(entry) || !RETIRED.includes(entry.section as RetiredSection)) continue;
    const text = cleanBriefText(entry.text, BRIEF_ITEM_MAX);
    if (text) removed.push({ section: entry.section as RetiredSection, text, why: cleanBriefText(entry.why, BRIEF_REASON_MAX) });
  }
  return {
    changed: value.changed !== false,
    changeSummary: cleanBriefText(value.changeSummary, 80),
    data: normalizeBrief(value.brief),
    removed,
  };
}

export class LLMContextSynthesizer implements ContextSynthesizer {
  constructor(private readonly provider: LLMProvider) {}

  async updateContext(input: SynthesisInput) {
    const response = await this.provider.generate({ messages: buildSynthesisMessages(input) });
    const result = parseSynthesis(response.text);
    if (!result) throw new Error("The synthesis reply was not valid JSON.");
    return result;
  }
}
