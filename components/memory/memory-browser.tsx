"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { EyeOff, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { MEMORY_GROUPS } from "@/lib/constants";
import { shortDate } from "@/lib/dates";
import { MemoryGlyph, memoryKindLabel } from "@/components/brand/memory-glyph";
import { Button } from "@/components/ui/button";
import { GrowingTextarea } from "@/components/ui/growing-textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Memory = {
  id: string;
  type: string;
  status: string;
  content: string;
  reason: string;
  ideaTitle: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryList = { memories: Memory[]; walrusConfigured?: boolean };

const types = ["user_preference", "idea", "decision", "rejection", "insight", "open_question", "idea_change"] as const;
type MemoryType = (typeof types)[number];

const field = "mt-1 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";

function groupOf(type: string) {
  return type === "idea_change" ? "idea" : type;
}

async function fetchMemories() {
  const response = await fetch("/api/memories");
  if (!response.ok) throw new Error("load");
  return (await response.json()) as MemoryList;
}

export function MemoryBrowser() {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [walrus, setWalrus] = useState<boolean | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const focusAfterRender = useRef<string | null>(null);

  useEffect(() => {
    if (!focusAfterRender.current) return;
    document.getElementById(focusAfterRender.current)?.focus();
    focusAfterRender.current = null;
  });

  useEffect(() => {
    let cancelled = false;
    fetchMemories()
      .then((body) => {
        if (cancelled) return;
        setMemories(body.memories);
        setWalrus(Boolean(body.walrusConfigured));
      })
      .catch(() => {
        if (cancelled) return;
        setError("Memories could not be loaded.");
        setMemories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    try {
      const body = await fetchMemories();
      setMemories(body.memories);
      setWalrus(Boolean(body.walrusConfigured));
    } catch {
      setError("Memories could not be loaded.");
    }
  }

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const memory of memories ?? []) map.set(groupOf(memory.type), (map.get(groupOf(memory.type)) ?? 0) + 1);
    return map;
  }, [memories]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (memories ?? []).filter(
      (memory) =>
        (group === "all" || groupOf(memory.type) === group) &&
        (!needle || memory.content.toLowerCase().includes(needle) || memory.ideaTitle.toLowerCase().includes(needle)),
    );
  }, [memories, query, group]);

  async function forget(id: string) {
    const response = await fetch(`/api/memories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("That memory could not be forgotten.");
      return;
    }
    setConfirmId(null);
    toast("Frimz will no longer use this memory.");
    await reload();
  }

  if (memories === null) {
    return (
      <div className="space-y-3" aria-busy="true">
        <span className="sr-only">Loading memories</span>
        <Skeleton className="h-11 w-full rounded-full" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  const chips = [
    { id: "all", label: "All", count: memories.length },
    ...MEMORY_GROUPS.filter((item) => counts.get(item.id)).map((item) => ({ id: item.id, label: item.label, count: counts.get(item.id) ?? 0 })),
  ];

  return (
    <div>
      {walrus !== null ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${walrus ? "bg-success" : "bg-warning"}`} aria-hidden />
          {walrus ? "New memories are stored with Walrus Memory." : "Connect Walrus Memory on this deployment so Frimz can save new memories."}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {memories.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 text-muted-foreground" aria-hidden>
            <MemoryGlyph kind="decision" className="h-5 w-5 text-primary" />
            <MemoryGlyph kind="rejection" className="h-5 w-5" />
            <MemoryGlyph kind="open_question" className="h-5 w-5" />
          </div>
          <p className="mt-5 font-medium">Nothing remembered yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Decisions, directions you set aside, and open questions appear here after a real conversation.
          </p>
          <Link href="/chat" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Start a conversation
          </Link>
        </div>
      ) : (
        <>
          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="memory-search" className="sr-only">
              Search memories
            </label>
            <input
              id="memory-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search memories"
              className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm placeholder:text-muted-foreground"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Show memories by kind">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={group === chip.id}
                onClick={() => setGroup(chip.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
                  group === chip.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {chip.label}
                <span className="tabular-nums opacity-70">{chip.count}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">Nothing matches that search. Try another word.</p> : null}
        </>
      )}

      {MEMORY_GROUPS.map((item) => {
        const items = filtered.filter((memory) => groupOf(memory.type) === item.id);
        if (items.length === 0) return null;
        return (
          <section key={item.id} className="mt-8">
            <h2 className="text-sm font-medium text-muted-foreground">{item.label}</h2>
            <ul className="mt-3 space-y-3">
              {items.map((memory) => (
                <li key={memory.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <MemoryGlyph kind={memory.type} className={`mt-1 h-4 w-4 shrink-0 ${memory.status === "active" ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{memoryKindLabel(memory.type)}</span>
                        {memory.ideaTitle ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{memory.ideaTitle}</span>
                          </>
                        ) : null}
                        {memory.status === "superseded" ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>Earlier version</span>
                          </>
                        ) : null}
                      </p>
                      {editingId === memory.id ? (
                        <MemoryEditor
                          memory={memory}
                          onCancel={() => {
                            focusAfterRender.current = `edit-${memory.id}`;
                            setEditingId(null);
                          }}
                          onSaved={async () => {
                            setEditingId(null);
                            await reload();
                          }}
                        />
                      ) : (
                        <>
                          <p id={`memory-${memory.id}`} className={`mt-1 leading-relaxed ${memory.status === "active" ? "" : "text-muted-foreground"}`}>
                            {memory.content}
                          </p>
                          {memory.reason ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{memory.reason}</p> : null}
                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <p className="text-xs text-muted-foreground">Saved {shortDate(memory.updatedAt)}</p>
                            {memory.status === "active" && confirmId !== memory.id ? (
                              <div className="ml-auto flex gap-1">
                                <Button
                                  id={`edit-${memory.id}`}
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  aria-describedby={`memory-${memory.id}`}
                                  onClick={() => {
                                    setConfirmId(null);
                                    setEditingId(memory.id);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                  Edit
                                </Button>
                                <Button
                                  id={`forget-${memory.id}`}
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  aria-describedby={`memory-${memory.id}`}
                                  onClick={() => {
                                    setEditingId(null);
                                    setConfirmId(memory.id);
                                  }}
                                >
                                  <EyeOff className="h-3.5 w-3.5" aria-hidden />
                                  Forget
                                </Button>
                              </div>
                            ) : null}
                          </div>
                          {confirmId === memory.id ? (
                            <div className="reveal-in mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2.5" role="group" aria-label="Confirm forget">
                              <p className="min-w-[12rem] flex-1 text-sm leading-relaxed">
                                Frimz will stop using this memory. The record on Walrus stays as it is, since Walrus blobs are immutable.
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  autoFocus
                                  onClick={() => {
                                    focusAfterRender.current = `forget-${memory.id}`;
                                    setConfirmId(null);
                                  }}
                                >
                                  Keep it
                                </Button>
                                <Button type="button" size="sm" variant="destructive" onClick={() => void forget(memory.id)}>
                                  Forget
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MemoryEditor({ memory, onCancel, onSaved }: { memory: Memory; onCancel: () => void; onSaved: () => void | Promise<void> }) {
  const [type, setType] = useState<MemoryType>((types as readonly string[]).includes(memory.type) ? (memory.type as MemoryType) : "decision");
  const [content, setContent] = useState(memory.content);
  const [reason, setReason] = useState(memory.reason);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const tooShort = content.trim().length < 12;
  const hintId = `memory-${memory.id}-hint`;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (tooShort) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/memories/${memory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content, reason }),
    });
    setPending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "That memory could not be updated.");
      return;
    }
    toast("Memory updated");
    await onSaved();
  }

  return (
    <form
      className="reveal-in mt-2 space-y-3"
      onSubmit={save}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <label className="block text-xs text-muted-foreground">
        Memory
        <GrowingTextarea
          autoFocus
          value={content}
          maxLength={2000}
          onChange={(event) => setContent(event.target.value)}
          aria-describedby={hintId}
          className={`${field} min-h-24 py-2 text-[15px] leading-relaxed`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <label className="block text-xs text-muted-foreground">
          Kind
          <select value={type} onChange={(event) => setType(event.target.value as MemoryType)} className={`${field} h-10`}>
            {types.map((item) => (
              <option key={item} value={item}>
                {memoryKindLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Reason
          <GrowingTextarea value={reason} rows={1} maxLength={1000} onChange={(event) => setReason(event.target.value)} className={`${field} min-h-10 py-2`} />
        </label>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-muted-foreground">
          {tooShort ? "Write at least 12 characters." : "Saving keeps this version as history and uses the new one from now on."}
        </p>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending || tooShort}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
