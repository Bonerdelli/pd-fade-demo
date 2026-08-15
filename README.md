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

1. **Send a message** — type something like “show berlin entities” in chat. Watch streaming assistant text, tool cards, graph nodes appearing, and a map camera move after signals plot. Keep the Map tab open before the agent plots signals: camera commands are consumed once, so if the flight happens while the Map canvas is unmounted, opening the tab later shows the shapes but not the flight or the “agent moved the view” indicator.
2. **Graph** — drag nodes (position overrides), select nodes, click **Realign** when layout diverges from the agent snapshot.
3. **Map** — draw a point or polygon with the toolbar, select and delete user shapes. Click an agent shape to attach a comment.
4. **Reload mid-session** — refresh the page; chat, agent snapshot, user shapes, comments, overrides, selection, and viewports restore from the server.
5. **Stop** — while a run is active, press **Stop**; in-flight tool cards finalize as cancelled.
6. **Server restart mid-run** — kill the server during an active run, restart it, reload the client; orphaned runs reconcile with a `server_restarted` error and finalized tool cards. Set `MOCK_DRIVER_POST_TOOL_START_DELAY_MS=5000` (or similar) in `server/.env` so the mock run stays in-flight long enough to kill the process; the default mock run finishes in seconds.

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
- **STATE_DELTA path unused** — the server only emits full `STATE_SNAPSHOT` events; there is no log compaction, no cursor-too-old snapshot refresh, and the reducer does not re-validate patched `agentState` from deltas.
- **Single-process demo** — one Node server, one SQLite file, no horizontal scaling or distributed session affinity.
- **Fixed demo dataset** — the mock driver uses a scripted Berlin entity graph; the Anthropic driver uses the same tool surface but depends on model behavior.
- **No production hardening** — rate limiting, auth, observability, and backup strategies are out of scope for this exercise.
- **No Storybook or adversarial payload harness** — tool cards are covered by unit tests and the mock run fixture, not by a dedicated render sandbox or fuzz/property-based render tests.
- **Graph layout at scale** — no clustering or virtualization for large entity counts; React Flow renders all nodes.
- **No rAF batching of deltas** — text and tool-arg streaming apply reducer updates as events arrive.
- **Malformed SSE telemetry stub** — invalid payloads are dropped with `console.warn`; `reportInvalidSsePayload` is a no-op hook for future observability.
- **Map basemap dependency** — tiles load from `demotiles.maplibre.org`; offline or blocked network yields a blank basemap (user/agent overlays still render).
- **Server start without env file** — `pnpm start` on the server does not load `.env`; only `pnpm dev` passes `--env-file=.env` (Anthropic key, driver selection, mock delays).
- **MapLibre re-created on tab switch** — switching Graph ↔ Map unmounts the inactive canvas; the map instance and terra-draw adapter are torn down and recreated (documented debt, not fixed in this demo).
- **Camera commands are consumed once** — historical `VIEWPORT_COMMAND` events are never replayed on reload or canvas remount (user viewports stay absolute across session boundaries). The trade-off: a camera flight that happens while the target canvas is unmounted is skipped, along with its “agent moved the view” indicator.
- **Composer during a run** — while a run is active the Send action is replaced by Stop; you can type the next message but cannot send it until the run finishes or is stopped.
- **Comment placement** — commenting an agent map shape opens a side panel rather than a popup anchored at the clicked location.
- **Client bundle size** — the production bundle is ~1.6 MB (MapLibre GL + React Flow); Vite emits a chunk-size warning. No code splitting of the canvas libraries in this demo.

## License

Private demo repository.
