import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { listIdeas } from "@/server/ideas/idea-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ideas" };

export default async function IdeasPage() {
  const user = await requireUser();
  if (!user) return null;
  const ideas = await listIdeas(user.id);
  return (
    <main id="content" className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl tracking-tight">Ideas</h1>
      <p className="mt-2 text-sm text-muted-foreground">Concepts Frimz is keeping in view. They appear from real conversations.</p>
      {ideas.length === 0 ? (
        <div className="mt-10 rounded-lg border border-border bg-card p-6">
          <p>You don&apos;t have any ideas yet.</p>
          <Link href="/chat" className="mt-4 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Start a conversation</Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link href={`/ideas/${idea.id}`} className="block rounded-lg border border-border bg-card p-5 hover:bg-muted/50">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg">{idea.title}</h2>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">{idea.status}</span>
                </div>
                {idea.description ? <p className="mt-2 text-sm text-muted-foreground">{idea.description}</p> : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  Updated {idea.updatedAt.toLocaleDateString()} · {idea.eventCount} evolution {idea.eventCount === 1 ? "event" : "events"}
                </p>
                {idea.openQuestions.length > 0 ? <p className="mt-2 text-sm">Open: {idea.openQuestions[0]}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
