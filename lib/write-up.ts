export type WriteUpFormat = {
  id: string;
  label: string;
  outline: string;
};

export const WRITE_UP_FORMATS: readonly WriteUpFormat[] = [
  {
    id: "project_brief",
    label: "Project brief",
    outline: "Overview, problem, who it is for, goal, approach, decisions with reasons, open questions, next steps.",
  },
  {
    id: "product_concept",
    label: "Product concept",
    outline: "Concept in a paragraph, problem, who it is for, core experience, what sets it apart, decisions, open questions.",
  },
  {
    id: "problem_statement",
    label: "Problem statement",
    outline: "The problem, who has it, why it matters, what is known, what is still uncertain.",
  },
  {
    id: "research_summary",
    label: "Research summary",
    outline: "The question, what was explored, findings, assumptions to test, open questions.",
  },
  {
    id: "proposal",
    label: "Proposal",
    outline: "Summary, problem, proposed approach, why this approach, directions set aside, scope, open questions, next steps.",
  },
  {
    id: "business_concept",
    label: "Business concept",
    outline: "Opportunity, customer, value, business model only where discussed, risks, open questions.",
  },
  {
    id: "technical_concept",
    label: "Technical concept",
    outline: "Overview, components, key technical decisions, constraints, risks, open questions.",
  },
  {
    id: "strategy_document",
    label: "Strategy document",
    outline: "Context, goal, chosen direction, directions set aside, priorities, risks, open questions.",
  },
  {
    id: "thinking_summary",
    label: "Thinking summary",
    outline: "Where the thinking started, what changed, what was decided, what remains open.",
  },
];

export const CUSTOM_WRITE_UP: WriteUpFormat = {
  id: "custom",
  label: "Custom write-up",
  outline: "The shape the user asked for.",
};

const MATCHERS: Array<[string, RegExp]> = [
  ["problem_statement", /\bproblem statement\b/i],
  ["research_summary", /\bresearch (summary|notes?|write-?up)\b/i],
  ["product_concept", /\bproduct (concept|doc(ument)?|overview)\b/i],
  ["business_concept", /\bbusiness (concept|plan|model|case|overview)\b/i],
  ["technical_concept", /\btechnical (concept|spec|design|overview|doc(ument)?)\b|\btech spec\b|\barchitecture (doc|overview)\b/i],
  ["strategy_document", /\bstrategy\b/i],
  ["proposal", /\bproposal\b|\bpitch\b/i],
  ["thinking_summary", /\b(thinking|meeting|session) summary\b|\bsummary\b|\brecap\b/i],
  ["project_brief", /\bproject brief\b|\bbrief\b|\bone-?pager\b/i],
];

export function matchWriteUpFormat(text: string) {
  const hit = MATCHERS.find(([, pattern]) => pattern.test(text));
  return hit ? WRITE_UP_FORMATS.find((format) => format.id === hit[0]) ?? null : null;
}

export function writeUpFormat(id: string) {
  return WRITE_UP_FORMATS.find((format) => format.id === id) ?? CUSTOM_WRITE_UP;
}
