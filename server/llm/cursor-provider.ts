import { mkdir } from "fs/promises";
import path from "path";
import { appendAssistantText, toPrompt, type LLMChunk, type LLMProvider, type LLMRequest } from "./llm-provider";
import { buildCursorAgentOptions } from "./cursor-options";

type CursorRun = {
  stream: () => AsyncIterable<unknown>;
  wait: () => Promise<unknown>;
  cancel?: () => Promise<void>;
  supports?: (op: string) => boolean;
};

type CursorAgent = {
  send: (prompt: string) => Promise<CursorRun>;
  [Symbol.asyncDispose]?: () => Promise<void>;
};

export type CursorAgentFactory = (options: ReturnType<typeof buildCursorAgentOptions>) => Promise<CursorAgent>;

async function defaultFactory(options: ReturnType<typeof buildCursorAgentOptions>) {
  const sdk = (await import("@cursor/sdk")) as {
    Agent: { create: (options: unknown) => Promise<CursorAgent> };
  };
  return sdk.Agent.create(options);
}

function textFromEvent(event: unknown) {
  if (!event || typeof event !== "object") return "";
  const message = event as {
    type?: string;
    message?: { content?: Array<{ type?: string; text?: string }> };
  };
  if (message.type !== "assistant" || !message.message?.content) return "";
  return message.message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

export class CursorLLMProvider implements LLMProvider {
  constructor(
    private readonly options: {
      factory?: CursorAgentFactory;
      apiKey?: string;
      model?: string;
      cwd?: string;
    } = {},
  ) {}

  async generate(request: LLMRequest) {
    let text = "";
    for await (const chunk of this.stream(request)) text += chunk.text;
    return { text };
  }

  async *stream(request: LLMRequest): AsyncIterable<LLMChunk> {
    const apiKey = this.options.apiKey ?? process.env.CURSOR_API_KEY;
    if (!apiKey) throw new Error("CURSOR_API_KEY is not set");
    const cwd = this.options.cwd ?? path.join(process.cwd(), ".frimz-sandbox");
    await mkdir(cwd, { recursive: true });
    const factory = this.options.factory ?? defaultFactory;
    const agent = await factory(
      buildCursorAgentOptions({
        apiKey,
        model: this.options.model ?? process.env.CURSOR_MODEL ?? "composer-2.5",
        cwd,
      }),
    );
    const run = await agent.send(toPrompt(request.messages));
    const onAbort = () => {
      if (run.supports?.("cancel") && run.cancel) void run.cancel();
    };
    request.signal?.addEventListener("abort", onAbort);
    let accumulated = "";
    try {
      for await (const event of run.stream()) {
        if (request.signal?.aborted) break;
        const next = appendAssistantText(accumulated, textFromEvent(event));
        accumulated = next.accumulated;
        if (next.delta) yield { text: next.delta };
      }
      if (!request.signal?.aborted) await run.wait();
    } finally {
      request.signal?.removeEventListener("abort", onAbort);
      await agent[Symbol.asyncDispose]?.();
    }
  }
}

export function getLLMProvider() {
  return new CursorLLMProvider();
}
