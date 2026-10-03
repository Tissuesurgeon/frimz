import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listIdeas } from "@/server/ideas/idea-service";
import { MemoryGlyph } from "@/components/brand/memory-glyph";
import { IdeaStatus } from "@/components/ideas/idea-status";
import { shortDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ideas" };

export default async function IdeasPage() {
  const user = await requireUser();
  if (!user) return null;
  const ideas = await listIdeas(user.id);
  return (
    <main id="content" className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl tracking-tight">Ideas</h1>
      <p className="mt-2 text-sm text-muted-foreground">Concepts Frimz is keeping in view. Each one comes from a real conversation.</p>
      {ideas.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 text-muted-foreground" aria-hidden>
            <MemoryGlyph kind="idea" className="h-5 w-5" />
            <MemoryGlyph kind="idea_change" className="h-5 w-5" />
            <MemoryGlyph kind="decision" className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-5 font-medium">No ideas yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            When a conversation shapes an idea, it appears here with its decisions, open questions, and the way it changed.
          </p>
          <Link href="/chat" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Start a conversation
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link
                href={`/ideas/${idea.id}`}
                className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/25"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg leading-snug">{idea.title}</h2>
                  <IdeaStatus status={idea.status} />
                </div>
                {idea.description ? <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{idea.description}</p> : null}
                {idea.openQuestions.length > 0 ? (
                  <p className="mt-3 flex items-start gap-2 text-sm">
                    <MemoryGlyph kind="open_question" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-1">
                      <span className="sr-only">Open question: </span>
                      {idea.openQuestions[0]}
                    </span>
                  </p>
                ) : null}
                <p className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  <span>Updated {shortDate(idea.updatedAt)}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MemoryGlyph kind="idea_change" className="h-3.5 w-3.5" />
                    {idea.eventCount} {idea.eventCount === 1 ? "change" : "changes"} recorded
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
