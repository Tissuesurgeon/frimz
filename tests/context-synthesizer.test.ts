import { describe, expect, it, vi } from "vitest";
import { CONTEXT_REBUILD_NOTE, CONTEXT_SYNTHESIS_PROMPT } from "@/server/agent/prompts/context-synthesis";
import {
  LLMContextSynthesizer,
  buildSynthesisMessages,
  parseSynthesis,
  type SynthesisInput,
} from "@/server/context/context-synthesizer";
import type { LLMProvider, LLMRequest } from "@/server/llm/llm-provider";
import type { MemoryRecord } from "@/server/memory/types";

function memory(partial: Pick<MemoryRecord, "id" | "type" | "content"> & Partial<MemoryRecord>): MemoryRecord {
  return {
    userId: "user-a",
    blobId: partial.id,
    namespace: "frimz-user-user-a",
    status: "active",
    reason: "",
    importance: 0.8,
    ideaId: "idea-a",
    ideaTitle: "Study partner",
    supersedesId: null,
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...partial,
  };
}

const input: SynthesisInput = {
  idea: { title: "Study partner", description: "Helps students keep the thread between sessions." },
  existing: { version: 2, data: { problem: "Students lose the thread" }, userFields: ["problem"] },
  conversation: [
    { role: "user", content: "Let's start with individual students." },
    { role: "assistant", content: "That keeps the feedback loop short." },
  ],
  memories: [
    memory({ id: "m1", type: "decision", content: "Start with individual students.", reason: "Faster feedback" }),
    memory({ id: "m2", type: "rejection", content: "Sell to universities first.", status: "forgotten" }),
    memory({ id: "m3", type: "user_preference", content: "Prefers short answers." }),
  ],
};

describe("context synthesizer", () => {
  it("labels who said what and sends only active idea memories", () => {
    const [system, prompt] = buildSynthesisMessages(input);
    expect(system).toEqual({ role: "system", content: CONTEXT_SYNTHESIS_PROMPT });
    expect(prompt.content).toContain("CURRENT BRIEF (version 2)");
    expect(prompt.content).toContain("CORRECTED BY THE USER\n- problem");
    expect(prompt.content).toContain("USER: Let's start with individual students.");
    expect(prompt.content).toContain("FRIMZ: That keeps the feedback loop short.");
    expect(prompt.content).toContain("- [decision] Start with individual students. Reason: Faster feedback");
    expect(prompt.content).not.toContain("Sell to universities first.");
    expect(prompt.content).not.toContain("Prefers short answers.");
    expect(prompt.content).not.toContain(CONTEXT_REBUILD_NOTE);
  });

  it("asks for a first version and notes a rebuild", () => {
    const [, prompt] = buildSynthesisMessages({ ...input, existing: null, rebuild: true });
    expect(prompt.content).toContain("None yet. This will be the first version.");
    expect(prompt.content).toContain(CONTEXT_REBUILD_NOTE);
  });

  it("parses a fenced reply into normalized brief data", () => {
    const result = parseSynthesis(
      [
        "```json",
        JSON.stringify({
          changed: true,
          changeSummary: "Target user narrowed",
          brief: { targetUser: "Individual students", goal: "TBD", decisions: ["Start with individual students"] },
          removed: [
            { section: "decisions", text: "Sell to universities first", why: "Slow sales cycle" },
            { section: "problem", text: "Ignored section" },
          ],
        }),
        "```",
      ].join("\n"),
    );
    expect(result).toEqual({
      changed: true,
      changeSummary: "Target user narrowed",
      data: { targetUser: "Individual students", decisions: [{ text: "Start with individual students" }] },
      removed: [{ section: "decisions", text: "Sell to universities first", why: "Slow sales cycle" }],
    });
  });

  it("finds the JSON inside surrounding text and reads a declined change", () => {
    const result = parseSynthesis('Here is the update: {"changed": false, "brief": {}} Done.');
    expect(result?.changed).toBe(false);
    expect(result?.data).toEqual({});
  });

  it("rejects a reply without a brief", () => {
    expect(parseSynthesis("I could not do that.")).toBeNull();
    expect(parseSynthesis('{"changed": true}')).toBeNull();
  });

  it("calls the provider once and fails loudly on an unreadable reply", async () => {
    const generate = vi.fn(async (request: LLMRequest) => {
      void request;
      return { text: '{"changed": true, "brief": {"problem": "Students lose the thread"}}' };
    });
    const provider: LLMProvider = { generate, stream: vi.fn() };
    const synthesizer = new LLMContextSynthesizer(provider);
    const result = await synthesizer.updateContext(input);
    expect(result.data).toEqual({ problem: "Students lose the thread" });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0].messages[0].content).toBe(CONTEXT_SYNTHESIS_PROMPT);

    generate.mockResolvedValueOnce({ text: "not json" });
    await expect(synthesizer.updateContext(input)).rejects.toThrow(/not valid JSON/);
  });
});
