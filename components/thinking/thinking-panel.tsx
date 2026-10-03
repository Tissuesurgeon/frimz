"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { BriefField, BriefSnapshot } from "@/lib/context-brief";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefEditor } from "./brief-editor";
import { BriefView } from "./brief-view";
import type { ThinkingState } from "./use-thinking";

type RebuildResponse = { changed?: boolean; brief?: BriefSnapshot | null; error?: string };

export function ThinkingPanel({
  heading,
  close,
  state,
  failed,
  conversationId,
  highlight,
  onBrief,
  onBusy,
  onEditingChange,
}: {
  heading: React.ReactNode;
  close: React.ReactNode;
  state: ThinkingState | null;
  failed: boolean;
  conversationId?: string;
  highlight: BriefField[];
  onBrief: (brief: BriefSnapshot, options?: { highlight?: boolean }) => void;
  /** A background update holds the brief, so the caller waits for it. */
  onBusy: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [leftEditor, setLeftEditor] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const brief = state?.brief ?? null;

  function stopEditing() {
    setEditing(false);
    setLeftEditor(true);
  }
  const ideaId = state?.ideaId ?? null;

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  async function rebuild() {
    if (!ideaId || rebuilding) return;
    setRebuilding(true);
    const response = await fetch(`/api/ideas/${ideaId}/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(conversationId ? { conversationId } : {}),
    }).catch(() => null);
    setRebuilding(false);
    const body = (await response?.json().catch(() => ({}))) as RebuildResponse | undefined;
    if (!response) {
      toast("Current thinking could not be updated. Check your connection and try again.");
      return;
    }
    if (response.status === 409) {
      toast(body?.error ?? "Frimz is already updating this.");
      onBusy();
      return;
    }
    if (!response.ok) {
      toast(body?.error ?? "Current thinking could not be updated right now.");
      return;
    }
    if (!body?.brief) {
      toast("There isn't enough here to put together yet. Keep talking it through.");
      return;
    }
    onBrief(body.brief, { highlight: true });
    toast(body.changed ? (brief ? "Current thinking regenerated" : "Current thinking is ready") : "Nothing new to add");
  }

  const updating = Boolean(state?.updating) || rebuilding;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border pl-4 pr-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {heading}
          {updating ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              Updating
            </span>
          ) : null}
        </div>
        {close}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {failed && !state ? (
          <p className="text-sm leading-relaxed text-muted-foreground" role="alert">
            Current thinking could not be loaded. It will appear here when the connection is back.
          </p>
        ) : !state ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">Loading current thinking</span>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="mt-5 h-20 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : brief && editing ? (
          <BriefEditor
            brief={brief}
            onCancel={stopEditing}
            onDone={(next) => {
              stopEditing();
              onBrief(next);
            }}
          />
        ) : brief ? (
          <BriefView
            brief={brief}
            highlight={highlight}
            onEdit={() => setEditing(true)}
            focusEdit={leftEditor}
            onRegenerate={() => void rebuild()}
            regenerating={rebuilding}
            historyHref={`/ideas/${brief.ideaId}`}
          />
        ) : (
          <div className="pt-2">
            <div className="flex items-center gap-2 text-muted-foreground" aria-hidden>
              <MemoryGlyph kind="idea" className="h-4 w-4 text-primary" />
              <MemoryGlyph kind="decision" className="h-4 w-4" />
              <MemoryGlyph kind="open_question" className="h-4 w-4" />
            </div>
            <p className="mt-4 font-medium">Where the thinking stands</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Once this conversation settles on an idea, Frimz writes down the problem, what you decided, what you set aside,
              and what is still open. It updates after replies that move the thinking forward, and you can correct it any time.
            </p>
            {ideaId ? (
              <Button type="button" size="sm" variant="outline" className="mt-5" disabled={rebuilding} onClick={() => void rebuild()}>
                {rebuilding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                {rebuilding ? "Putting it together…" : "Put it together from this conversation"}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
