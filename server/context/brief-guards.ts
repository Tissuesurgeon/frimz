import {
  BRIEF_SECTIONS,
  hasBriefValue,
  itemKey,
  normalizeBrief,
  type BriefField,
  type BriefItem,
  type BriefTextField,
  type ContextBriefData,
} from "@/lib/context-brief";
import { looksLikeInjection } from "@/server/memory/memory-validator";
import type { MemoryRecord } from "@/server/memory/types";

export type TranscriptLine = { role: "user" | "assistant"; content: string; createdAt?: string };

export type RetiredSection = "decisions" | "rejectedDirections" | "openQuestions";
export type RemovedItem = { section: RetiredSection; text: string; why: string };

export type GuardInput = {
  previous: ContextBriefData;
  proposed: ContextBriefData;
  removed: RemovedItem[];
  transcript: TranscriptLine[];
  memories: MemoryRecord[];
  userFields: BriefField[];
  userEditedAt: Date | null;
  /** A rebuild re-derives every item, so items it leaves out stay out. */
  rebuild?: boolean;
};

export type GuardResult = {
  data: ContextBriefData;
  userFields: BriefField[];
  dropped: string[];
  restored: string[];
};

const STOP = new Set(
  (
    "the and for are but not you your yours our ours they them their this that these those with from into onto about " +
    "what which who whom whose when where why how than then there here also just only very really maybe perhaps " +
    "will would should could can may might must shall have has had having was were been being does did doing done " +
    "let lets let's its it's i'm i've i'd i'll we're we've we'll you're that's what's there's don dont don't " +
    "didn didn't doesn doesn't isn isn't wasn wasn't aren aren't won won't can't " +
    "want wants need needs make makes made get gets got use used using thing things way ways lot lots kind sort " +
    "good better best great new first one two some any all each every more most less much many other another " +
    "because since while still even yet again over under after before between through same such like think " +
    "user users people someone something anything everything idea ideas product app build building work works"
  ).split(" "),
);

function stem(token: string) {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function contentTokens(text: string) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^'+|'+$/g, ""))
    .filter((token) => token.length > 2 && !STOP.has(token))
    .map(stem);
  return [...new Set(tokens)];
}

/** Most of the claim's words appear in the source. */
function supports(claim: string, source: string, ratio = 0.5) {
  const tokens = contentTokens(claim);
  if (tokens.length === 0) return false;
  const available = new Set(contentTokens(source));
  const hits = tokens.filter((token) => available.has(token)).length;
  return hits >= (tokens.length <= 2 ? 1 : 2) && hits / tokens.length >= ratio;
}

/** The claim shares at least one meaningful word with a source. */
function anchored(claim: string, sources: string[]) {
  const tokens = contentTokens(claim);
  if (tokens.length === 0) return false;
  return sources.some((source) => {
    const available = new Set(contentTokens(source));
    return tokens.some((token) => available.has(token));
  });
}

function similar(a: string, b: string) {
  if (itemKey(a) === itemKey(b)) return true;
  return supports(a, b, 0.6) && supports(b, a, 0.6);
}

const ACCEPT_START =
  /^(yes|yeah|yep|yup|sure|ok(ay)?|agreed|deal|exactly|correct|absolutely|definitely|perfect|sounds (good|right|great|like a plan)|that works|makes sense|i agree|i like (that|it|this)|love (that|it|this)|good (idea|call|point)|let'?s (do|go with|try|use) (that|it|this|those|them|your)|let'?s go with|go with (that|it|this))\b/i;
const ACCEPT_REFERENCE = /\b(your|the) (first|second|third|last|other) (option|one|idea|suggestion|approach)\b/i;
const DECLINE = /^(no|nope|nah|not really|i don'?t think|hmm,? (no|not))\b/i;

/** A user reply that explicitly takes up what Frimz just suggested. */
export function isAcceptance(text: string) {
  const trimmed = text.trim();
  if (DECLINE.test(trimmed)) return false;
  return ACCEPT_START.test(trimmed) || ACCEPT_REFERENCE.test(trimmed);
}

function acceptedSuggestions(transcript: TranscriptLine[]) {
  return transcript
    .filter((line, index) => {
      const next = transcript[index + 1];
      return line.role === "assistant" && next?.role === "user" && isAcceptance(next.content);
    })
    .map((line) => line.content);
}

type Entry = string | BriefItem;

function entryText(entry: Entry) {
  return typeof entry === "string" ? entry : entry.text;
}

function entries(data: ContextBriefData, key: BriefField): Entry[] {
  const value = data[key];
  return Array.isArray(value) ? [...value] : [];
}

function put(data: ContextBriefData, key: BriefField, value: unknown) {
  const target = data as Record<string, unknown>;
  if (hasBriefValue(value)) target[key] = value;
  else delete target[key];
}

function flatten(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((entry: Entry) => (typeof entry === "string" ? entry : `${entry.text} ${entry.reason ?? ""}`)).join(" ");
}

function addHistory(data: ContextBriefData, line: string) {
  const history = entries(data, "relevantHistory").map(entryText);
  if (history.some((item) => similar(item, line))) return;
  history.push(line);
  put(data, "relevantHistory", history.slice(-8));
}

const FACT_FIELDS: BriefTextField[] = ["problem", "targetUser", "goal", "currentIdea"];
const TEXT_FIELDS: BriefTextField[] = ["context", ...FACT_FIELDS, "currentDirection"];

export function applyBriefGuards(input: GuardInput): GuardResult {
  const next = structuredClone(input.proposed);
  const previous = input.previous;
  const dropped: string[] = [];
  const restored: string[] = [];

  for (const section of BRIEF_SECTIONS) {
    const value = next[section.key];
    if (typeof value === "string" && looksLikeInjection(value)) {
      dropped.push(value);
      put(next, section.key, undefined);
    } else if (Array.isArray(value)) {
      const clean = entries(next, section.key).filter((entry) => {
        const text = flatten([entry]);
        if (!looksLikeInjection(text)) return true;
        dropped.push(entryText(entry));
        return false;
      });
      put(next, section.key, clean);
    }
  }

  const userLines = input.transcript.filter((line) => line.role === "user").map((line) => line.content);
  const allLines = input.transcript.map((line) => line.content);
  const accepted = acceptedSuggestions(input.transcript);
  const memoryLines = input.memories
    .filter((memory) => memory.status === "active" && memory.type !== "user_preference")
    .map((memory) => `${memory.content} ${memory.reason}`);
  const settled = input.memories
    .filter((memory) => memory.status === "active" && ["decision", "rejection", "idea_change"].includes(memory.type))
    .map((memory) => `${memory.content} ${memory.reason}`);
  const userSources = [...userLines, ...accepted, ...memoryLines];

  for (const key of ["decisions", "rejectedDirections"] as const) {
    const before = entries(previous, key);
    const kept = entries(next, key).filter((entry) => {
      const text = entryText(entry);
      if (before.some((old) => similar(entryText(old), text))) return true;
      if ([...userLines, ...accepted, ...settled].some((source) => supports(text, source))) return true;
      dropped.push(text);
      return false;
    });
    put(next, key, kept);
  }

  for (const key of FACT_FIELDS) {
    const value = next[key];
    if (!value || value === previous[key]) continue;
    if (anchored(value, [...userSources, flatten(previous[key])])) continue;
    dropped.push(value);
    put(next, key, previous[key]);
  }

  if (next.currentDirection && next.currentDirection !== previous.currentDirection) {
    if (!anchored(next.currentDirection, [...userSources, flatten(previous.currentDirection)])) {
      dropped.push(next.currentDirection);
      put(next, "currentDirection", previous.currentDirection);
    }
  }

  for (const key of ["keyInsights", "assumptions", "openQuestions", "nextAreasToExplore"] as const) {
    const before = entries(previous, key).map(entryText);
    const kept = entries(next, key).filter((entry) => {
      const text = entryText(entry);
      if (before.some((old) => similar(old, text)) || anchored(text, [...allLines, ...memoryLines])) return true;
      dropped.push(text);
      return false;
    });
    put(next, key, kept);
  }

  const retiredFromPrevious = input.removed.filter((item) =>
    entries(previous, item.section).some((old) => similar(entryText(old), item.text) || supports(entryText(old), item.text)),
  );

  if (!input.rebuild) {
    for (const key of TEXT_FIELDS) {
      if (previous[key] && !next[key]) {
        put(next, key, previous[key]);
        restored.push(previous[key]!);
      }
    }
    for (const key of ["decisions", "rejectedDirections", "openQuestions"] as const) {
      const current = entries(next, key);
      const retired = retiredFromPrevious.filter((item) => item.section === key);
      for (const old of entries(previous, key)) {
        const text = entryText(old);
        if (current.some((entry) => similar(entryText(entry), text))) continue;
        if (retired.some((item) => supports(text, item.text) || supports(item.text, text))) continue;
        const contradicted =
          key === "decisions" &&
          entries(next, "rejectedDirections").some((entry) => supports(text, entryText(entry)) || supports(entryText(entry), text));
        if (contradicted) {
          addHistory(next, `Earlier decision: ${text}`);
          continue;
        }
        current.push(old);
        restored.push(text);
      }
      put(next, key, current);
    }
  }

  if (previous.currentDirection && next.currentDirection && !similar(previous.currentDirection, next.currentDirection)) {
    addHistory(next, `Earlier direction: ${previous.currentDirection}`);
  }
  for (const item of retiredFromPrevious) {
    const why = item.why ? ` (${item.why})` : "";
    if (item.section === "decisions") addHistory(next, `Earlier decision: ${item.text}${why}`);
    if (item.section === "rejectedDirections") addHistory(next, `Reconsidered: ${item.text}${why}`);
  }

  const editedAt = input.userEditedAt;
  const newer = editedAt
    ? input.transcript
        .filter((line) => line.role === "user" && line.createdAt && new Date(line.createdAt) > editedAt)
        .map((line) => line.content)
    : [];
  const userFields: BriefField[] = [];
  for (const key of input.userFields) {
    const mine = previous[key];
    const theirs = next[key];
    if (JSON.stringify(mine ?? null) === JSON.stringify(theirs ?? null)) {
      userFields.push(key);
      continue;
    }
    const old = new Set(contentTokens(flatten(mine)));
    const fresh = contentTokens(flatten(theirs)).filter((token) => !old.has(token));
    const grounded =
      newer.length > 0 &&
      (fresh.length === 0 ||
        newer.some((line) => {
          const available = new Set(contentTokens(line));
          return fresh.some((token) => available.has(token));
        }));
    if (grounded) continue;
    put(next, key, mine);
    userFields.push(key);
  }

  return { data: normalizeBrief(next), userFields, dropped, restored };
}
