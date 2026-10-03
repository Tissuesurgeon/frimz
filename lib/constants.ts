export const CURSOR_UNAVAILABLE =
  "Frimz couldn't connect to its AI model right now. Please try again.";

export const SIDEBAR_COOKIE = "frimz-sidebar";
export const THINKING_COOKIE = "frimz-thinking";

export const MEMORY_GROUPS = [
  { id: "user_preference", label: "About you" },
  { id: "idea", label: "Ideas" },
  { id: "decision", label: "Decisions" },
  { id: "insight", label: "Insights" },
  { id: "rejection", label: "Directions set aside" },
  { id: "open_question", label: "Open questions" },
] as const;
