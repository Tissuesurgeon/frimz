"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, Check, CircleAlert, Copy, FileText, NotebookText, Pencil, Square, X } from "lucide-react";
import { toast } from "sonner";
import { MODES, type Mode } from "@/lib/modes";
import { CURSOR_UNAVAILABLE, THINKING_COOKIE } from "@/lib/constants";
import { writeUpFormat } from "@/lib/write-up";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import { Markdown } from "@/components/chat/markdown";
import { MemoryNote } from "@/components/chat/memory-note";
import { ThinkingPanel } from "@/components/thinking/thinking-panel";
import { useThinking } from "@/components/thinking/use-thinking";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  createdAt?: string;
  draft?: { format: string };
  indicators?: { type: "remembered" | "connected"; memoryId: string; label: string; kind?: string }[];
};

const starters = [
  { label: "Help me explore an idea", mode: "think" as const, text: "Help me explore an idea I'm working on." },
  { label: "Challenge my thinking", mode: "challenge" as const, text: "Challenge my thinking on an idea I care about." },
  { label: "Help me make a plan", mode: "plan" as const, text: "Help me make a plan for something I'm developing." },
  { label: "Help me develop an idea", mode: "write" as const, text: "Help me develop an idea into something clearer." },
];

// Tailwind's xl breakpoint, where current thinking sits beside the conversation.
const WIDE = "(min-width: 80rem)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const closeButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground";

function CopyReply({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy reply"}
      title="Copy"
      className="-ml-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          toast("This browser blocked copying. Select the text to copy it.");
        }
      }}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function ChatView({
  conversationId,
  title,
  initialMessages,
  initialThinkingOpen = false,
}: {
  conversationId?: string;
  title?: string;
  initialMessages: ChatMessage[];
  initialThinkingOpen?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [mode, setMode] = useState<Mode>("think");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(title ?? "");
  const [panelOpen, setPanelOpen] = useState(initialThinkingOpen);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEditing, setSheetEditing] = useState(false);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const sheetOpener = useRef<HTMLElement | null>(null);
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];
  const lastReply = initialMessages.filter((message) => message.role === "assistant").at(-1);
  const thinking = useThinking({ conversationId, lastReply });
  const thinkingVisible = wide ? panelOpen : sheetOpen;

  useEffect(() => {
    // A refresh that lands mid-reply would drop the turn on screen; local state is newer until it ends.
    if (!inFlightRef.current) setMessages(initialMessages);
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

  useEffect(() => {
    if (wide) setSheetOpen(false);
  }, [wide]);

  const { markSeen } = thinking;
  useEffect(() => {
    if (thinkingVisible) markSeen();
  }, [markSeen, thinkingVisible, thinking.notes]);

  function setPanel(next: boolean) {
    document.cookie = `${THINKING_COOKIE}=${next ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
    setPanelOpen(next);
  }

  function openSheet(opener: HTMLElement) {
    sheetOpener.current = opener;
    setSheetOpen(true);
  }

  function openThinking(opener: HTMLElement) {
    if (window.matchMedia(WIDE).matches) setPanel(true);
    else openSheet(opener);
  }

  function toggleThinking(opener: HTMLElement) {
    if (window.matchMedia(WIDE).matches) setPanel(!panelOpen);
    else openSheet(opener);
  }

  async function send(text: string, nextMode = mode, retry = false) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError("");
    setStreaming(true);
    inFlightRef.current = true;
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
            messageId?: string;
            text?: string;
            message?: string;
            indicators?: ChatMessage["indicators"];
            draft?: ChatMessage["draft"];
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
            setMessages((current) =>
              current.map((message) =>
                message.id === "streaming"
                  ? {
                      ...message,
                      id: data.messageId ?? `done-${Date.now()}`,
                      createdAt: new Date().toISOString(),
                      draft: data.draft,
                      indicators: data.indicators?.map((item) => ({ ...item, label: item.label ?? "" })),
                    }
                  : message,
              ),
            );
            if (data.messageId && conversationId) thinking.follow(data.messageId);
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
      inFlightRef.current = false;
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

  const panelProps = {
    state: thinking.state,
    failed: thinking.failed,
    conversationId,
    highlight: thinking.highlight,
    onBrief: thinking.replace,
    onBusy: () => thinking.follow(),
  };

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
      <p className="mt-2 text-center text-xs text-muted-foreground pointer-coarse:hidden">Enter to send. Shift+Enter for a new line.</p>
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
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {title ? (
          <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-2 px-3">
            <span aria-hidden />
            {renaming ? (
              <form
                className="w-[min(28rem,60vw)]"
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
              <button
                type="button"
                className="group inline-flex min-w-0 max-w-md items-center gap-1.5 justify-self-center rounded-md px-2 py-1 text-sm font-medium hover:bg-muted"
                aria-label={`Rename conversation, ${title}`}
                title="Rename"
                onClick={() => setRenaming(true)}
              >
                <span className="truncate">{title}</span>
                <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
              </button>
            )}
            <button
              ref={toggleRef}
              type="button"
              aria-expanded={thinkingVisible}
              aria-controls={wide ? "thinking-panel" : undefined}
              aria-haspopup={wide ? undefined : "dialog"}
              title="Current thinking"
              className={`relative inline-flex h-9 items-center gap-2 justify-self-end rounded-lg px-2.5 text-sm ${
                thinkingVisible ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              onClick={(event) => toggleThinking(event.currentTarget)}
            >
              <NotebookText className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only sm:not-sr-only">Current thinking</span>
              {thinking.unseen && !thinkingVisible ? (
                <>
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary sm:static" aria-hidden />
                  <span className="sr-only">, updated</span>
                </>
              ) : null}
            </button>
          </header>
        ) : null}
        {messages.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-8">
            <h2 className="text-center text-3xl tracking-tight">What are you thinking about?</h2>
            <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
              Frimz keeps what you decide and how the idea changes, so a later conversation can pick up from here.
            </p>
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
                      <p className="inline-flex items-center gap-2.5 text-sm text-muted-foreground" role="status">
                        <span className="thinking inline-flex items-center gap-1" aria-hidden>
                          <span />
                          <span />
                          <span />
                        </span>
                        Thinking
                      </p>
                    ) : message.role === "assistant" ? (
                      <div>
                        {message.draft ? (
                          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                            <FileText className="h-3.5 w-3.5" aria-hidden />
                            Draft · {writeUpFormat(message.draft.format).label}
                          </p>
                        ) : null}
                        <Markdown content={message.content} />
                        {message.indicators?.some((item) => item.label) ? (
                          <div className="mt-4 flex flex-col items-start gap-2">
                            {message.indicators
                              .filter((item) => item.label)
                              .map((item) => (
                                <MemoryNote key={item.memoryId} kind={item.kind} connected={item.type === "connected"} label={item.label} />
                              ))}
                          </div>
                        ) : null}
                        {thinking.notes[message.id] ? (
                          <button
                            type="button"
                            className="memory-indicator mt-3 inline-flex max-w-full items-start gap-2 rounded-md py-1 text-left text-xs text-muted-foreground hover:text-foreground"
                            onClick={(event) => openThinking(event.currentTarget)}
                          >
                            <MemoryGlyph kind="idea_change" className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>Current thinking updated: {thinking.notes[message.id]}</span>
                          </button>
                        ) : null}
                        {message.id !== "streaming" && !message.error ? (
                          <div className="mt-2 flex items-center">
                            <CopyReply content={message.content} />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="max-w-[min(36rem,85%)] whitespace-pre-wrap rounded-[24px] bg-muted px-4 py-2.5 text-[15px] leading-7">{message.content}</p>
                    )}
                  </article>
                ))}
                {error ? (
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" role="alert">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                    <div>
                      <p>{error}</p>
                      <button type="button" className="mt-1.5 font-medium underline underline-offset-4" onClick={() => void send(messages.filter((message) => message.role === "user").at(-1)?.content ?? draft, mode, true)}>Try again</button>
                    </div>
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

      {title && panelOpen ? (
        <aside id="thinking-panel" aria-labelledby="thinking-panel-title" className="thinking-panel hidden h-full w-[22rem] shrink-0 border-l border-border bg-card xl:block">
          <ThinkingPanel
            {...panelProps}
            heading={
              <h2 id="thinking-panel-title" className="text-sm font-medium">
                Current thinking
              </h2>
            }
            close={
              <button
                type="button"
                className={closeButton}
                aria-label="Close current thinking"
                title="Close"
                onClick={() => {
                  setPanel(false);
                  toggleRef.current?.focus();
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            }
          />
        </aside>
      ) : null}

      {title ? (
        <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="drawer-backdrop fixed inset-0 z-40 bg-scrim" />
            <Dialog.Content
              aria-describedby={undefined}
              onEscapeKeyDown={(event) => {
                if (sheetEditing) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (sheetEditing) event.preventDefault();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                const opener = sheetOpener.current;
                (opener?.isConnected ? opener : toggleRef.current)?.focus();
              }}
              className="sheet-panel fixed inset-x-0 bottom-0 z-50 h-[min(88dvh,44rem)] overflow-hidden rounded-t-2xl border-t border-border bg-card shadow-[var(--shadow-soft)] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[min(24rem,92vw)] sm:rounded-none sm:border-l sm:border-t-0"
            >
              <ThinkingPanel
                {...panelProps}
                onEditingChange={setSheetEditing}
                heading={<Dialog.Title className="text-sm font-medium">Current thinking</Dialog.Title>}
                close={
                  <Dialog.Close className={closeButton} aria-label="Close current thinking" title="Close">
                    <X className="h-4 w-4" aria-hidden />
                  </Dialog.Close>
                }
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </div>
  );
}
