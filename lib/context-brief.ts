export type BriefItem = { text: string; reason?: string };

export type ContextBriefData = {
  context?: string;
  problem?: string;
  targetUser?: string;
  goal?: string;
  currentIdea?: string;
  keyInsights?: string[];
  decisions?: BriefItem[];
  rejectedDirections?: BriefItem[];
  assumptions?: string[];
  openQuestions?: string[];
  currentDirection?: string;
  nextAreasToExplore?: string[];
  relevantHistory?: string[];
};

export type BriefField = keyof ContextBriefData;
export type BriefFieldKind = "text" | "list" | "reasoned";
export type BriefTextField = "context" | "problem" | "targetUser" | "goal" | "currentIdea" | "currentDirection";
export type BriefListField = "keyInsights" | "assumptions" | "openQuestions" | "nextAreasToExplore" | "relevantHistory";
export type BriefReasonedField = "decisions" | "rejectedDirections";

export type BriefSection = {
  key: BriefField;
  label: string;
  kind: BriefFieldKind;
  /** Memory kind drawn by MemoryGlyph beside the section. */
  glyph?: string;
  /** Characters for text sections, items for lists. */
  max: number;
};

export const BRIEF_SECTIONS: readonly BriefSection[] = [
  { key: "context", label: "Where it stands", kind: "text", max: 700 },
  { key: "problem", label: "Problem", kind: "text", max: 400 },
  { key: "targetUser", label: "Target user", kind: "text", max: 300 },
  { key: "goal", label: "Goal", kind: "text", max: 400 },
  { key: "currentIdea", label: "Current idea", kind: "text", glyph: "idea", max: 500 },
  { key: "keyInsights", label: "Key insights", kind: "list", glyph: "insight", max: 8 },
  { key: "decisions", label: "Decisions", kind: "reasoned", glyph: "decision", max: 10 },
  { key: "rejectedDirections", label: "Directions set aside", kind: "reasoned", glyph: "rejection", max: 8 },
  { key: "assumptions", label: "Assumptions", kind: "list", max: 8 },
  { key: "openQuestions", label: "Open questions", kind: "list", glyph: "open_question", max: 8 },
  { key: "currentDirection", label: "Current direction", kind: "text", glyph: "idea_change", max: 400 },
  { key: "nextAreasToExplore", label: "Next to explore", kind: "list", max: 5 },
  { key: "relevantHistory", label: "How it got here", kind: "list", max: 8 },
];

export const BRIEF_FIELDS = BRIEF_SECTIONS.map((section) => section.key) as [BriefField, ...BriefField[]];

export const BRIEF_ITEM_MAX = 300;
export const BRIEF_REASON_MAX = 300;

/** The brief as the client sees it. */
export type BriefSnapshot = {
  id: string;
  ideaId: string;
  title: string;
  version: number;
  data: ContextBriefData;
  userFields: BriefField[];
  changeSummary: string;
  updatedAt: string;
};

export type BriefVersionSnapshot = {
  version: number;
  source: "synthesis" | "edit" | "regenerate";
  changeSummary: string;
  data: ContextBriefData;
  createdAt: string;
};

const PLACEHOLDER =
  /^(n\/?a|none( yet)?|nothing( yet)?|unknown|tbd|tbc|null|undefined|-+|—|not (yet )?(specified|defined|decided|known|discussed|mentioned|stated|provided|clear))\.?$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cleanBriefText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || PLACEHOLDER.test(text)) return "";
  return text.slice(0, max).trim();
}

export function itemKey(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanList(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    const text = cleanBriefText(typeof entry === "string" ? entry : isRecord(entry) ? entry.text : undefined, BRIEF_ITEM_MAX);
    const key = itemKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(text);
    if (items.length >= maxItems) break;
  }
  return items;
}

function cleanReasoned(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: BriefItem[] = [];
  for (const entry of value) {
    const record = typeof entry === "string" ? { text: entry } : isRecord(entry) ? entry : null;
    if (!record) continue;
    const text = cleanBriefText(record.text ?? record.statement ?? record.direction, BRIEF_ITEM_MAX);
    const key = itemKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const reason = cleanBriefText(record.reason, BRIEF_REASON_MAX);
    items.push(reason ? { text, reason } : { text });
    if (items.length >= maxItems) break;
  }
  return items;
}

/** Shapes any input into brief data that holds only filled sections. */
export function normalizeBrief(raw: unknown): ContextBriefData {
  const source = isRecord(raw) ? raw : {};
  const data: Record<string, unknown> = {};
  for (const section of BRIEF_SECTIONS) {
    const value = source[section.key];
    const cleaned =
      section.kind === "text"
        ? cleanBriefText(value, section.max)
        : section.kind === "list"
          ? cleanList(value, section.max)
          : cleanReasoned(value, section.max);
    if (hasBriefValue(cleaned)) data[section.key] = cleaned;
  }
  return data as ContextBriefData;
}

export function hasBriefValue(value: unknown) {
  if (typeof value === "string") return value.length > 0;
  return Array.isArray(value) && value.length > 0;
}

export function briefSections(data: ContextBriefData) {
  return BRIEF_SECTIONS.filter((section) => hasBriefValue(data[section.key]));
}

export function briefSection(key: BriefField) {
  return BRIEF_SECTIONS.find((section) => section.key === key)!;
}

export function isEmptyBrief(data: ContextBriefData) {
  return briefSections(data).length === 0;
}

export function changedFields(previous: ContextBriefData, next: ContextBriefData): BriefField[] {
  return BRIEF_SECTIONS.filter(
    (section) => JSON.stringify(previous[section.key] ?? null) !== JSON.stringify(next[section.key] ?? null),
  ).map((section) => section.key);
}

export function sameBrief(a: ContextBriefData, b: ContextBriefData) {
  return changedFields(a, b).length === 0;
}

/** Enough settled substance that a written draft would be useful. */
export function isDraftable(data: ContextBriefData) {
  const subject = Boolean(data.problem || data.currentIdea || data.goal);
  const direction = Boolean(data.currentDirection) || (data.decisions?.length ?? 0) > 0;
  return subject && direction && briefSections(data).length >= 4;
}

function itemLine(item: string | BriefItem) {
  if (typeof item === "string") return item;
  return item.reason ? `${item.text} Reason: ${item.reason}` : item.text;
}

export function renderBriefMarkdown(title: string, data: ContextBriefData) {
  const lines = [`# ${title}`];
  for (const section of briefSections(data)) {
    const value = data[section.key];
    if (section.key === "context") {
      lines.push("", value as string);
      continue;
    }
    lines.push("", `## ${section.label}`);
    if (typeof value === "string") lines.push(value);
    else for (const item of value as (string | BriefItem)[]) lines.push(`- ${itemLine(item)}`);
  }
  return lines.join("\n");
}

/** Plain text for model prompts. Sections the user corrected are marked so they carry the most weight. */
export function renderBriefForPrompt(data: ContextBriefData, userFields: BriefField[] = []) {
  const lines: string[] = [];
  for (const section of briefSections(data)) {
    const value = data[section.key];
    const mark = userFields.includes(section.key) ? " (corrected by the user)" : "";
    lines.push(`${section.label.toUpperCase()}${mark}`);
    if (typeof value === "string") lines.push(value);
    else for (const item of value as (string | BriefItem)[]) lines.push(`- ${itemLine(item)}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
