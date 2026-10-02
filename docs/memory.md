# Memory

Walrus Memory is the semantic store. PostgreSQL `memory_index` is the lifecycle catalog: type, status, content, reason, idea, blob id, and which memory a row supersedes.

## What is stored

Extraction runs after the reply. The model returns JSON. Validation drops empty, short, ephemeral, low-importance, and instruction-like items. Duplicates of an active memory are skipped. When a new memory names the older text it replaces, that older row becomes `superseded` and the new row becomes `active`.

Types: `user_preference`, `idea`, `decision`, `rejection`, `insight`, `open_question`, `idea_change`.

## Recall

For each user message, Frimz calls `recall` in `frimz-user-{userId}` and then:

- drops hits with no index row
- drops forgotten and superseded rows
- drops distances at or above 0.6
- ranks preferences and the current idea ahead of other hits
- keeps at most eight memories in the prompt

Active preferences are also loaded from the index so working style is not lost when wording does not match the query closely.

Indicators are created for non-preference memories that were recalled. Preferences change behavior quietly. Message metadata stores `{ type, memoryId }` only. The label is read from the index when the transcript is shown.

## Ideas

An idea event is written only when the memory is tied to an idea and is an idea, decision, rejection, idea change, open question, or an insight marked as changing the idea. Preferences never become events.

## Forgetting and editing

`PATCH /api/memories/:id` writes a new Walrus memory and marks the previous row superseded.

`DELETE /api/memories/:id` marks the row forgotten. Retrieval skips it. The UI says the memory will no longer be used. It does not say the blob was deleted.

## Failure

If Walrus is not configured or a recall fails, the turn continues with whatever preferences are already in the index, and the failure is logged without secrets. Extraction failures are logged and do not change the reply the user already received.
