export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  messages: LLMMessage[];
  signal?: AbortSignal;
};

export type LLMResponse = {
  text: string;
};

export type LLMChunk = {
  text: string;
};

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<LLMChunk>;
}

export function toPrompt(messages: LLMMessage[]) {
  return messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
}

export function appendAssistantText(accumulated: string, incoming: string) {
  if (!incoming) return { accumulated, delta: "" };
  if (incoming.startsWith(accumulated)) {
    return { accumulated: incoming, delta: incoming.slice(accumulated.length) };
  }
  if (accumulated.endsWith(incoming)) return { accumulated, delta: "" };
  return { accumulated: accumulated + incoming, delta: incoming };
}
