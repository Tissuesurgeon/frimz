"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Brain, Lightbulb, LogOut, Menu, PanelLeft, Settings, SquarePen, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeSync } from "@/components/theme-sync";
import { SIDEBAR_COOKIE } from "@/lib/constants";

type Conversation = { id: string; title: string };
type User = { name: string; email: string };

const iconButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground";

function rowClass(active: boolean) {
  return `flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${
    active ? "bg-background font-medium text-foreground" : "text-foreground/85 hover:bg-background"
  }`;
}

function initials(user: User) {
  const words = (user.name.trim() || user.email).split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : words[0]?.slice(0, 2) ?? "";
  return letters.toUpperCase();
}

function SidebarBody({
  pathname,
  conversations,
  user,
  onCollapse,
  onClose,
}: {
  pathname: string;
  conversations: Conversation[] | null;
  user: User;
  onCollapse?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-1">
        <Logo href="/chat" />
        {onCollapse ? (
          <button type="button" className={iconButton} aria-label="Close sidebar" title="Close sidebar" onClick={onCollapse}>
            <PanelLeft className="h-5 w-5" />
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className={iconButton} aria-label="Close menu" autoFocus onClick={onClose}>
            <X className="h-5 w-5" />
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
          {conversations === null
            ? [72, 56, 64].map((width) => (
                <li key={width} className="px-2 py-2.5" aria-hidden>
                  <span className="block h-3 animate-pulse rounded bg-background" style={{ width: `${width}%` }} />
                </li>
              ))
            : null}
          {conversations?.length === 0 ? <li className="px-2 py-2 text-sm text-muted-foreground">No conversations yet.</li> : null}
          {conversations?.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/chat/${conversation.id}`}
                aria-current={pathname === `/chat/${conversation.id}` ? "page" : undefined}
                className={rowClass(pathname === `/chat/${conversation.id}`)}
              >
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
      <div className="mt-2 flex items-center gap-2.5 border-t border-border px-1 pt-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-medium text-forest-foreground" aria-hidden>
          {initials(user)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <button type="button" className={iconButton} aria-label="Sign out" title="Sign out" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user,
  theme,
  initialCollapsed,
}: {
  children: React.ReactNode;
  user: User;
  theme: "light" | "dark" | "system";
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const menuButton = useRef<HTMLButtonElement | null>(null);
  const drawer = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      // The menu button is inert while the drawer is open, so focus waits for this commit.
      if (returnFocus.current) menuButton.current?.focus();
      returnFocus.current = false;
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        returnFocus.current = true;
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer.current) return;
      const items = drawer.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !drawer.current.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first?.focus();
      }
    };
    // Tailwind's lg breakpoint, where the drawer is hidden and the sidebar takes over.
    const wide = window.matchMedia("(min-width: 64rem)");
    const onWide = () => {
      if (wide.matches) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

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
    const next = !collapsed;
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "closed" : "open"}; path=/; max-age=31536000; samesite=lax`;
    setCollapsed(next);
  }

  function closeMenu() {
    returnFocus.current = true;
    setOpen(false);
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <ThemeSync theme={theme} />
      <aside className={`${collapsed ? "hidden" : "hidden lg:flex"} h-full w-[260px] shrink-0 flex-col border-r border-border bg-muted px-2 py-2`}>
        <SidebarBody pathname={pathname} conversations={conversations} user={user} onCollapse={toggleSidebar} />
      </aside>
      {open ? (
        <div ref={drawer} className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer-backdrop absolute inset-0 bg-scrim" aria-hidden onClick={closeMenu} />
          <aside className="drawer-panel relative z-10 h-full w-[min(20rem,88vw)] border-r border-border bg-muted px-2 py-2 shadow-[var(--shadow-soft)]">
            <SidebarBody pathname={pathname} conversations={conversations} user={user} onClose={closeMenu} />
          </aside>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={open}>
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-2 lg:hidden">
          <button ref={menuButton} type="button" className={iconButton} aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <Logo href="/chat" />
          <Link href="/chat" className={iconButton} aria-label="New chat" title="New chat">
            <SquarePen className="h-5 w-5" />
          </Link>
        </header>
        {collapsed ? (
          <div className="hidden shrink-0 items-center gap-1 px-2 py-1.5 lg:flex">
            <button type="button" className={iconButton} aria-label="Open sidebar" title="Open sidebar" onClick={toggleSidebar}>
              <PanelLeft className="h-5 w-5" />
            </button>
            <Link href="/chat" className={iconButton} aria-label="New chat" title="New chat">
              <SquarePen className="h-5 w-5" />
            </Link>
          </div>
        ) : null}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 overflow-y-auto [scrollbar-gutter:stable]">{children}</div>
        </div>
      </div>
    </div>
  );
}
