export const CURSOR_UNAVAILABLE =
  "Frimz couldn't connect to its AI model right now. Please try again.";

export const MEMORY_GROUPS = [
  { id: "user_preference", label: "About you" },
  { id: "idea", label: "Ideas" },
  { id: "decision", label: "Decisions" },
  { id: "insight", label: "Insights" },
  { id: "rejection", label: "Rejected directions" },
  { id: "open_question", label: "Open questions" },
] as const;
