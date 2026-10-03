const LABELS: Record<string, string> = {
  idea: "Idea",
  decision: "Decision",
  idea_change: "Change",
  rejection: "Set aside",
  open_question: "Open question",
  insight: "Insight",
  user_preference: "About you",
  problem: "Problem",
  target_user: "Target user",
  goal: "Goal",
  direction: "Direction",
};

export function memoryKindLabel(kind: string) {
  return LABELS[kind] ?? "Memory";
}

export function MemoryGlyph({ kind, className = "h-4 w-4" }: { kind: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      {shape(kind)}
    </svg>
  );
}

function shape(kind: string) {
  switch (kind) {
    case "decision":
      return <rect x="2.5" y="2.5" width="11" height="11" rx="3" fill="currentColor" stroke="none" />;
    case "idea_change":
      return (
        <>
          <rect x="1.75" y="1.75" width="8" height="8" rx="2.25" />
          <rect x="6.25" y="6.25" width="8" height="8" rx="2.25" fill="currentColor" stroke="none" />
        </>
      );
    case "rejection":
      return (
        <>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />
          <path d="M5 11 11 5" strokeLinecap="round" />
        </>
      );
    case "open_question":
      return <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" pathLength={24} strokeDasharray="2.2 1.8" />;
    case "insight":
      return (
        <>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />
          <rect x="6" y="6" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
        </>
      );
    case "user_preference":
      return (
        <>
          <circle cx="8" cy="8" r="5.25" />
          <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
        </>
      );
    case "problem":
      return (
        <>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />
          <path d="M5.5 8h5" strokeLinecap="round" />
        </>
      );
    case "target_user":
      return (
        <>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />
          <circle cx="8" cy="8" r="2" />
        </>
      );
    case "goal":
      return (
        <>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />
          <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
        </>
      );
    case "direction":
      return (
        <>
          <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />
          <path d="M5.25 8h5.25M8.5 5.75 10.75 8 8.5 10.25" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    default:
      return <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="3" />;
  }
}
