# Frimz

Frimz is an AI thinking partner that remembers how your ideas evolve.

```text
Think.
Explore.
Develop.
Remember.
Return.
Continue.
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
REMEMBER
  ↓
RETURN
  ↓
CONTINUE
```

A later conversation can continue the idea, explain a rejection, and reconstruct how the idea arrived, using memories that came from earlier real messages.

## Key features

- Persistent memory of thinking, not a copy of every message
- Conversations that continue across sessions and devices for the same account
- Idea evolution from real idea events
- Working-style adaptation from stored preferences
- Memory inspection, editing, and forgetting
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
 ├───────────────┐
 │               │
 ▼               ▼
Memory          Context
Orchestrator    Builder
 │               │
 ▼               ▼
Walrus          Cursor
Memory          LLM
 │               │
 └───────┬───────┘
         ▼
      Response
```

- The web app is the chat, ideas, memory, and settings UI.
- The API authenticates the session and never trusts a client-supplied user id.
- `FrimzAgent` owns the conversational behavior.
- The memory orchestrator recalls, filters, and later extracts.
- The context builder assembles a small prompt from the current conversation and relevant memories.
- Walrus Memory is the semantic store.
- Cursor supplies model inference.

PostgreSQL holds application state, including a `memory_index` so memories can be listed, edited, superseded, and forgotten. Walrus does not have a normal list or update API.

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
| `conversations` | A thread, its title, and the current idea |
| `messages` | Transcript. Metadata stores memory-indicator ids only |
| `ideas` | A concept the user is developing |
| `idea_events` | Chronological changes to an idea |
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
Rank context
       ↓
Build FrimzContext
       ↓
Select mode behavior
       ↓
Cursor model
       ↓
Stream response
       ↓
Persist message
       ↓
Background memory extraction
       ↓
Validate
       ↓
Deduplicate
       ↓
Supersede conflicts
       ↓
Store durable memory
```

Extraction uses `after()` and cannot fail the reply. A Cursor failure returns: "Frimz couldn't connect to its AI model right now. Please try again." A Walrus failure leaves the conversation usable.

## Project structure

```text
app/                  routes, landing page, chat, ideas, memory, settings
components/           shell, chat, memory, settings, landing
server/agent/         FrimzAgent, context builder, response strategy, prompts
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

Cursor and Walrus are mocked. Fixtures exist only inside `tests/`. They are not loaded into the database and are not demo evidence.

## Deployment

The Cursor SDK runs a local agent bridge inside the Node process. Deploy Frimz as a long-running Node 22 server, not as a serverless function that freezes the process.

The `Dockerfile` installs dependencies, runs `npm run build`, and starts `npm start`. Provide the environment variables above and a reachable `DATABASE_URL`. Run `npm run db:migrate` against that database before serving traffic. Suitable hosts include Fly, Railway, or a VPS.

Do not put API keys in the image.

## Security

- Session identity comes from the Auth.js cookie
- Database and Walrus access are scoped to that user
- Namespaces are server-derived
- Request bodies are checked with Zod
- Chat is rate limited per user
- Markdown is sanitized
- Security headers are set in `next.config.ts`
- Logs omit keys, passwords, and session secrets
- The system prompt treats user and memory text as data, not as instructions

## Privacy and memory controls

Frimz remembers durable thinking so a later conversation can continue. You can read memories at `/memory`, edit them, or forget them. Editing supersedes the previous memory. Forgetting stops retrieval. See `/privacy` for what is stored.

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
6. Continue the conversation later
7. Ask Frimz what it remembers
8. Ask how the idea evolved
9. Inspect Memory
10. Edit or forget a memory

The product test is whether a later conversation is better because of memory. Storage alone is not the test.

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
