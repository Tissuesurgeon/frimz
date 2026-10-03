import { renderBriefForPrompt, type BriefField, type ContextBriefData } from "@/lib/context-brief";
import { WRITE_UP_FORMATS, matchWriteUpFormat, writeUpFormat, type WriteUpFormat } from "@/lib/write-up";
import { WRITE_UP_PROMPT } from "@/server/agent/prompts/write-up";
import type { LLMChunk, LLMMessage, LLMProvider } from "@/server/llm/llm-provider";
import type { MemoryRecord } from "@/server/memory/types";
import { messageForAnalysis, type StoredMessage } from "./transcript";

export type WriteUpPlan = {
  kind: "accept" | "request" | "revise";
  format: WriteUpFormat | null;
  previousDraft?: string;
};

export type WriteUpInput = {
  plan: WriteUpPlan;
  request: string;
  ideaTitle?: string;
  brief: { version: number; data: ContextBriefData; userFields: BriefField[] } | null;
  memories: MemoryRecord[];
  transcript: StoredMessage[];
};

export interface WriteUpGenerator {
  stream(input: WriteUpInput, signal?: AbortSignal): AsyncIterable<LLMChunk>;
}

const DECLINE =
  /^(no|nope|nah|not (now|yet|really|today|right now)|later|maybe later|no thanks|no thank you|i'?m good|all good|skip( it)?)\b/i;
const AFFIRM =
  /^(yes|yeah|yep|yup|sure|please|ok(ay)?|go ahead|do it|let'?s do it|sounds good|why not|absolutely|definitely|great|perfect|that would (be )?(great|helpful|useful|nice)|i'?d (like|love) that)\b/i;
const DOCUMENT = /\b(doc|document|write-?up|draft|outline|memo|email|post|page|deck|notes|readme|overview|one-?pager)\b/i;
const REQUESTS = [
  /\bwrite (this|it|that|everything|our thinking|the (idea|thinking)) up\b/i,
  /\bwrite-?up\b/i,
  /\b(write|draft|turn|put|make)\b[^.?!\n]{0,40}\b(into|as)\b[^.?!\n]{0,10}\b(a|an)\b[^.?!\n]{0,30}\b(brief|concept|statement|summary|proposal|strategy|document|doc|one-?pager|pitch|recap)\b/i,
  /\b(write|draft)( me| us| up)? (a|an|the) (project brief|product concept|problem statement|research summary|proposal|pitch|business concept|technical concept|strategy (doc|document)|thinking summary|meeting summary|one-?pager)\b/i,
];
const REVISE =
  /\b(make (it|this|the draft)|shorten|lengthen|condense|tighten|rewrite|reword|rephrase|more formal|less formal|simpler|plainer|in bullets?|bullet points|the (draft|doc|document|write-?up))\b|\b(add|remove|drop|cut|rename|change)\b[^.?!\n]{0,25}\b(section|paragraph|heading|title|bullets?|intro|opening|ending|tone)\b/i;

/** Decides whether this turn should produce or revise a written draft. */
export function planWriteUp(input: { message: string; previous: StoredMessage | null }): WriteUpPlan | null {
  const text = input.message.trim();
  const previous = input.previous?.role === "assistant" ? input.previous : null;
  const format = matchWriteUpFormat(text);

  if (previous?.metadata?.draftOffer) {
    if (DECLINE.test(text)) return null;
    if (AFFIRM.test(text) || format || DOCUMENT.test(text)) return { kind: "accept", format };
    return null;
  }

  const draft = previous?.metadata?.writeUp;
  if (draft && previous && text.length <= 400 && REVISE.test(text)) {
    return { kind: "revise", format: format ?? writeUpFormat(draft.format), previousDraft: previous.content };
  }

  if (REQUESTS.some((pattern) => pattern.test(text))) return { kind: "request", format };
  return null;
}

function formatLine(plan: WriteUpPlan) {
  if (plan.format && plan.format.id !== "custom") {
    return `Format: ${plan.format.label}. Follow this outline where the material supports it: ${plan.format.outline}`;
  }
  if (plan.kind === "revise") return "Format: keep the format of the previous draft.";
  return `Format: the form the user describes in their message. When they simply said yes, use the format Frimz offered first in its last message. Formats Frimz knows: ${WRITE_UP_FORMATS.map((format) => format.label).join(", ")}.`;
}

export function buildWriteUpMessages(input: WriteUpInput): LLMMessage[] {
  const lines = ["REQUEST", formatLine(input.plan), `The user's words: "${input.request}"`, ""];

  lines.push(input.brief ? `CURRENT CONTEXT BRIEF (version ${input.brief.version})` : "CURRENT CONTEXT BRIEF");
  lines.push(
    input.brief ? renderBriefForPrompt(input.brief.data, input.brief.userFields) : "None yet. Rely on the conversation and the memories.",
  );
  lines.push("");

  lines.push(input.ideaTitle ? `MEMORIES FOR ${input.ideaTitle.toUpperCase()}` : "MEMORIES");
  const memories = input.memories.filter((memory) => memory.status === "active" && memory.type !== "user_preference");
  if (memories.length === 0) lines.push("- None.");
  for (const memory of memories.slice(0, 40)) {
    lines.push(`- [${memory.type}] ${memory.content}${memory.reason ? ` Reason: ${memory.reason}` : ""}`);
  }
  lines.push("");

  lines.push("CONVERSATION (oldest first; USER is the person, FRIMZ is the assistant)");
  const transcript = input.transcript.filter(
    (message) => (message.role === "user" || message.role === "assistant") && !message.metadata?.error,
  );
  if (transcript.length === 0) lines.push("(No earlier messages.)");
  for (const message of transcript.slice(-30)) {
    lines.push(`${message.role === "user" ? "USER" : "FRIMZ"}: ${messageForAnalysis(message)}`);
  }

  if (input.plan.kind === "revise" && input.plan.previousDraft) {
    lines.push("", "PREVIOUS DRAFT", input.plan.previousDraft, "", "Revise the previous draft as the user asked. Keep the rest of it as it is.");
  }

  return [
    { role: "system", content: WRITE_UP_PROMPT },
    { role: "user", content: lines.join("\n") },
  ];
}

export class LLMWriteUpGenerator implements WriteUpGenerator {
  constructor(private readonly provider: LLMProvider) {}

  stream(input: WriteUpInput, signal?: AbortSignal) {
    return this.provider.stream({ messages: buildWriteUpMessages(input), signal });
  }
}
