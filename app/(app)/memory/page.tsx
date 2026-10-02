import { MemoryBrowser } from "@/components/memory/memory-browser";

export const metadata = { title: "Memory" };

export default function MemoryPage() {
  return (
    <main id="content" className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl tracking-tight">What Frimz remembers</h1>
      <p className="mt-2 text-sm text-muted-foreground">These are memories from your conversations. Forgetting hides one from future replies.</p>
      <div className="mt-8">
        <MemoryBrowser />
      </div>
    </main>
  );
}
