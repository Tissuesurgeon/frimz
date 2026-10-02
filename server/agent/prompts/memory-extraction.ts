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
- Preferences are working style only: response length, technical depth, number of alternatives, challenge level, communication style, structure, brainstorming style.
- Do not turn a preference into an idea event. Leave ideaTitle empty for preferences.
- Set changesIdea true only when an insight changes the idea's direction.
- Set supersedes when the user changed their mind, so the older statement can be retired.
- Skip greetings, filler, and anything with no future value.
- Do not invent facts the user did not express.
- If nothing is worth remembering, return {"memories":[]}.`;
