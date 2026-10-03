export const MEMORY_EXTRACTION_PROMPT = `Extract durable memories from the conversation.

Store a memory only if remembering it would improve a future conversation.

Return JSON only, with this shape:
{
  "memories": [
    {
      "type": "user_preference | idea | decision | rejection | insight | open_question | idea_change",
      "content": "one durable statement",
      "reason": "why it matters, if known",
      "importance": 0.0,
      "ideaTitle": "short idea name or empty",
      "supersedes": "short quote of the older memory this replaces, or empty",
      "changesIdea": false
    }
  ],
  "idea": {
    "title": "current idea title",
    "description": "one or two sentences",
    "status": "exploring | developing | active | paused | abandoned"
  }
}

Rules:
- The idea is the piece of work the conversation develops: a product, a project, a plan, or a problem the user keeps working on. Include idea whenever the conversation develops one, and give the memories about it the same ideaTitle. Leave idea out only for small talk or a one-off question.
- When the conversation continues the current idea or one of the other ideas listed, use that exact title for idea.title and ideaTitle, even when the framing changes. Describe the change in the description and as an idea_change memory. A new title is for a genuinely different idea.
- Preferences are working style only: response length, technical depth, number of alternatives, challenge level, communication style, structure, brainstorming style.
- Do not turn a preference into an idea event. Leave ideaTitle empty for preferences.
- Set changesIdea true only when an insight changes the idea's direction.
- Set supersedes when the user changed their mind, so the older statement can be retired.
- Skip greetings, filler, and anything with no future value.
- Do not invent facts the user did not express.
- If nothing is worth remembering, return {"memories":[]}.`;
