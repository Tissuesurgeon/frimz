import { describe, expect, it } from "vitest";
import { parseExtraction, validateMemories } from "@/server/memory/memory-validator";

describe("memory extraction", () => {
  it("keeps decisions, rejections, preferences, insights, and open questions", () => {
    const draft = parseExtraction(`{
      "memories": [
        {"type":"decision","content":"User wants to target individual students first.","reason":"Faster feedback.","importance":0.9,"ideaTitle":"Study partner"},
        {"type":"rejection","content":"User rejected generic AI tutoring.","reason":"Wanted differentiation.","importance":0.8,"ideaTitle":"Study partner"},
        {"type":"user_preference","content":"User prefers 3-5 alternatives rather than one recommendation.","importance":0.7},
        {"type":"insight","content":"Persistent learning context is the useful difference.","importance":0.8,"ideaTitle":"Study partner","changesIdea":true},
        {"type":"open_question","content":"Which distribution channel should come first?","importance":0.6,"ideaTitle":"Study partner"},
        {"type":"decision","content":"hello","importance":0.9},
        {"type":"decision","content":"This is too vague to keep.","importance":0.1}
      ]
    }`);
    const memories = validateMemories(draft);
    expect(memories.map((memory) => memory.type)).toEqual([
      "decision",
      "rejection",
      "user_preference",
      "insight",
      "open_question",
    ]);
  });

  it("rejects invalid JSON without throwing", () => {
    expect(parseExtraction("not json").memories).toEqual([]);
  });
});
