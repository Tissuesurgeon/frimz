import type { MessageMetadata } from "@/db/schema";
import { writeUpFormat } from "@/lib/write-up";
import type { TranscriptLine } from "./brief-guards";

export type StoredMessage = {
  role: string;
  content: string;
  metadata?: MessageMetadata | null;
  createdAt?: Date | string;
};

const MESSAGE_LIMIT = 4000;

/** Drafts are Frimz's own prose, so memory and brief updates see a one-line stand-in. */
export function messageForAnalysis(message: StoredMessage) {
  const draft = message.role === "assistant" ? message.metadata?.writeUp : undefined;
  if (draft) return `[Frimz drafted a ${writeUpFormat(draft.format).label.toLowerCase()} from the current thinking.]`;
  return message.content;
}

export function toTranscriptLines(messages: StoredMessage[], limit = 30): TranscriptLine[] {
  return messages
    .filter((message) => (message.role === "user" || message.role === "assistant") && !message.metadata?.error)
    .slice(-limit)
    .map((message) => ({
      role: message.role as TranscriptLine["role"],
      content: messageForAnalysis(message).slice(0, MESSAGE_LIMIT),
      createdAt: message.createdAt ? new Date(message.createdAt).toISOString() : undefined,
    }));
}
