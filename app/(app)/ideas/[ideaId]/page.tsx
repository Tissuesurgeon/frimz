import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { getIdea } from "@/server/ideas/idea-service";

export const dynamic = "force-dynamic";

export default async function IdeaPage({ params }: { params: Promise<{ ideaId: string }> }) {
  const user = await requireUser();
  if (!user) notFound();
  const { ideaId } = await params;
  const result = await getIdea(user.id, ideaId);
  if (!result) notFound();
  const { idea, events, memories } = result;
  const questions = memories.filter((memory) => memory.type === "open_question");
  const decisions = memories.filter((memory) => memory.type === "decision");
  return (
    <main id="content" className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/ideas" className="text-sm text-muted-foreground">Ideas</Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="text-4xl tracking-tight">{idea.title}</h1>
        <span className="rounded-full border border-border px-2 py-1 text-xs capitalize">{idea.status}</span>
      </div>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Overview</h2>
        <p className="mt-3 leading-7">{idea.description || "No description yet."}</p>
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Current thinking</h2>
        <p className="mt-3 leading-7">{decisions[0]?.content || idea.description || "Still forming."}</p>
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Open questions</h2>
        {questions.length === 0 ? <p className="mt-3 text-muted-foreground">None tied to this idea yet.</p> : (
          <ul className="mt-3 list-disc space-y-2 pl-5">{questions.map((item) => <li key={item.id}>{item.content}</li>)}</ul>
        )}
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Decisions</h2>
        {decisions.length === 0 ? <p className="mt-3 text-muted-foreground">No decision has been remembered yet.</p> : (
          <ul className="mt-3 space-y-2">{decisions.map((item) => <li key={item.id} className="rounded-md border border-border px-3 py-2 text-sm">{item.content}</li>)}</ul>
        )}
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Evolution</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-muted-foreground">History will appear here as this idea changes.</p>
        ) : (
          <ol className="mt-4 space-y-6">
            {events.map((event) => (
              <li key={event.id} className="grid grid-cols-[auto_1fr] gap-x-4">
                <span className="mt-2 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm capitalize text-muted-foreground">{event.kind.replaceAll("_", " ")}</p>
                  <p className="mt-1">{event.summary}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.createdAt.toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Related memories</h2>
        {memories.length === 0 ? <p className="mt-3 text-muted-foreground">No active memories are linked yet.</p> : (
          <ul className="mt-3 space-y-2">{memories.map((memory) => <li key={memory.id} className="text-sm">{memory.content}</li>)}</ul>
        )}
      </section>
    </main>
  );
}
