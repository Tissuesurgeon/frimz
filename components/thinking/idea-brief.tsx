"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { changedFields, type BriefField, type BriefSnapshot, type BriefVersionSnapshot } from "@/lib/context-brief";
import { dateTime } from "@/lib/dates";
import { BriefEditor } from "./brief-editor";
import { BriefSections, BriefView } from "./brief-view";

const SOURCE: Record<BriefVersionSnapshot["source"], string> = {
  synthesis: "Frimz",
  edit: "You",
  regenerate: "Regenerated",
};

/** A brief with its edit and regenerate actions, outside the chat. */
export function IdeaBrief({
  initial,
  showTitle = false,
  historyHref,
}: {
  initial: BriefSnapshot;
  showTitle?: boolean;
  historyHref?: string;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [leftEditor, setLeftEditor] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [highlight, setHighlight] = useState<BriefField[]>([]);

  useEffect(() => {
    setBrief(initial);
  }, [initial]);

  function show(next: BriefSnapshot, flash: boolean) {
    if (flash) {
      setHighlight(changedFields(brief.data, next.data));
      window.setTimeout(() => setHighlight([]), 2600);
    }
    setBrief(next);
    router.refresh();
  }

  async function rebuild() {
    setRebuilding(true);
    const response = await fetch(`/api/ideas/${brief.ideaId}/brief`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null);
    setRebuilding(false);
    const body = (await response?.json().catch(() => ({}))) as { changed?: boolean; brief?: BriefSnapshot | null; error?: string } | undefined;
    if (!response?.ok || !body?.brief) {
      toast(body?.error ?? "Current thinking could not be regenerated right now.");
      return;
    }
    toast(body.changed ? "Current thinking regenerated" : "Nothing new to add");
    if (body.changed) show(body.brief, true);
  }

  function stopEditing() {
    setEditing(false);
    setLeftEditor(true);
  }

  if (editing) {
    return (
      <BriefEditor
        brief={brief}
        onCancel={stopEditing}
        onDone={(next) => {
          stopEditing();
          show(next, false);
        }}
      />
    );
  }
  return (
    <BriefView
      brief={brief}
      showTitle={showTitle}
      highlight={highlight}
      onEdit={() => setEditing(true)}
      focusEdit={leftEditor}
      onRegenerate={() => void rebuild()}
      regenerating={rebuilding}
      historyHref={historyHref}
    />
  );
}

export function BriefVersions({ versions }: { versions: BriefVersionSnapshot[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ol className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
      {versions.map((version, index) => {
        const expanded = open === version.version;
        const panelId = `brief-version-${version.version}`;
        return (
          <li key={version.version}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-muted/60"
              onClick={() => setOpen(expanded ? null : version.version)}
            >
              <span className="min-w-0">
                <span className="block text-sm leading-relaxed">{version.changeSummary || `Version ${version.version}`}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground" suppressHydrationWarning>
                  Version {version.version} · {SOURCE[version.source] ?? "Frimz"} · {dateTime(version.createdAt)}
                  {index === 0 ? " · Current" : ""}
                </span>
              </span>
              <ChevronDown
                className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {expanded ? (
              <div id={panelId} className="reveal-in border-t border-border px-4 py-4">
                <BriefSections data={version.data} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
