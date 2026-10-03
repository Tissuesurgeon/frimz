import Link from "next/link";
import type { BriefSnapshot } from "@/lib/context-brief";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import { IdeaBrief } from "./idea-brief";

export function ThinkingList({ briefs }: { briefs: BriefSnapshot[] }) {
  if (briefs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <div className="mx-auto flex w-fit items-center gap-2 text-muted-foreground" aria-hidden>
          <MemoryGlyph kind="idea" className="h-5 w-5 text-primary" />
          <MemoryGlyph kind="decision" className="h-5 w-5" />
          <MemoryGlyph kind="idea_change" className="h-5 w-5" />
        </div>
        <p className="mt-5 font-medium">No current thinking yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          When a conversation settles on an idea, Frimz writes down where it stands. It shows up here and beside the conversation.
        </p>
        <Link href="/chat" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Start a conversation
        </Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {briefs.map((brief) => (
        <li key={brief.id} className="py-8 first:pt-0 last:pb-0">
          <h2 className="text-xl leading-snug tracking-tight">
            <Link href={`/ideas/${brief.ideaId}`} className="rounded-sm underline-offset-4 hover:underline">
              {brief.title}
            </Link>
          </h2>
          <div className="mt-1">
            <IdeaBrief initial={brief} historyHref={`/ideas/${brief.ideaId}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
