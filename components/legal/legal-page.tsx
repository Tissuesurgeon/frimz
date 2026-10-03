import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const pages = [
  { id: "privacy", href: "/privacy", label: "Privacy" },
  { id: "terms", href: "/terms", label: "Terms" },
] as const;

export function LegalPage({ current, title, children }: { current: (typeof pages)[number]["id"]; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
          <Logo href="/" />
          <nav aria-label="Legal" className="flex gap-5 text-sm">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={page.href}
                aria-current={page.id === current ? "page" : undefined}
                className={`rounded-sm underline-offset-4 hover:underline ${page.id === current ? "text-foreground" : "text-muted-foreground"}`}
              >
                {page.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="content" className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="text-4xl tracking-tight">{title}</h1>
        <div className="mt-6 max-w-[65ch] space-y-4 leading-relaxed text-foreground/85">{children}</div>
      </main>
    </div>
  );
}
