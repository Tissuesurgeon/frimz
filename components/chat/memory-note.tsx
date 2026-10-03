import { MemoryGlyph } from "@/components/brand/memory-glyph";

export function MemoryNote({ kind, connected = false, label }: { kind?: string; connected?: boolean; label: string }) {
  return (
    <p className="memory-indicator inline-flex max-w-full items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
      <MemoryGlyph kind={kind ?? "idea"} className="mt-px h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{connected ? "Connected to an earlier idea" : "Remembered context"}</span>
        <span className="mt-0.5 block line-clamp-2">{label}</span>
      </span>
    </p>
  );
}
