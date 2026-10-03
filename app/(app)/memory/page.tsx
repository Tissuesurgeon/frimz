import Link from "next/link";
import { MemoryBrowser } from "@/components/memory/memory-browser";
import { ThinkingList } from "@/components/thinking/thinking-list";
import { requireUser } from "@/server/auth/current-user";
import { listUserBriefs } from "@/server/context/brief-runtime";

export const metadata = { title: "Memory" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ view?: string }> };

function tab(active: boolean) {
  return `-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm ${
    active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
  }`;
}

export default async function MemoryPage({ searchParams }: Props) {
  const thinking = (await searchParams).view === "thinking";
  const user = thinking ? await requireUser() : null;
  const briefs = user ? await listUserBriefs(user.id).catch(() => null) : [];
  return (
    <main id="content" className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl tracking-tight">What Frimz remembers</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {thinking
          ? "Current thinking is the working picture of each idea. Frimz updates it as your conversations move, and you can correct it whenever it drifts."
          : "These are memories from your conversations. Forgetting hides one from future replies."}
      </p>
      <nav aria-label="Memory views" className="mt-6 flex gap-1 border-b border-border">
        <Link href="/memory" aria-current={thinking ? undefined : "page"} className={tab(!thinking)}>
          Memories
        </Link>
        <Link href="/memory?view=thinking" aria-current={thinking ? "page" : undefined} className={tab(thinking)}>
          Current thinking
        </Link>
      </nav>
      <div className="mt-8">
        {!thinking ? (
          <MemoryBrowser />
        ) : briefs ? (
          <ThinkingList briefs={briefs} />
        ) : (
          <p className="text-sm text-destructive" role="alert">
            Current thinking could not be loaded.
          </p>
        )}
      </div>
    </main>
  );
}
