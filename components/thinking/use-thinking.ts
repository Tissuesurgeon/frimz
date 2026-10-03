"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { briefSections, changedFields, type BriefField, type BriefSnapshot } from "@/lib/context-brief";

export type ThinkingState = {
  ideaId: string | null;
  brief: BriefSnapshot | null;
  updating: boolean;
  checkedMessageId: string | null;
};

type Reply = { id: string; createdAt?: string; error?: boolean };

const POLL_MS = 3_000;
/** Extraction and synthesis are two model calls after the reply, so the wait has to cover both. */
const POLL_WINDOW_MS = 3 * 60_000;
const HIGHLIGHT_MS = 2_600;

async function fetchThinking(conversationId: string) {
  const response = await fetch(`/api/conversations/${conversationId}/brief`, { cache: "no-store" });
  if (!response.ok) throw new Error("load");
  return (await response.json()) as ThinkingState;
}

function awaitsUpdate(reply: Reply | undefined, checkedMessageId: string | null | undefined): reply is Reply {
  if (!reply || reply.error || !reply.createdAt || reply.id === checkedMessageId) return false;
  return Date.now() - new Date(reply.createdAt).getTime() < POLL_WINDOW_MS;
}

/** "Problem clarified" reads as "Current thinking updated: problem clarified". */
export function updateNote(summary: string) {
  const text = summary.replace(/^updated\s+/i, "").trim() || "where it stands";
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/**
 * Keeps the conversation's brief current. After each reply it polls until the background step has
 * processed that reply, then shows what changed.
 */
export function useThinking({ conversationId, lastReply }: { conversationId?: string; lastReply?: Reply }) {
  const [state, setState] = useState<ThinkingState | null>(null);
  const [failed, setFailed] = useState(false);
  const [highlight, setHighlight] = useState<BriefField[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [unseen, setUnseen] = useState(false);
  const briefRef = useRef<BriefSnapshot | null>(null);
  const checkedRef = useRef<string | null>(null);
  const loaded = useRef(false);
  const generation = useRef(0);
  const following = useRef<string | null>(null);
  const pollTimer = useRef<number | undefined>(undefined);
  const flashTimer = useRef<number | undefined>(undefined);
  const replyRef = useRef(lastReply);
  replyRef.current = lastReply;

  const flash = useCallback((fields: BriefField[]) => {
    window.clearTimeout(flashTimer.current);
    setHighlight(fields);
    flashTimer.current = window.setTimeout(() => setHighlight([]), HIGHLIGHT_MS);
  }, []);

  const accept = useCallback(
    (next: ThinkingState, replyId?: string) => {
      const before = briefRef.current;
      const after = next.brief;
      if (loaded.current && after && (!before || after.version > before.version)) {
        flash(before ? changedFields(before.data, after.data) : briefSections(after.data).map((section) => section.key));
        if (replyId) {
          setNotes((current) => ({ ...current, [replyId]: updateNote(after.changeSummary) }));
          setUnseen(true);
        }
      }
      briefRef.current = after;
      checkedRef.current = next.checkedMessageId;
      loaded.current = true;
      setFailed(false);
      setState(next);
    },
    [flash],
  );

  const follow = useCallback(
    (replyId?: string) => {
      if (!conversationId) return;
      const run = ++generation.current;
      const started = Date.now();
      following.current = replyId ?? null;
      window.clearTimeout(pollTimer.current);
      const tick = async () => {
        if (run !== generation.current) return;
        let updating = false;
        try {
          const next = await fetchThinking(conversationId);
          if (run !== generation.current) return;
          accept(next, replyId);
          const caughtUp = replyId ? next.checkedMessageId === replyId : true;
          if (caughtUp && !next.updating) return;
          updating = next.updating;
        } catch {
          // A missed poll is retried until the window closes.
        }
        // A running update holds a lock that expires, so following it always ends.
        if (updating || Date.now() - started < POLL_WINDOW_MS) pollTimer.current = window.setTimeout(tick, POLL_MS);
      };
      pollTimer.current = window.setTimeout(tick, POLL_MS);
    },
    [accept, conversationId],
  );

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const run = ++generation.current;
    fetchThinking(conversationId)
      .then((next) => {
        if (cancelled || run !== generation.current) return;
        accept(next);
        const reply = replyRef.current;
        if (awaitsUpdate(reply, next.checkedMessageId)) follow(reply.id);
        else if (next.updating) follow();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      generation.current += 1;
      window.clearTimeout(pollTimer.current);
      window.clearTimeout(flashTimer.current);
    };
  }, [accept, conversationId, follow]);

  // A reply that arrives through a page refresh, such as the first reply of a new conversation.
  const replyId = lastReply?.id;
  useEffect(() => {
    const reply = replyRef.current;
    if (!loaded.current || !reply || reply.id !== replyId || following.current === reply.id) return;
    if (awaitsUpdate(reply, checkedRef.current)) follow(reply.id);
  }, [follow, replyId]);

  /** A brief the user just edited or regenerated. It replaces the shown one without a note. */
  const replace = useCallback(
    (brief: BriefSnapshot, options: { highlight?: boolean } = {}) => {
      const before = briefRef.current;
      if (options.highlight && before) flash(changedFields(before.data, brief.data));
      briefRef.current = brief;
      setState((current) => (current ? { ...current, brief } : current));
    },
    [flash],
  );

  return {
    state,
    failed,
    highlight,
    notes,
    unseen,
    markSeen: useCallback(() => setUnseen(false), []),
    follow,
    replace,
  };
}
