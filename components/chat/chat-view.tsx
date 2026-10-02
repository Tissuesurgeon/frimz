"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Square } from "lucide-react";
import { toast } from "sonner";
import { MODES, type Mode } from "@/lib/modes";
import { CURSOR_UNAVAILABLE } from "@/lib/constants";
import { Markdown } from "@/components/chat/markdown";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  indicators?: { type: "remembered" | "connected"; memoryId: string; label: string }[];
};

const starters = [
  { label: "Help me explore an idea", mode: "think" as const, text: "Help me explore an idea I'm working on." },
  { label: "Challenge my thinking", mode: "challenge" as const, text: "Challenge my thinking on an idea I care about." },
  { label: "Help me make a plan", mode: "plan" as const, text: "Help me make a plan for something I'm developing." },
  { label: "Help me develop an idea", mode: "write" as const, text: "Help me develop an idea into something clearer." },
];

export function ChatView({
  conversationId,
  title,
  initialMessages,
}: {
  conversationId?: string;
  title?: string;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [mode, setMode] = useState<Mode>("think");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(title ?? "");
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setName(title ?? "");
  }, [title]);

  useEffect(() => {
    if (!stickRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "0px";
    box.style.height = `${Math.min(box.scrollHeight, 200)}px`;
  }, [draft]);

  async function send(text: string, nextMode = mode, retry = false) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    if (!retry) {
      setMessages((current) => [...current, { id: `local-${Date.now()}`, role: "user", content: trimmed }, { id: "streaming", role: "assistant", content: "" }]);
      setDraft("");
    } else {
      setMessages((current) => {
        const next = [...current];
        if (next.at(-1)?.role === "assistant") next.pop();
        next.push({ id: "streaming", role: "assistant", content: "" });
        return next;
      });
    }
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed, mode: nextMode, retry }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || CURSOR_UNAVAILABLE);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let nextId = conversationId;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const event = part.match(/^event: (.+)$/m)?.[1];
          const dataLine = part.match(/^data: (.+)$/m)?.[1];
          if (!event || !dataLine) continue;
          const data = JSON.parse(dataLine) as {
            conversationId?: string;
            text?: string;
            message?: string;
            indicators?: ChatMessage["indicators"];
          };
          if (event === "conversation" && data.conversationId) {
            nextId = data.conversationId;
            router.replace(`/chat/${data.conversationId}`);
          }
          if (event === "token" && data.text) {
            setMessages((current) => current.map((message) => message.id === "streaming" ? { ...message, content: message.content + data.text } : message));
          }
          if (event === "error") setError(data.message || CURSOR_UNAVAILABLE);
          if (event === "done") {
            setMessages((current) => current.map((message) => message.id === "streaming" ? { ...message, id: `done-${Date.now()}`, indicators: data.indicators?.map((item) => ({ ...item, label: item.label ?? "" })) } : message));
          }
        }
      }
      if (nextId && nextId !== conversationId) router.refresh();
    } catch (caught) {
      const aborted = (caught as Error).name === "AbortError";
      setMessages((current) => {
        const next = [...current];
        const last = next.at(-1);
        if (last?.id === "streaming" && !last.content) next.pop();
        return next;
      });
      if (!aborted) setError(caught instanceof Error ? caught.message : CURSOR_UNAVAILABLE);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function rename(nextTitle: string) {
    const trimmed = nextTitle.trim();
    if (!trimmed || !conversationId || trimmed === title) {
      setRenaming(false);
      setName(title ?? "");
      return;
    }
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setRenaming(false);
    if (!response.ok) {
      setName(title ?? "");
      toast("The conversation could not be renamed.");
      return;
    }
    toast("Conversation renamed");
    router.refresh();
  }

  const composer = (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(event) => {
        event.preventDefault();
        void send(draft);
      }}
    >
      <div className="composer rounded-[28px] border border-border bg-card px-4 pt-3 pb-2 shadow-[var(--shadow-soft)]">
        <label className="sr-only" htmlFor="composer">Ask your thinking partner</label>
        <textarea
          id="composer"
          ref={boxRef}
          rows={1}
          value={draft}
          disabled={streaming}
          placeholder="Ask your thinking partner"
          aria-describedby="mode-hint"
          className="max-h-48 min-h-12 w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <div id="mode-hint" className="sr-only">{activeMode.hint}</div>
          <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Mode">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={mode === item.id}
                title={item.hint}
                className={`rounded-full px-2.5 py-1 text-xs ${mode === item.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                onClick={() => {
                  setMode(item.id);
                  boxRef.current?.focus();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {streaming ? (
            <button type="button" aria-label="Stop" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background" onClick={() => abortRef.current?.abort()}>
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button type="submit" aria-label="Send" disabled={!draft.trim()} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background disabled:bg-muted disabled:text-muted-foreground">
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Enter to send. Shift+Enter for a new line.</p>
    </form>
  );

  const suggestions = (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {starters.map((starter) => (
        <button
          key={starter.label}
          type="button"
          className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            setMode(starter.mode);
            setDraft(starter.text);
            boxRef.current?.focus();
          }}
        >
          {starter.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {title ? (
        <header className="flex h-12 shrink-0 items-center justify-center px-4">
          {renaming ? (
            <form
              className="w-full max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                void rename(name);
              }}
            >
              <label className="sr-only" htmlFor="conversation-title">Conversation title</label>
              <input
                id="conversation-title"
                value={name}
                autoFocus
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-center text-sm"
                onChange={(event) => setName(event.target.value)}
                onBlur={() => void rename(name)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setName(title);
                    setRenaming(false);
                  }
                }}
              />
            </form>
          ) : (
            <button type="button" className="max-w-md truncate text-sm font-medium" aria-label="Rename conversation" onClick={() => setRenaming(true)}>
              {title}
            </button>
          )}
        </header>
      ) : null}
      {messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-8">
          <h2 className="text-center text-3xl tracking-tight">What are you thinking about?</h2>
          <div className="mt-6 w-full">{composer}</div>
          {suggestions}
        </div>
      ) : (
        <>
          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 overflow-y-auto"
            onScroll={(event) => {
              const el = event.currentTarget;
              stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
              {messages.map((message) => (
                <article key={message.id} className={message.role === "user" ? "flex justify-end" : "w-full"}>
                  {message.role === "assistant" && message.content === "" && streaming ? (
                    <p className="text-sm text-muted-foreground" aria-live="polite">Thinking</p>
                  ) : message.role === "assistant" ? (
                    <div>
                      <Markdown content={message.content} />
                      {message.indicators?.filter((item) => item.label).map((item) => (
                        <p key={item.memoryId} className="memory-indicator mt-3 text-xs text-muted-foreground">
                          {item.type === "connected" ? "Connected to an earlier idea" : "Remembered context"}
                          <span className="mt-0.5 block line-clamp-2">{item.label}</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="max-w-[min(36rem,85%)] whitespace-pre-wrap rounded-[24px] bg-muted px-4 py-2.5 text-[15px] leading-7">{message.content}</p>
                  )}
                </article>
              ))}
              {error ? (
                <div className="text-sm" role="alert">
                  <p>{error}</p>
                  <button type="button" className="mt-2 underline underline-offset-4" onClick={() => void send(messages.filter((message) => message.role === "user").at(-1)?.content ?? draft, mode, true)}>Try again</button>
                </div>
              ) : null}
              {messages.at(-1)?.role === "assistant" && !streaming && messages.at(-1)?.error ? (
                <button type="button" className="text-sm underline underline-offset-4" onClick={() => void send(messages.filter((message) => message.role === "user").at(-1)?.content ?? "", mode, true)}>Try again</button>
              ) : null}
            </div>
          </div>
          <div className="relative shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent" />
            {composer}
          </div>
        </>
      )}
    </div>
  );
}
