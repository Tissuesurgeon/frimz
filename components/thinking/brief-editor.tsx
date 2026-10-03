"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  BRIEF_ITEM_MAX,
  BRIEF_REASON_MAX,
  BRIEF_SECTIONS,
  changedFields,
  hasBriefValue,
  type BriefField,
  type BriefItem,
  type BriefSection,
  type BriefSnapshot,
  type ContextBriefData,
} from "@/lib/context-brief";
import { Button } from "@/components/ui/button";
import { GrowingTextarea } from "@/components/ui/growing-textarea";

const field =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground";

type Values = Partial<Record<BriefField, string | string[] | BriefItem[]>>;

function cleaned(values: Values): ContextBriefData {
  const data: Record<string, unknown> = {};
  for (const section of BRIEF_SECTIONS) {
    const value = values[section.key];
    if (section.kind === "text") {
      const text = typeof value === "string" ? value.trim() : "";
      if (text) data[section.key] = text;
    } else if (section.kind === "list") {
      const items = ((value as string[] | undefined) ?? []).map((item) => item.trim()).filter(Boolean);
      if (items.length > 0) data[section.key] = items;
    } else {
      const items = ((value as BriefItem[] | undefined) ?? [])
        .map((item) => ({ text: item.text.trim(), reason: item.reason?.trim() ?? "" }))
        .filter((item) => item.text)
        .map((item) => (item.reason ? item : { text: item.text }));
      if (items.length > 0) data[section.key] = items;
    }
  }
  return data as ContextBriefData;
}

/** The user's edits laid over a newer version, so changes they did not touch are kept. */
function mergeOnto(latest: ContextBriefData, original: ContextBriefData, mine: ContextBriefData): ContextBriefData {
  const merged: Record<string, unknown> = { ...latest };
  for (const key of changedFields(original, mine)) {
    if (mine[key] === undefined) delete merged[key];
    else merged[key] = mine[key];
  }
  return merged as ContextBriefData;
}

function emptyValue(section: BriefSection) {
  return section.kind === "text" ? "" : section.kind === "list" ? [""] : [{ text: "", reason: "" }];
}

export function BriefEditor({
  brief,
  onCancel,
  onDone,
}: {
  brief: BriefSnapshot;
  onCancel: () => void;
  onDone: (brief: BriefSnapshot) => void;
}) {
  const [values, setValues] = useState<Values>(() => structuredClone(brief.data) as Values);
  const [shown, setShown] = useState<BriefField[]>(() =>
    BRIEF_SECTIONS.filter((section) => hasBriefValue(brief.data[section.key])).map((section) => section.key),
  );
  const [conflict, setConflict] = useState<BriefSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    document.getElementById(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const hidden = BRIEF_SECTIONS.filter((section) => !shown.includes(section.key));

  function update(key: BriefField, value: Values[BriefField]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function addSection(key: BriefField) {
    const section = BRIEF_SECTIONS.find((item) => item.key === key);
    if (!section) return;
    setShown((current) => BRIEF_SECTIONS.map((item) => item.key).filter((item) => item === key || current.includes(item)));
    if (!hasBriefValue(values[key])) update(key, emptyValue(section));
    focusNext.current = section.kind === "text" ? `brief-${key}` : `brief-${key}-0`;
  }

  async function submit(baseVersion: number, data: ContextBriefData) {
    setPending(true);
    setError("");
    const response = await fetch(`/api/ideas/${brief.ideaId}/brief`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseVersion, data }),
    }).catch(() => null);
    setPending(false);
    if (!response) {
      setError("Current thinking could not be saved. Check your connection and try again.");
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string; saved?: boolean; brief?: BriefSnapshot | null };
    if (response.status === 409) {
      if (body.brief) setConflict(body.brief);
      else setError(body.error ?? "Current thinking changed while you were editing.");
      return;
    }
    if (!response.ok) {
      setError(body.error ?? "Current thinking could not be saved.");
      return;
    }
    toast(body.saved ? "Current thinking saved" : "Nothing changed");
    onDone(body.brief ?? brief);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (conflict) return;
    void submit(brief.version, cleaned(values));
  }

  return (
    <form className="reveal-in space-y-5" onSubmit={save} aria-label="Edit current thinking">
      {BRIEF_SECTIONS.filter((section) => shown.includes(section.key)).map((section) => {
        const value = values[section.key];
        if (section.kind === "text") {
          return (
            <div key={section.key}>
              <label htmlFor={`brief-${section.key}`} className="text-xs font-medium text-foreground/80">
                {section.label}
              </label>
              <GrowingTextarea
                id={`brief-${section.key}`}
                rows={2}
                value={typeof value === "string" ? value : ""}
                maxLength={section.max}
                onChange={(event) => update(section.key, event.target.value)}
                className={`${field} mt-1 min-h-16`}
              />
            </div>
          );
        }
        const reasoned = section.kind === "reasoned";
        const items = (value as (string | BriefItem)[] | undefined) ?? [];
        return (
          <fieldset key={section.key}>
            <legend className="text-xs font-medium text-foreground/80">{section.label}</legend>
            <ul className="mt-1 space-y-2">
              {items.map((item, index) => {
                const text = typeof item === "string" ? item : item.text;
                return (
                  <li key={index} className="flex items-start gap-1">
                    <div className="min-w-0 flex-1 space-y-1">
                      <GrowingTextarea
                        id={`brief-${section.key}-${index}`}
                        rows={1}
                        value={text}
                        maxLength={BRIEF_ITEM_MAX}
                        aria-label={`${section.label}, item ${index + 1}`}
                        onChange={(event) => {
                          const next = [...items];
                          next[index] = reasoned ? { ...(item as BriefItem), text: event.target.value } : event.target.value;
                          update(section.key, next as Values[BriefField]);
                        }}
                        className={`${field} min-h-10`}
                      />
                      {reasoned ? (
                        <GrowingTextarea
                          rows={1}
                          value={(item as BriefItem).reason ?? ""}
                          maxLength={BRIEF_REASON_MAX}
                          placeholder="Reason, if there is one"
                          aria-label={`Reason for ${section.label.toLowerCase()} item ${index + 1}`}
                          onChange={(event) => {
                            const next = [...items] as BriefItem[];
                            next[index] = { ...next[index], reason: event.target.value };
                            update(section.key, next);
                          }}
                          className={`${field} min-h-9 py-1.5 text-[13px]`}
                        />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${section.label.toLowerCase()} item ${index + 1}`}
                      className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => {
                        update(section.key, items.filter((_, position) => position !== index) as Values[BriefField]);
                        focusNext.current = `brief-add-${section.key}`;
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              id={`brief-add-${section.key}`}
              type="button"
              disabled={items.length >= section.max}
              className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              onClick={() => {
                update(section.key, [...items, reasoned ? { text: "", reason: "" } : ""] as Values[BriefField]);
                focusNext.current = `brief-${section.key}-${items.length}`;
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </button>
          </fieldset>
        );
      })}

      {hidden.length > 0 ? (
        <div>
          <label htmlFor="brief-add-section" className="sr-only">
            Add a section
          </label>
          <select
            id="brief-add-section"
            value=""
            onChange={(event) => addSection(event.target.value as BriefField)}
            className="h-9 rounded-md border border-dashed border-border bg-background px-2.5 text-sm text-muted-foreground"
          >
            <option value="">Add a section…</option>
            {hidden.map((section) => (
              <option key={section.key} value={section.key}>
                {section.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {conflict ? (
        <div className="reveal-in rounded-lg bg-muted px-3 py-3 text-sm" role="alert">
          <p className="leading-relaxed">Current thinking changed while you were editing. Your draft is still here.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                const latest = conflict;
                setConflict(null);
                void submit(latest.version, mergeOnto(latest.data, brief.data, cleaned(values)));
              }}
            >
              Save my changes on top
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onDone(conflict)}>
              Use the new version
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">Frimz keeps what you write here until you say otherwise.</p>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending || Boolean(conflict)}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
