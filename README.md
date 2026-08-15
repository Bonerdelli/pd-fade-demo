# pd-fade

Demo application for the [Frontend Architecture Design Exercise](FE-Arch-Exercise-v2.md): a chat with an AI agent that drives an entity graph and a map canvas in real time over a single SSE stream.

The design document is the source of truth for protocol, ownership boundaries, and surface contracts. Read [FE-Arch-Exercise-v2.md](FE-Arch-Exercise-v2.md) before changing anything protocol- or state-related.

## Architecture at a glance

```
Browser (React SPA)
  Chat / Graph / Map surfaces  -->  Zustand store slices
        ^                              ^
        |                              | applyEvent (pure reducer)
        |                              |
   SSE transport  <-----  Fastify server  ----->  SQLite event log
                              |
                         Agent loop (mock or Anthropic)
                              |
                         shared/ protocol schemas (zod)
```

Data flows in one direction for agent events: **SSE → reducer → store → UI**. User gestures go upstream through REST canvas mutations; the server is the arbiter for persisted user state.

| Package | Role |
|---------|------|
| `shared/` | Event types, zod schemas, API contracts |
| `server/` | Session store, SSE endpoint, agent drivers, chat materializer |
| `client/` | SSE transport, Zustand store, chat / graph / map surfaces |

## Prerequisites

- Node.js 20+
- pnpm 10+

## Setup

```bash
pnpm install
cp server/.env.example server/.env
```

Edit `server/.env`:

| Variable | Purpose |
|----------|---------|
| `AGENT_DRIVER=mock` | Deterministic Berlin demo (no API key needed) |
| `AGENT_DRIVER=anthropic` | Live Claude agent loop |
| `ANTHROPIC_API_KEY` | Required when `AGENT_DRIVER=anthropic` |
| `ANTHROPIC_MODEL` | Optional model override (default: `claude-sonnet-4-20250514`) |
| `PORT` | Server port (default `3001`) |
| `DB_PATH` | SQLite session database path |

## Running

```bash
pnpm dev
```

- Client: http://localhost:5173 (proxies `/api` to the server)
- Server: http://localhost:3001

Open the client with a session id in the query string, or let the app create one on first load (`?session=<uuid>`).

## Demo walkthrough

1. **Send a message** — type something like “show berlin entities” in chat. Watch streaming assistant text, tool cards, graph nodes appearing, and a map camera move after signals plot.
2. **Graph** — drag nodes (position overrides), select nodes, click **Realign** when layout diverges from the agent snapshot.
3. **Map** — draw a point or polygon with the toolbar, select and delete user shapes. Click an agent shape to attach a comment.
4. **Reload mid-session** — refresh the page; chat, agent snapshot, user shapes, comments, overrides, selection, and viewports restore from the server.
5. **Stop** — while a run is active, press **Stop**; in-flight tool cards finalize as cancelled.
6. **Server restart mid-run** — kill the server during an active run, restart it, reload the client; orphaned runs reconcile with a `server_restarted` error and finalized tool cards.

## Tests and quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Reducer golden tests replay recorded mock-run event logs. Transport tests cover disconnect/resume, duplicate seq drops, gap detection, and stall watchdog behavior. Server integration tests cover SSE replay, hydrate fidelity, run lifecycle, and orphan reconciliation.

## Known limitations

- **Context slice is static per run** — the agent context snapshot is built at run start; it does not refresh between multi-turn tool loops within the same run beyond what the driver appends to the conversation.
- **Single-process demo** — one Node server, one SQLite file, no horizontal scaling or distributed session affinity.
- **Fixed demo dataset** — the mock driver uses a scripted Berlin entity graph; the Anthropic driver uses the same tool surface but depends on model behavior.
- **No production hardening** — rate limiting, auth, observability, and backup strategies are out of scope for this exercise.

## License

Private demo repository.
