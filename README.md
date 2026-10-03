# Frimz

Frimz is an AI thinking partner that remembers the evolution of your thinking and turns that accumulated context into something you can keep building on.

```text
Think.
Explore.
Develop.
Remember.
Return.
Continue.
Build.
```

## What is Frimz?

Frimz helps people develop ideas over time: founders, developers, marketers, researchers, students, and anyone working on a project that does not fit in one chat.

Ordinary chats forget the path that led to the current idea. Frimz keeps the durable parts of that path — preferences, decisions, rejected directions, insights, open questions, and changes of direction — and uses them when they are relevant later.

Frimz does not make decisions for the user. It helps the user think through decisions.

## The problem

```text
Conversation happens
        ↓
Useful context appears
        ↓
Conversation ends
        ↓
Context becomes difficult to reuse
        ↓
User has to explain everything again
```

That cost grows when an idea develops over days. The useful part is rarely the full transcript. It is the decision, the rejection, and the question that was left open.

## The solution

```text
THINK
  ↓
DISCUSS
  ↓
EXPLORE
  ↓
DEVELOP
  ↓
CAPTURE
  ↓
REMEMBER
  ↓
STRUCTURE
  ↓
RETURN
  ↓
CONTINUE
  ↓
BUILD
```

A later conversation can continue the idea, explain a rejection, and reconstruct how the idea arrived, using memories that came from earlier real messages. Each idea also keeps a living picture of where the thinking stands, which the user can read, correct, and turn into a written draft.

## Key features

- Persistent memory of thinking, not a copy of every message
- Conversations that continue across sessions and devices for the same account
- Living context: a versioned, editable "Current thinking" brief for each idea
- Idea evolution from real idea events
- Working-style adaptation from stored preferences
- Memory inspection, editing, and forgetting
- Write-ups drafted from the accumulated context, offered when a conversation wraps up
- Think, Plan, Write, and Challenge modes on one agent

## Why memory matters

Frimz does not store every message as a permanent memory. After a reply is streamed, extraction looks for durable information:

```text
Preferences
Ideas
Decisions
Rejected directions
Insights
Open questions
Idea changes
```

Lifecycle:

```text
Discover
 ↓
Extract
 ↓
Validate
 ↓
Store
 ↓
Recall
 ↓
Use
 ↓
Update
 ↓
Supersede / Forget
```

A memory is kept when it would help a future conversation. Editing writes a new Walrus blob and marks the previous index row superseded. Forgetting marks the row forgotten so retrieval skips it. Walrus blobs are immutable; forgetting does not claim a physical delete.

## Living Context

Every idea has one **context brief**, shown in the app as "Current thinking". It is Frimz's working understanding of what the user is working on: a structured, versioned picture of where the thinking stands.

```text
Where it stands      a short paragraph
Problem              Target user          Goal
Current idea         Current direction
Key insights         Decisions (with reasons)
Directions set aside (with reasons)       Assumptions
Open questions       Next to explore      How it got here
```

Only filled sections are shown. A section is never padded with a guess.

### Why it exists

Memories are atomic. "Start with individual students" and "universities have a slow sales cycle" are separate facts, recalled one at a time by meaning. That suits recall. A returning conversation also needs the whole picture at once: which decisions hold, which directions are closed, and what is still open. The brief is that picture, kept current so Frimz starts each turn from it and so the user can read it, correct it, and take it elsewhere.

### How it differs from memory

| | Walrus memories | Context brief |
| --- | --- | --- |
| Shape | One durable fact per memory | One structured document per idea |
| Store | Walrus Memory, catalogued in `memory_index` | PostgreSQL `context_briefs`, every version in `context_brief_versions` |
| Written by | Extraction after a reply | `ContextSynthesizer` after meaningful progress, or the user |
| Used for | Recalling the relevant pieces by meaning | The first section of Frimz's context on every turn about the idea |
| A change | New blob, older row superseded | New version, earlier versions kept |

The brief is built from memories and the conversation. It never replaces them: Walrus stays the semantic store, and superseded or forgotten memories stay out of synthesis because only active index rows are read.

### How it is generated and updated

```text
Reply streamed and saved
        ↓
after(): memory extraction to Walrus (unchanged)
        ↓
Meaningful progress?   a kept memory other than a preference, or a new or changed idea
        ↓ yes
Mark the idea's brief stale
        ↓
Newer user message waiting?   yes → stop; the next turn's step covers both
        ↓ no
Take the synthesis lock (expires after three minutes)
        ↓
ContextSynthesizer   idea + current brief + active memories + last 30 messages
        ↓
Guards
        ↓
Different from the current brief?   no → clear the stale mark, keep the version
        ↓ yes
Save version N + 1, checked against the version it read
        ↓
Idea events for a new problem, target user, goal, or direction
```

The step runs in `after()`, so it never delays or breaks a reply. A failure is logged and the brief stays at its previous version. `ContextSynthesizer` calls the existing `LLMProvider`, so Cursor stays the only model, and each call is a fresh agent with no tools.

The synthesis prompt labels every line USER or FRIMZ and asks for JSON. The guards in `server/context/brief-guards.ts` then enforce what a model cannot be trusted to keep:

- **Decisions belong to the user.** A decision or a set-aside direction needs support: a user line, an existing brief item, an active memory, or a Frimz suggestion the user explicitly accepted ("yes, let's do that"). An unaccepted suggestion stays a suggestion.
- **Facts come from the user.** The problem, target user, goal, and current idea must share words with something the user said.
- **Nothing vanishes quietly.** A decision, set-aside direction, or open question that disappears without a stated reason is restored. A changed direction moves the earlier one into "How it got here".
- **The latest user direction wins, and history is kept.** A reversal replaces the current direction, and the earlier one stays visible as history.
- **Corrections stick.** A section the user edited keeps the user's text until the user says something newer about it.
- **Placeholders and injection are dropped.** "N/A", "TBD", duplicates, and instruction-like text never reach a version. Lists are capped.

### How it shapes later conversations

```text
User message
     ↓
Resolve idea ──→ load its brief ──→ recall Walrus memories
     ↓
FRIMZ CONTEXT
  CURRENT CONTEXT BRIEF (version N)     first, with user-corrected sections marked
  IDEA, WORKING STYLE, RELEVANT MEMORIES
  CONVERSATION
     ↓
Reply
```

The brief is framed as the working understanding built from earlier turns. The newest user message leads: when it points somewhere new, Frimz follows it, and the brief catches up after the reply. A new conversation about the same idea finds its brief through the idea title, with a conservative word-overlap match for a first message that paraphrases it.

### How the user edits it

"Current thinking" opens from the conversation header: a side panel on wide screens, a sheet on smaller ones, and a bottom sheet on phones. It also appears on the idea page and under Memory → Current thinking.

- **Copy** puts the brief on the clipboard as Markdown.
- **Edit** saves a version with source `edit` and marks the changed sections as corrected by the user. If a background update landed first, the save returns 409 and the editor keeps the draft, so the user can lay their changes over the new version.
- **Regenerate** rebuilds the brief from the idea's conversations and memories. It returns 409 while a background update holds the lock. User corrections survive a rebuild.

After a reply, the chat checks every three seconds, for up to three minutes and for as long as an update is running, until the background step has seen that reply. A new version updates in place, highlights the sections that changed (except under reduced motion), and leaves a quiet "Current thinking updated" note under the reply.

### How it connects to idea evolution

A version that changes the problem, target user, goal, or direction adds an idea event, so the timeline shows those moments next to the memory-driven events. The idea page shows the current brief in place of the older decision summary, lists every version with its change summary, and opens earlier versions read-only.

### How it supports write-ups

There is no draft button. When the user wraps up ("thanks, that's all", "I have what I need", "I'll start building") and the brief has substance, Frimz says where the thinking landed and asks once whether a written draft would help, naming two or three fitting formats. A substantial brief has a problem, idea, or goal, plus a direction or decision, across at least four sections. Frimz asks once per brief version.

```text
Wrap-up message ──→ brief draftable, no offer at this version? ──→ summary + one offer
                                                                         ↓
"yes" · "a proposal" · "a one-pager for investors" ──→ WriteUpGenerator ──→ draft, labelled in chat
"make it shorter" right after a draft ──────────────→ revision of that draft
"write this up as a project brief" at any time ─────→ draft
```

`WriteUpGenerator` streams through the same `LLMProvider`. Its inputs are the brief, the idea's active memories, the recent conversation, and the previous draft when revising. It invents no names, numbers, dates, or results; it labels assumptions and keeps open questions open; Frimz suggestions appear as options. Formats: project brief, product concept, problem statement, research summary, proposal, business concept, technical concept, strategy document, thinking summary, or a custom shape the user describes. Draft bodies collapse to one line in the extraction and synthesis inputs, so Frimz's own prose never feeds back into memories or the brief.

### Conceptual architecture

```text
                           FRIMZ
                             │
                    AI THINKING PARTNER
                             │
             ┌───────────────┼────────────────┐
             │               │                │
           THINK          REMEMBER           BUILD
             │               │                │
       Conversation        Walrus          Context brief
          agent            Memory              │
             │               │          ┌──────┼──────┐
       ┌─────┼─────┐         │          │      │      │
    Explore Challenge Plan   │       Brief  Versions  Write-ups
       └─────┼─────┘         │
             └──────┬────────┘
                    ▼
             IDEA EVOLUTION
                    ▼
       USER-CONTROLLED THINKING
```

## Architecture

```text
User
 │
 ▼
Frimz Web App
 │
 ▼
Frimz API
 │
 ▼
FrimzAgent
 ├────────────────┬─────────────────┐
 │                │                 │
 ▼                ▼                 ▼
Memory          Context brief     Context
Orchestrator    service           Builder
 │                │                 │
 ▼                ▼                 ▼
Walrus          PostgreSQL        Cursor LLM
Memory          briefs and        replies, synthesis,
                versions          and write-ups
 │                │                 │
 └────────────────┴────────┬────────┘
                           ▼
                        Response
```

- The web app is the chat, current thinking, ideas, memory, and settings UI.
- The API authenticates the session and never trusts a client-supplied user id.
- `FrimzAgent` owns the conversational behavior.
- The memory orchestrator recalls, filters, and later extracts.
- The brief service keeps one versioned context brief per idea. `ContextSynthesizer` updates it and `WriteUpGenerator` drafts from it.
- The context builder assembles a small prompt: the context brief first, then the idea, working style, relevant memories, and the conversation.
- Walrus Memory is the semantic store.
- Cursor supplies model inference.

PostgreSQL holds application state, including a `memory_index` so memories can be listed, edited, superseded, and forgotten, and the context briefs with their versions. Walrus does not have a normal list or update API.

## Cursor LLM architecture

Cursor is used only as Frimz's model provider.

Frimz owns conversations, memory, user identity, agent behavior, prompts, context construction, and the memory lifecycle.

Cursor provides model inference through `@cursor/sdk`.

Each model call creates a local agent, sends the full Frimz prompt, streams text, and disposes the agent. `tools` is empty and `settingSources` is empty, so the call is text-only and does not load this workspace's Cursor configuration. `Agent.resume` is not used. Cursor agent state is not Frimz's memory.

The API key stays in `CURSOR_API_KEY` on the server.

## Walrus Memory architecture

```text
Frimz
 ↓
Memory Orchestrator
 ↓
MemWal
 ↓
Walrus Memory
```

The app uses one MemWal account. Each user is isolated in the namespace `frimz-user-{userId}`. That namespace is derived from the authenticated user. The client cannot choose it.

`rememberAndWait` stores a structured memory. `recall` searches by meaning inside that namespace. Results are joined to `memory_index` and dropped when they are forgotten, superseded, too distant, or owned by someone else.

There is no update method. A change writes a new blob and marks the old index row `superseded`. Forget sets `forgotten` and stops retrieval. The published delete path is the Security Delete API, which is a wallet batch flow, not `delete(id)`.

Official docs: [Walrus Memory quick start](https://docs.wal.app/walrus-memory/sdk/quick-start) and [API reference](https://docs.wal.app/walrus-memory/sdk/api-reference).

## Data architecture

| Table | Responsibility |
| --- | --- |
| `users` | Account email, name, and password hash |
| `sessions` | Sign-in records. The browser session is an Auth.js JWT cookie |
| `conversations` | A thread, its title, the current idea, and the last reply the background step processed |
| `messages` | Transcript. Metadata stores memory-indicator ids, draft offers, and draft markers |
| `ideas` | A concept the user is developing |
| `idea_events` | Chronological changes to an idea, including brief changes to its problem, target user, goal, and direction |
| `context_briefs` | The current context brief for each idea: version, data, sections the user corrected, stale and lock times |
| `context_brief_versions` | Every version of a brief, append-only, with its source (`synthesis`, `edit`, `regenerate`) and change summary |
| `user_settings` | Display name and theme |
| `memory_index` | Lifecycle catalog for Walrus blobs |
| `memory_activity` | Real retrieve, store, supersede, and forget events |
| `app_logs` | Request and error metadata, without secrets |

## Memory types

- `user_preference` — durable working style, such as wanting several alternatives
- `idea` — a concept being developed
- `decision` — a choice and, when known, why
- `rejection` — a direction the user set aside, and why
- `insight` — a durable observation
- `open_question` — something still unresolved
- `idea_change` — a change in direction

## Idea evolution

A memory becomes an `idea_event` only when it changes that idea: an idea, decision, rejection, idea change, or open question tied to the idea. An insight is included only when it changes the idea.

A preference never appears on the timeline. "How did we arrive at this idea?" is a normal chat question. The timeline is a view of stored events, not a generated story. If there are no events, the page says so.

## Chat request lifecycle

```text
POST /api/chat
       ↓
Authenticate
       ↓
Load conversation
       ↓
Detect current idea
       ↓
Recall relevant memories
       ↓
Filter stale/forgotten memories
       ↓
Load the idea's context brief
       ↓
Write-up turn? ── yes ──→ WriteUpGenerator prompt
       ↓ no                        │
Rank context                       │
       ↓                           │
Build FrimzContext (brief first)   │
       ↓                           │
Select mode behavior               │
       ↓                           │
Cursor model ←─────────────────────┘
       ↓
Stream response
       ↓
Persist message
       ↓
Background step in after()
       ↓
Memory extraction: validate, deduplicate, supersede, store
       ↓
Link the conversation to its idea
       ↓
Meaningful progress → mark the brief stale → synthesize → guards → new version
       ↓
Record the reply as processed
```

The background step uses `after()` and cannot fail the reply. A Cursor failure returns: "Frimz couldn't connect to its AI model right now. Please try again." A Walrus failure leaves the conversation usable, and the brief still updates from the conversation.

## Project structure

```text
app/                  routes, landing page, chat, ideas, memory, settings
components/           shell, chat, thinking, memory, settings, landing
server/agent/         FrimzAgent, context builder, response strategy, prompts
server/context/       context brief: synthesizer, guards, repository, service, write-ups
server/llm/           LLMProvider and CursorLLMProvider
server/memory/        validation, retrieval, Walrus store, orchestrator
server/conversations/ conversation and message services
server/ideas/         ideas and idea events
db/                   Drizzle schema and SQL migrations
tests/                unit tests with mocked Cursor and Walrus
docs/                 architecture, memory, hackathon, demo, article, feedback
```

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS (system sans and mono; no remote font fetch at build time)
- Radix primitives in the style of shadcn/ui
- Auth.js
- Drizzle ORM
- PostgreSQL
- Walrus Memory (`@mysten-incubation/memwal`)
- Cursor TypeScript SDK (`@cursor/sdk`)
- Vitest
- Docker

## Getting started

Requires Node.js 22.13 or newer.

```bash
git clone <your-repository-url>
cd frimz
npm install
docker compose up -d
cp .env.example .env
npm run db:migrate
npm run dev
```

Compose publishes Postgres on host port 5436 so it does not collide with a local Postgres already bound to 5432. The matching connection string is in `.env.example`.

Open `http://localhost:3000`. Create an account. The account is empty.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Signs the Auth.js session cookie |
| `CURSOR_API_KEY` | Yes, for replies | Server-only Cursor API key |
| `CURSOR_MODEL` | No | Model id, default `composer-2.5` |
| `MEMWAL_PRIVATE_KEY` | Yes, for memory | Ed25519 delegate private key |
| `MEMWAL_ACCOUNT_ID` | Yes, for memory | MemWal account id |
| `MEMWAL_SERVER_URL` | No | Relayer URL, default `https://relayer-staging.memory.walrus.xyz` (testnet) |

Generate a Walrus account at [staging.memory.walrus.xyz](https://staging.memory.walrus.xyz). Generate `AUTH_SECRET` with `openssl rand -base64 32`.

Never expose `CURSOR_API_KEY` or `MEMWAL_PRIVATE_KEY` to the browser.

Frimz uses the testnet relayer. Testnet epochs last about a day. Mainnet epochs last about two weeks; that relayer is `https://relayer.memory.walrus.xyz`.

## Development

```bash
npm run dev
npm run db:migrate
npm test
npm run lint
npm run typecheck
npm run build
```

## Testing

Unit tests cover extraction parsing, the future-value filter, retrieval filtering, namespace isolation, superseding decisions and preferences, later-turn context, working-style adaptation, idea-event gating, and the Cursor and Walrus adapters.

Context brief tests cover the meaningful-progress check after extraction, normalization, the guards (a Frimz suggestion against a user decision, accepted suggestions, rejections, direction changes, restored items, user corrections, injection), synthesis parsing, versioning, coalescing and lock handling, edit conflicts, user isolation, the wrap-up offer, write-up routing, and failure handling. They use a mocked provider and an in-memory brief repository.

Cursor and Walrus are mocked. Fixtures exist only inside `tests/`. They are not loaded into the database and are not demo evidence.

## Deployment

The Cursor SDK starts a local agent inside the Node process for each turn, so Frimz ships as one Node 22 server.

`Dockerfile` is a three-stage image: install, `npm run build`, then a standalone server started with `node server.js`. It listens on `$PORT`, and on 3000 when `PORT` is unset. `Dockerfile.vercel` is that same file. Vercel detects the name, builds the image, and sends every request to it. On Vercel, `PORT` defaults to 80.

Set the environment variables from the table above on the host. Keep API keys out of the image. Point `DATABASE_URL` at a reachable Postgres database. The Compose database is for local development. Run `npm run db:migrate` against the production database before serving traffic.

A chat turn, the Walrus write, and the brief update after it share one function run, so the chat route asks for 300 seconds. If Vercel cuts the request off, raise the function duration for the project.

## Security

- Session identity comes from the Auth.js cookie
- Database and Walrus access are scoped to that user
- Namespaces are server-derived
- Request bodies are checked with Zod
- Chat, brief edits, and brief regeneration are rate limited per user
- Brief routes read and write only the signed-in user's ideas, conversations, and briefs
- Markdown is sanitized
- Security headers are set in `next.config.ts`
- Logs omit keys, passwords, and session secrets
- The system, synthesis, and write-up prompts treat user, memory, and brief text as data to reason about, and the brief guards drop instruction-like items

## Privacy and memory controls

Frimz remembers durable thinking so a later conversation can continue. You can read memories at `/memory`, edit them, or forget them. Editing supersedes the previous memory. Forgetting stops retrieval. Current thinking is under `/memory?view=thinking` and beside each conversation, where you can copy, edit, or regenerate it. See `/privacy` for what is stored.

This README does not claim certifications or a physical Walrus delete on forget.

## Walrus Memory integration

Walrus is the persistent semantic memory layer. Frimz still decides what is worth remembering, when to recall it, and when a newer thought replaces an older one. See [docs/memory.md](docs/memory.md) and [docs/walrus-feedback.md](docs/walrus-feedback.md).

## Hackathon

Frimz is built for the Walrus Memory chatbot hackathon: a deployed chat product where memory changes later conversations for real users.

The repository does not contain seeded users, seeded conversations, seeded memories, fake statistics, or a demo account. Evidence of three users, ten meaningful memories each, screenshots, and a recording is collected after deployment. The checklist is in [docs/hackathon.md](docs/hackathon.md) and [docs/demo.md](docs/demo.md).

## Demo

This is a workflow, not fabricated evidence:

1. Create an account
2. Start a real conversation
3. Develop an idea
4. Make a decision
5. Reject a direction
6. Open Current thinking and correct a section that reads wrong
7. Wrap up and accept the draft Frimz offers
8. Continue the conversation later
9. Ask Frimz what it remembers
10. Ask how the idea evolved
11. Inspect Memory
12. Edit or forget a memory

The product test is whether a later conversation is better because of memory and the brief. Storage alone is not the test.

## Roadmap

Not built yet:

- More memory controls
- Richer idea graphs
- Cross-project connections
- Additional model providers
- Voice conversations
- Rich attachments
- Shared thinking spaces
- A mobile application
- Advanced memory analytics

## Contributing

1. Branch from the current main line.
2. Follow Getting started so Postgres and `.env` are local.
3. Add or update unit tests for memory behavior.
4. Run `npm test`, `npm run lint`, and `npm run typecheck`.
5. Open a pull request that explains why the change helps the thinking loop.

Do not add seed data, fake usage numbers, or secrets.

## License

A license has not been selected. There is no `LICENSE` file yet.
