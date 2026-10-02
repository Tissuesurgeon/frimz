import { describe, expect, it, vi } from "vitest";
import { buildCursorAgentOptions } from "@/server/llm/cursor-options";
import { appendAssistantText } from "@/server/llm/llm-provider";
import { CursorLLMProvider } from "@/server/llm/cursor-provider";

describe("cursor provider", () => {
  it("asks for a tool-less local agent and does not resume one", () => {
    const options = buildCursorAgentOptions({
      apiKey: "server-only",
      model: "composer-2.5",
      cwd: "/tmp/frimz-sandbox",
    });
    expect(options.tools).toEqual([]);
    expect(options.local.settingSources).toEqual([]);
    expect(options).not.toHaveProperty("resume");
  });

  it("creates a fresh agent for each request", async () => {
    const factory = vi.fn(async () => ({
      send: vi.fn(async () => ({
        stream: async function* () {
          yield { type: "assistant", message: { content: [{ type: "text", text: "Hello" }] } };
        },
        wait: vi.fn(async () => ({ status: "finished" })),
        supports: () => false,
      })),
      [Symbol.asyncDispose]: vi.fn(async () => undefined),
    }));
    const provider = new CursorLLMProvider({
      factory,
      apiKey: "test",
      model: "composer-2.5",
      cwd: "/tmp/frimz-sandbox",
    });
    const first = await provider.generate({ messages: [{ role: "user", content: "One" }] });
    const second = await provider.generate({ messages: [{ role: "user", content: "Two" }] });
    expect(first.text).toBe("Hello");
    expect(second.text).toBe("Hello");
    expect(factory).toHaveBeenCalledTimes(2);
    expect(appendAssistantText("Hel", "Hello").delta).toBe("lo");
  });
});
