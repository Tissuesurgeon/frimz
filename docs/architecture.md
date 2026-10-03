# Architecture

Frimz is a Next.js application. The browser talks only to Frimz routes. Those routes call `FrimzAgent`, which loads the idea's context brief, recalls Walrus memories, builds a prompt, and streams a reply from the Cursor SDK.

## Boundaries

PostgreSQL stores users, sessions, conversations, messages, ideas, idea events, settings, the memory lifecycle index, activity, logs, and the context briefs with every version of them.

Walrus Memory stores the semantic text of durable memories. One MemWal account serves the app. Each user has the namespace `frimz-user-{userId}`.

Cursor is invoked once per model call: a reply, a memory extraction, a brief synthesis, or a write-up. The provider creates a local agent with `tools: []` and `settingSources: []`, sends the full prompt, streams or collects assistant text, and disposes the agent. Conversation history is loaded from PostgreSQL and sent again. `Agent.resume` is not part of the design.

## Request path

`POST /api/chat` authenticates, rate limits, loads or creates a conversation, resolves the idea (the conversation's current idea, a named idea, or a conservative word-overlap match), recalls memories, and loads that idea's context brief.

Most turns build `FrimzContext` with the brief as its first section, add the mode and strategy addendum, and stream tokens as server-sent events. A write-up turn routes to `WriteUpGenerator` instead. It runs when the user accepts a draft offer, asks for a write-up, or asks to revise the draft just above.

The assistant message stores indicator ids, plus a draft offer or a draft marker when one applies. The `done` event carries the saved message id, which the chat uses to follow the background step.

## Background step

`updateThinkingAfterTurn` runs in `after()` and cannot fail the response:

1. Extract memories and write them to Walrus, as before.
2. Link the conversation to the idea the extraction found.
3. If the turn made meaningful progress, mark the idea's brief stale.
4. If a newer user message already exists, stop. That turn's step covers both.
5. Otherwise run `synthesizeBrief`, which re-reads the stale mark after each round. It runs at most three rounds, so messages that land during synthesis are covered.
6. Record the reply as processed in `conversations.context_checked_message_id`.

Meaningful progress means a kept memory other than a working-style preference, or a new or changed idea.

`synthesizeBrief` takes a lock column (`synthesizing_at`) that expires after three minutes, so a crashed run cannot hold it. It loads the idea, the current brief, the idea's active memories, and the recent conversation. It calls `ContextSynthesizer`, applies the guards, and saves a version only when the result differs. The save checks the version it read. When an edit landed in between, the round reads the edit and runs again.

`GET /api/conversations/:id/brief` returns the brief, whether an update is pending, and the last processed reply id. The chat polls it every three seconds after a reply, for up to three minutes and for as long as an update is running.

## Context brief

```text
ContextBrief         one per idea     context_briefs
ContextBriefVersion  append-only      context_brief_versions
ContextSynthesizer   LLMProvider.generate → JSON → parse → guards
WriteUpGenerator     LLMProvider.stream → Markdown draft
```

The guards in `server/context/brief-guards.ts` keep Frimz from turning its own suggestions into user decisions. They also keep it from inventing facts, dropping decisions without a reason, or overwriting a section the user corrected.

`GET`, `PATCH`, and `POST /api/ideas/:id/brief` read, edit, and regenerate a brief. Each route checks that the idea belongs to the signed-in user. Edits send `baseVersion` and get 409 with the newer brief when it moved. Regenerate gets 409 while a background update holds the lock. Both are rate limited per user.

A version that changes the problem, target user, goal, or direction adds an `idea_events` row. When the same turn's extraction already logged an idea change, the direction event is skipped.

## Adaptation

Working-style memories use type `user_preference`. Active preferences are included in the `WORKING STYLE` section even when semantic recall misses them, because cosine search can drop a loosely worded preference. `ResponseStrategy` turns those lines into behavior instructions. A preference for several alternatives asks the model for several approaches.

## Deployment shape

Run the standalone Node 22.13+ server so the Cursor SDK bridge stays alive. Do not deploy the chat route on a platform that freezes or kills the process between chunks. The background step needs the process to stay up after the response finishes.

## Identity

Auth.js Credentials uses a signed JWT session cookie. The `sessions` table records sign-in. Authorization always uses `session.user.id` from that cookie.
