import type { ConversationStrategy } from "./conversation-types";

const FRAMEWORK =
  /problem statement|target persona|here are (five|5)|let'?s identify the problem|five (areas|directions|categories)/i;

const ASSISTANT_TELL =
  /valuable insight|let'?s unpack|great point|you'?re absolutely right|several dimensions|the key signal|based on your response|\babsolutely\b/i;

/** Cheap check against the orchestration budget. Not a second model. */
export function orchestrationViolations(text: string, strategy: ConversationStrategy) {
  const issues: string[] = [];
  const questions = (text.match(/\?/g) ?? []).length;
  if (questions > strategy.questionCount) issues.push("too_many_questions");
  if (!strategy.shouldStructure && FRAMEWORK.test(text)) issues.push("unwanted_framework");
  if (ASSISTANT_TELL.test(text)) issues.push("assistant_tell");
  for (const exclusion of strategy.exclusions) {
    const token = exclusion.split(/\s+/).find((word) => word.length > 4);
    if (token && new RegExp(`\\b${token}\\b`, "i").test(text)) issues.push("violates_exclusion");
  }
  return issues;
}
