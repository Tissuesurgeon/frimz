"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  briefSections,
  renderBriefMarkdown,
  type BriefField,
  type BriefItem,
  type BriefSnapshot,
  type ContextBriefData,
} from "@/lib/context-brief";
import { dateTime } from "@/lib/dates";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import { Button } from "@/components/ui/button";

function Bullet() {
  return <span className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />;
}

export function BriefSections({
  data,
  userFields = [],
  highlight = [],
}: {
  data: ContextBriefData;
  userFields?: BriefField[];
  highlight?: BriefField[];
}) {
  return (
    <div className="space-y-4">
      {briefSections(data).map((section) => {
        const value = data[section.key]!;
        const changed = highlight.includes(section.key) ? "brief-changed" : "";
        const corrected = userFields.includes(section.key);
        if (section.key === "context") {
          return (
            <div key={section.key} className={`-mx-2 rounded-lg px-2 py-1 ${changed}`}>
              <p className="text-[15px] leading-relaxed">{value as string}</p>
              {corrected ? <p className="mt-1 text-xs text-muted-foreground">Corrected by you</p> : null}
            </div>
          );
        }
        return (
          <section key={section.key} className={`-mx-2 rounded-lg px-2 py-1 ${changed}`}>
            <h3 className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground">
              {section.glyph ? <MemoryGlyph kind={section.glyph} className="h-3.5 w-3.5 text-primary" /> : null}
              <span className="text-foreground/80">{section.label}</span>
              {corrected ? <span className="font-normal">· Corrected by you</span> : null}
            </h3>
            {typeof value === "string" ? (
              <p className="mt-1 text-sm leading-relaxed">{value}</p>
            ) : (
              <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed">
                {(value as (string | BriefItem)[]).map((item) => {
                  const text = typeof item === "string" ? item : item.text;
                  const reason = typeof item === "string" ? "" : item.reason;
                  return (
                    <li key={text} className="flex gap-2">
                      <Bullet />
                      <span className="min-w-0">
                        {text}
                        {reason ? <span className="mt-0.5 block text-[13px] text-muted-foreground">{reason}</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function BriefView({
  brief,
  highlight,
  showTitle = true,
  onEdit,
  focusEdit = false,
  onRegenerate,
  regenerating = false,
  historyHref,
}: {
  brief: BriefSnapshot;
  highlight?: BriefField[];
  /** Pages that already show the idea title hide it here. */
  showTitle?: boolean;
  onEdit?: () => void;
  focusEdit?: boolean;
  onRegenerate?: () => void;
  regenerating?: boolean;
  historyHref?: string;
}) {
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusEdit) editRef.current?.focus();
  }, [focusEdit]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(renderBriefMarkdown(brief.title, brief.data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast("This browser blocked copying. Select the text to copy it.");
    }
  }

  return (
    <div>
      {showTitle ? <p className="text-[15px] font-medium leading-snug">{brief.title}</p> : null}
      <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
        Version {brief.version} · Updated {dateTime(brief.updatedAt)}
      </p>
      <div className="-ml-3 mt-2 flex flex-wrap gap-0.5">
        <Button type="button" size="sm" variant="ghost" onClick={() => void copy()}>
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {onEdit ? (
          <Button ref={editRef} type="button" size="sm" variant="ghost" onClick={onEdit} disabled={regenerating}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </Button>
        ) : null}
        {onRegenerate ? (
          <Button type="button" size="sm" variant="ghost" onClick={onRegenerate} disabled={regenerating}>
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} aria-hidden />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        ) : null}
      </div>
      <div className="mt-4">
        <BriefSections data={brief.data} userFields={brief.userFields} highlight={highlight} />
      </div>
      {historyHref ? (
        <Link href={historyHref} className="mt-6 inline-flex text-sm underline underline-offset-4 hover:text-foreground/80">
          How it changed
        </Link>
      ) : null}
    </div>
  );
}
