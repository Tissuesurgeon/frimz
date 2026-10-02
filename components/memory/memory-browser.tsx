"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MEMORY_GROUPS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
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

const types = ["user_preference", "idea", "decision", "rejection", "insight", "open_question", "idea_change"] as const;

export function MemoryBrowser() {
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Memory | null>(null);
  const [content, setContent] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<(typeof types)[number]>("decision");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/memories");
    if (!response.ok) {
      setError("Memories could not be loaded.");
      setMemories([]);
      return;
    }
    const body = (await response.json()) as { memories: Memory[] };
    setMemories(body.memories);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/memories")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<{ memories: Memory[] }>;
      })
      .then((body) => {
        if (!cancelled) setMemories(body.memories);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Memories could not be loaded.");
          setMemories([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (memories ?? []).filter((memory) => !needle || memory.content.toLowerCase().includes(needle) || memory.ideaTitle.toLowerCase().includes(needle));
  }, [memories, query]);

  async function save() {
    if (!editing) return;
    setPending(true);
    const response = await fetch(`/api/memories/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content, reason }),
    });
    setPending(false);
    if (!response.ok) {
      setError("That memory could not be updated.");
      return;
    }
    toast("Memory updated");
    setEditing(null);
    await load();
  }

  async function forget(id: string) {
    const response = await fetch(`/api/memories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("That memory could not be forgotten.");
      return;
    }
    toast("Frimz will no longer use this memory.");
    await load();
  }

  if (memories === null) {
    return (
      <div className="space-y-3" aria-busy="true">
        <span className="sr-only">Loading memories</span>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm">
        Search memories
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-card px-3 text-sm" />
      </label>
      {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
      {memories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border p-6">
          <p>Frimz hasn&apos;t remembered anything yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Meaningful decisions and preferences show up after a real conversation.</p>
          <Link href="/chat" className="mt-4 inline-block text-sm underline">Start a conversation</Link>
        </div>
      ) : null}
      {memories.length > 0 && filtered.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">No matches.</p> : null}
      {MEMORY_GROUPS.map((group) => {
        const items = filtered.filter((memory) => (group.id === "idea" ? memory.type === "idea" || memory.type === "idea_change" : memory.type === group.id));
        if (items.length === 0) return null;
        return (
          <section key={group.id} className="mt-8">
            <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
            <ul className="mt-3 space-y-3">
              {items.map((memory) => (
                <li key={memory.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{memory.type.replaceAll("_", " ")}</span>
                    <span className="capitalize">{memory.status}</span>
                    {memory.ideaTitle ? <span>{memory.ideaTitle}</span> : null}
                  </div>
                  <p className="mt-2">{memory.content}</p>
                  {memory.reason ? <p className="mt-2 text-sm text-muted-foreground">{memory.reason}</p> : null}
                  <p className="mt-2 text-xs text-muted-foreground">Created {new Date(memory.createdAt).toLocaleDateString()} · Updated {new Date(memory.updatedAt).toLocaleDateString()}</p>
                  {memory.status === "active" ? (
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => { setEditing(memory); setContent(memory.content); setReason(memory.reason); setType(memory.type as (typeof types)[number]); }}>Edit</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void forget(memory.id)}>Forget</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="edit-memory-title">
          <form
            className="w-full max-w-lg rounded-xl border border-border bg-card p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2 id="edit-memory-title" className="text-lg">Edit memory</h2>
            <p className="mt-1 text-sm text-muted-foreground">Saving writes a new memory and marks this one superseded.</p>
            <label className="mt-4 block text-sm">
              Type
              <select value={type} onChange={(event) => setType(event.target.value as (typeof types)[number])} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3">
                {types.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              Memory
              <textarea value={content} onChange={(event) => setContent(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <label className="mt-3 block text-sm">
              Reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-16 w-full rounded-md border border-border bg-background px-3 py-2" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
