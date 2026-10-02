# Architecture

Frimz is a Next.js application. The browser talks only to Frimz routes. Those routes call `FrimzAgent`, which recalls Walrus memories, builds a prompt, and streams a reply from the Cursor SDK.

## Boundaries

PostgreSQL stores users, sessions, conversations, messages, ideas, idea events, settings, the memory lifecycle index, activity, and logs.

Walrus Memory stores the semantic text of durable memories. One MemWal account serves the app. Each user has the namespace `frimz-user-{userId}`.

Cursor is invoked once per model call. The provider creates a local agent with `tools: []` and `settingSources: []`, sends the full prompt, streams assistant text, and disposes the agent. Conversation history is loaded from PostgreSQL and sent again. `Agent.resume` is not part of the design.

## Request path

`POST /api/chat` authenticates, rate limits, loads or creates a conversation, attaches an idea when the message names one, recalls memories, builds context and a mode addendum, and streams tokens as server-sent events. The assistant message stores indicator ids only. Extraction runs in `after()` and cannot fail the response.

## Adaptation

Working-style memories use type `user_preference`. Active preferences are included in the `WORKING STYLE` section even when semantic recall misses them, because cosine search can drop a loosely worded preference. `ResponseStrategy` turns those lines into behavior instructions. A preference for several alternatives asks the model for several approaches.

## Deployment shape

Run `next start` on Node 22.13+ so the Cursor SDK bridge stays alive. Do not deploy the chat route on a platform that freezes or kills the process between chunks.

## Identity

Auth.js Credentials uses a signed JWT session cookie. The `sessions` table records sign-in. Authorization always uses `session.user.id` from that cookie.
