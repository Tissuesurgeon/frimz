"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Brain, Lightbulb, LogOut, Mail, Menu, PanelLeft, Settings, SquarePen, User, X } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeSync } from "@/components/theme-sync";

type Conversation = { id: string; title: string };

const SIDEBAR_KEY = "frimz-sidebar";

function rowClass(active: boolean) {
  return `flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${
    active ? "bg-background font-medium text-foreground" : "text-foreground/85 hover:bg-background"
  }`;
}

function iconButtonClass() {
  return "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground";
}

export function AppShell({
  children,
  user,
  theme,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  theme: "light" | "dark" | "system";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (window.localStorage.getItem(SIDEBAR_KEY) === "closed") setCollapsed(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/conversations")
      .then((response) => response.json())
      .then((body: { conversations?: Conversation[] }) => {
        if (!cancelled) setConversations(body.conversations ?? []);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "closed" : "open");
      return next;
    });
  }

  function SidebarBody({ showCollapse }: { showCollapse: boolean }) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 px-1">
          <Logo href="/chat" />
          {showCollapse ? (
            <button type="button" className={iconButtonClass()} aria-label="Close sidebar" title="Close sidebar" onClick={toggleSidebar}>
              <PanelLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        <Link href="/chat" className={`${rowClass(pathname === "/chat")} mt-2`}>
          <SquarePen className="h-4 w-4 shrink-0" aria-hidden />
          New chat
        </Link>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <p className="px-2 pb-1 text-xs text-muted-foreground">Recent</p>
          <ul className="space-y-0.5">
            {conversations === null ? <li className="h-8 animate-pulse rounded-lg bg-background" /> : null}
            {conversations?.length === 0 ? <li className="px-2 py-2 text-sm text-muted-foreground">No conversations yet.</li> : null}
            {conversations?.map((conversation) => (
              <li key={conversation.id}>
                <Link href={`/chat/${conversation.id}`} className={rowClass(pathname === `/chat/${conversation.id}`)}>
                  <span className="truncate">{conversation.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <nav className="mt-2 space-y-0.5 border-t border-border pt-2" aria-label="Workspace">
          <Link className={rowClass(pathname.startsWith("/ideas"))} href="/ideas">
            <Lightbulb className="h-4 w-4 shrink-0" aria-hidden />
            Ideas
          </Link>
          <Link className={rowClass(pathname.startsWith("/memory"))} href="/memory">
            <Brain className="h-4 w-4 shrink-0" aria-hidden />
            Memory
          </Link>
          <Link className={rowClass(pathname.startsWith("/settings"))} href="/settings">
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            Settings
          </Link>
        </nav>
        <div className="mt-2 space-y-1 border-t border-border px-2 pt-3 text-sm">
          <p className="flex min-w-0 items-center gap-2 font-medium">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{user.name}</span>
          </p>
          <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{user.email}</span>
          </p>
          <button
            type="button"
            className="mt-1 flex items-center gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <ThemeSync theme={theme} />
      <aside className={`${collapsed ? "hidden" : "hidden lg:flex"} h-full w-[260px] shrink-0 flex-col border-r border-border bg-muted px-2 py-2`}>
        <SidebarBody showCollapse />
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-foreground/30" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="relative z-10 h-full w-[min(20rem,88vw)] border-r border-border bg-muted px-2 py-2">
            <SidebarBody showCollapse={false} />
          </aside>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <button type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="inline-flex items-center gap-2 text-sm tracking-[0.14em]">
            <LogoMark className="h-5 w-5" />
            FRIMZ
          </span>
          <span className="w-5" />
        </header>
        {collapsed ? (
          <div className="hidden shrink-0 items-center gap-1 px-2 py-1.5 lg:flex">
            <button type="button" className={iconButtonClass()} aria-label="Open sidebar" title="Open sidebar" onClick={toggleSidebar}>
              <PanelLeft className="h-5 w-5" />
            </button>
            <Link href="/chat" className={iconButtonClass()} aria-label="New chat" title="New chat">
              <SquarePen className="h-5 w-5" />
            </Link>
          </div>
        ) : null}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 overflow-y-auto">{children}</div>
        </div>
      </div>
      {open ? (
        <button className="sr-only" onClick={() => setOpen(false)}>
          <X />
        </button>
      ) : null}
    </div>
  );
}
