import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MemoryGlyph } from "@/components/brand/memory-glyph";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-6">
        <Logo href="/" />
      </header>
      <main id="content" className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-24">
        <MemoryGlyph kind="open_question" className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-6 text-3xl tracking-tight">That page is not here.</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">The conversation or idea may belong to another account, or the link may be out of date.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/chat" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Open your conversations
          </Link>
          <Link href="/" className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
            Back to Frimz
          </Link>
        </div>
      </main>
    </div>
  );
}
