export function indicatorPhrase(type: string) {
  switch (type) {
    case "decision":
      return "Used an earlier decision.";
    case "rejection":
      return "Used a direction you had set aside.";
    case "idea_change":
      return "Used how this idea changed.";
    case "insight":
      return "Used an earlier insight.";
    case "open_question":
      return "Used an open question.";
    case "idea":
      return "Used an earlier idea.";
    default:
      return "Used earlier context.";
  }
}
