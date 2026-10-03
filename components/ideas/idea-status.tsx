const STATUS: Record<string, { label: string; tone: string }> = {
  exploring: { label: "Exploring", tone: "border-border text-muted-foreground" },
  developing: { label: "Developing", tone: "border-primary/35 text-primary" },
  active: { label: "Active", tone: "border-success/40 text-success" },
  paused: { label: "Paused", tone: "border-warning/40 text-warning" },
  abandoned: { label: "Set aside", tone: "border-border text-muted-foreground" },
};

export function IdeaStatus({ status }: { status: string }) {
  const item = STATUS[status] ?? STATUS.exploring;
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${item.tone}`}>{item.label}</span>;
}
