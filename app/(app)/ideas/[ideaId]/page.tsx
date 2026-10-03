import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getIdea } from "@/server/ideas/idea-service";
import { MemoryGlyph, memoryKindLabel } from "@/components/brand/memory-glyph";
import { IdeaStatus } from "@/components/ideas/idea-status";
import { BriefVersions, IdeaBrief } from "@/components/thinking/idea-brief";
import { dateTime } from "@/lib/dates";
import { idSchema } from "@/lib/validators";
import { loadIdeaBrief } from "@/server/context/brief-runtime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ideaId: string }> };

const loadIdea = cache(async (ideaId: string) => {
  const user = await requireUser();
  if (!user || !idSchema.safeParse(ideaId).success) return null;
  const result = await getIdea(user.id, ideaId);
  if (!result) return null;
  const thinking = await loadIdeaBrief(user.id, ideaId).catch(() => ({ brief: null, versions: [], updating: false }));
  return { ...result, thinking };
});

const heading = "text-sm font-medium text-muted-foreground";

export async function generateMetadata({ params }: Params) {
  const result = await loadIdea((await params).ideaId);
  return result ? { title: result.idea.title } : {};
}

export default async function IdeaPage({ params }: Params) {
  const result = await loadIdea((await params).ideaId);
  if (!result) notFound();
  const { idea, events, memories, thinking } = result;
  const brief = thinking.brief;
  const questions = memories.filter((memory) => memory.type === "open_question");
  const decisions = memories.filter((memory) => memory.type === "decision");
  const inTimeline = new Set(events.map((event) => event.memoryId));
  const related = memories.filter((memory) => memory.type !== "open_question" && memory.type !== "decision" && !inTimeline.has(memory.id));
  return (
    <main id="content" className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/ideas" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Ideas
      </Link>
      <div className="mt-5 flex items-start justify-between gap-4">
        <h1 className="text-4xl leading-tight tracking-tight">{idea.title}</h1>
        <span className="mt-2.5">
          <IdeaStatus status={idea.status} />
        </span>
      </div>
      {idea.description ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{idea.description}</p> : null}

      {brief ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-5" aria-labelledby="current-thinking">
          <h2 id="current-thinking" className={`flex items-center gap-2 ${heading}`}>
            <MemoryGlyph kind="idea" className="h-4 w-4 text-primary" />
            Current thinking
          </h2>
          <div className="mt-2">
            <IdeaBrief initial={brief} />
          </div>
        </section>
      ) : decisions[0] ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className={`flex items-center gap-2 ${heading}`}>
            <MemoryGlyph kind="decision" className="h-4 w-4 text-primary" />
            Where it stands
          </h2>
          <p className="mt-2 leading-relaxed">{decisions[0].content}</p>
        </section>
      ) : null}

      {brief ? null : (
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <section>
            <h2 className={heading}>Open questions</h2>
            {questions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Nothing is open for this idea right now.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {questions.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <MemoryGlyph kind="open_question" className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="leading-relaxed">{item.content}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className={heading}>Decisions</h2>
            {decisions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Decisions appear here once you make one.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {decisions.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <MemoryGlyph kind="decision" className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span className="leading-relaxed">{item.content}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className="mt-12">
        <h2 className={heading}>How it changed</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">History will appear here as this idea changes.</p>
        ) : (
          <ol className="mt-5">
            {events.map((event, index) => (
              <li key={event.id} className="relative grid grid-cols-[1.75rem_1fr] gap-x-3 pb-7 last:pb-0">
                {index < events.length - 1 ? (
                  <span className="absolute bottom-0 left-[calc(0.875rem-0.75px)] top-7 w-[1.5px] bg-border" aria-hidden />
                ) : null}
                <span className="relative grid h-7 w-7 place-items-center rounded-lg border border-border bg-background text-primary" aria-hidden>
                  <MemoryGlyph kind={event.kind} className="h-3.5 w-3.5" />
                </span>
                <div className="pt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {memoryKindLabel(event.kind)} · <time dateTime={event.createdAt.toISOString()}>{dateTime(event.createdAt)}</time>
                  </p>
                  <p className="mt-1 leading-relaxed">{event.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {thinking.versions.length > 0 ? (
        <section className="mt-12" aria-labelledby="brief-versions">
          <h2 id="brief-versions" className={heading}>
            Versions of current thinking
          </h2>
          <BriefVersions versions={thinking.versions} />
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-12">
          <h2 className={heading}>Other memories about this idea</h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {related.map((memory) => (
              <li key={memory.id} className="flex items-start gap-3 px-4 py-3">
                <MemoryGlyph kind={memory.type} className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{memoryKindLabel(memory.type)}</p>
                  <p className="mt-0.5 text-sm leading-relaxed">{memory.content}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
