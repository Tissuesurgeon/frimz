# We Built an AI Thinking Partner That Remembers How We Think

## 1. The problem

A normal chatbot can be useful for an hour and useless the next day, because the path of the idea left with the tab.

## 2. The idea

Frimz is a thinking partner. It explores, challenges, and helps shape an idea, and it keeps the decisions and rejections that matter later. The person using it still decides.

## 3. Who it's for

People developing ideas and projects over more than one sitting: founders, developers, marketers, researchers, students, and hackathon teams.

## 4. Why memory matters

Remembering a decision, a rejected direction, an insight, a preference, or an open question is more useful than replaying every sentence. Frimz extracts those and leaves the rest in the transcript.

## 5. Architecture

```text
Frimz Agent
     ↓
Memory Orchestrator
     ↓
Walrus Memory
     ↓
Context
     ↓
Cursor LLM
```

Frimz owns the agent. Walrus stores semantic memory. Cursor is the model.

## 6. Cursor integration

`@cursor/sdk` is called on the server with an empty tool list. Each request is a new local agent that receives the full Frimz prompt and is then disposed. Cursor's own agent transcript is not the product memory.

## 7. Walrus integration

MemWal `rememberAndWait` and `recall` run inside a namespace per user. A PostgreSQL index tracks active, superseded, and forgotten memories because Walrus blobs are immutable and the SDK does not offer a normal update or list-all call.

## 8. Before vs after

To be written after real sessions. Do not invent a comparison.

## 9. Real user testing

To be written after real people have used their own accounts. Do not invent users or counts.

## 10. Idea evolution

To be written from an actual idea timeline. Do not invent the steps.

## 11. Cross-session memory

To be written from a real return visit. Do not invent the recall.

## 12. What we learned

To be written from building and from those sessions.

## 13. Walrus feedback

See [walrus-feedback.md](walrus-feedback.md). Add only issues that were actually encountered.
