# Front-End Architectural Exercise

This document presents a proposed solution for the Frontend Architecture Design
Exercise. It is the second iteration of the design: the first one was written without
AI assistance, this one was planned and refined in a discussion with an AI agent.
Several decisions from v1 were revised along the way, and I keep them here as
considered alternatives, since the reasoning behind rejecting them is part of the design

## Key Point

The entire application is built around a single session with the Agent, so a single
**ordered event log per session** serves as the source of truth for everything: the Chat,
the tool execution cards, the entity graph, and the Map. The UI is never wired to the
transport directly. Everything the agent produces is an ordered log of typed events;
a pure reducer folds this log into state, and every surface is just a projection of
that state

This one decision answers most of the exercise at once: FIFO ordering, replay-&-resume,
session continuity, and testability all fall out of it naturally. As a bonus, it enables
forking a session or rolling back to any point — a fork is simply a copy of the log up
to a given sequence number

```
[Transport]  ->  [Event Log / Reducer]  ->  [UI Surfaces]
one connection    single ordered stream      chat, tool cards,
to the agent      of typed events + state    graph, map
```

## 1. Connectivity — One Connection, Many Surfaces

### SSE down, REST up

The traffic here is asymmetric by nature. Downstream (agent to browser) is chatty:
token-level text deltas, tool events, state snapshots — dozens of events per second
during a run, silence between runs. Upstream (browser to agent) is rare and small:
a user message, a debounced viewport, shape edits. So the transport should be
asymmetric too:

- **Downstream: SSE.** A single `GET /session/{id}/events` request that the server
  never closes, with `Content-Type: text/event-stream`. Everything arrives through it
- **Upstream: plain REST.** `POST /session/{id}/messages` for user input (which also
  triggers a run), `POST /session/{id}/canvas` for shapes, comments, positions,
  selection, and viewport. Each request is self-contained and idempotent, so retries
  are trivial

SSE is essentially "polling with all requests removed except the first one". It is
plain HTTP, so auth, cookies, proxies, load balancers and HTTP/2 all work as usual.
And the browser's `EventSource` gives two things for free that we need anyway:
automatic reconnection with backoff, and the `Last-Event-ID` header on reconnect —
which is half of the resume logic built into the platform. SSE is also the industry
default for LLM streaming (OpenAI and Anthropic APIs, ChatGPT and Claude web UIs),
so this is the conservative choice, not an exotic one

Two practical caveats: the native `EventSource` cannot send custom headers, so either
cookie-based auth or a small `fetch`-based SSE reader is needed (the latter also lets
us own the backoff policy); and reverse proxies must not buffer the stream
(`X-Accel-Buffering: no` for nginx)

*Considered: plain polling (my v1 choice).* Polling is legitimate when updates are
infrequent and coarse. Here the profile is token-level streaming: to make text "type"
smoothly the poll interval must be 100–200ms, which is a request storm where 95% of
requests return nothing. More importantly, the complexity does not disappear — it
moves: a polling endpoint still needs a cursor ("give me events after seq=42"),
batch stitching and ordering on the client. That is exactly the code SSE makes
unnecessary. Long polling is a hand-rolled SSE with fewer guarantees

*Considered: WebSocket.* Full duplex, but it forces hand-written reconnect, heartbeat,
ordering and backpressure, and bypasses standard HTTP infrastructure. Our upstream
traffic is too small and infrequent to justify it

### One stream for everything

One stream, not one per surface. Ordering between surfaces is semantically significant:
a state snapshot emitted after a tool completes must be applied after that tool's card
is finalized. Multiple streams turn this into a distributed ordering problem for no
benefit. Multiplexing is cheap: every event has a `type`, and routing to surfaces
happens on the client

## 2. Wire Format

### A small, closed event vocabulary

Every event is a line-by-line JSON with a common envelope:

```
data: {seq, runId, ts, type, ...payload}
```

`seq` is a monotonic per-session sequence number — it drives FIFO application, gap
detection, and doubles as the resume cursor (`Last-Event-ID`). The vocabulary is
deliberately small, around ten types:

```
RUN_STARTED | RUN_FINISHED | RUN_ERROR | RUN_CANCELLED   -- lifecycle; drives the spinner
TEXT_DELTA {messageId, delta}                             -- streaming chat text
TOOL_START {toolCallId, name} | TOOL_ARGS {delta} | TOOL_RESULT {status, result}
STATE_SNAPSHOT {snapshot}                                 -- full agent-owned state
STATE_DELTA {patch}                                       -- JSON Patch (RFC 6902)
VIEWPORT_COMMAND {target: graph|map, camera}              -- camera flight suggestion
```

The semantics intentionally match the AG-UI protocol — it is good prior art confirming
the event taxonomy — but I would not take it as a dependency: it carries ~30 event
types and framework integrations designed for other people's use cases. A vocabulary
tailored to our four surfaces is smaller, fully understood, and ours

### The protocol is emitted by code, not by the model

A critical boundary decision: these events are **not** generated by the LLM. Model
provider APIs already stream structured, typed chunks — text deltas and tool calls
with schema-validated JSON arguments (structured outputs). A thin deterministic
middleware on the backend (realistically 100–200 lines) translates provider chunks
into our events, assigns `seq`, executes tools, computes state snapshots, and appends
everything to the session log

This layer cannot be removed, only smeared around, because half of the vocabulary is
physically impossible for the model to produce: `STATE_SNAPSHOT` is computed from tool
execution results the model never sees in full; `seq` is a monotonic counter an LLM
cannot maintain reliably; `TOOL_RESULT` by definition originates outside the model.
The division of labor is: **framing belongs to code, semantics belong to the model**.
The prompt controls what the agent says and which tools it calls — never the protocol

*Considered: a plain-text format with `<tags>` emitted by the model per prompt
instructions (my v1 choice).* The motivation was to avoid failures from invalid
model-generated JSON. But a prompt-defined protocol is a probabilistic protocol: an
instruction is followed in ~95–99% of cases, while a protocol must work in 100%. Every
skipped closing tag or malformed payload is not "a slightly worse answer" but a broken
render, and defensive parsing on every surface costs more than the middleware it was
supposed to remove. Provider-side structured outputs solve the original problem at the
root. The token savings are illusory too: in the middleware design the model does not
generate envelopes at all, so they are free. And the format is no longer hostage to a
model or provider swap

## 3. State Management and Coherence

### Client stack

```
SSE (fetch reader, backoff, gap check) -> applyEvent -> pure reducer -> Zustand -> UI
upstream POSTs (debounce / coalescing -- small hand-written utilities)
```

The store is Zustand with a single entry point for agent events: `applyEvent(event)`
runs a pure `(state, event) => state` reducer inside. Zustand fits well here: it works
outside React (the transport layer calls the store directly from the SSE handler),
selector-based subscriptions keep a canvas with hundreds of nodes from re-rendering on
every text delta, and transient `subscribe` updates let the hottest paths (streaming
text, camera) bypass React entirely. Loading a session is literally
`events.reduce(reducer, snapshot)` — a synchronous fold

*Considered: an RxJS-based state layer (my v1 choice).* RxJS earns its place when
there is real stream combinatorics — merges, windows, cancellation chains. After the
reducer was made synchronous and pure, none of that remains: FIFO application comes
free from the event loop (one HTTP stream, ordered events, synchronous handler),
`EventSource` reconnects itself, and viewport debouncing plus per-node coalescing of
edits (`Map<nodeId, latestChange>` flushed on a timer) are ~30 lines of utilities.
Per-node subscriptions that RxJS promised are Zustand selectors. A
`BehaviorSubject + scan` store is a hand-rolled Redux without devtools, with marble
diagrams for debugging. Same logic for Redux itself: the event-sourcing discipline is
already enforced by the protocol, so the ceremony would be duplicated, not added

### Deltas as the flow, snapshots as anchors

A deltas-only model fails in three ways: load cost grows with session age (replaying
thousands of patches on open), one lost delta means permanent divergence (patches do
not commute), and the exercise explicitly fixes "a snapshot after each tool" anyway.
So: `STATE_DELTA` is the primary flow during and between tools; `STATE_SNAPSHOT` is
emitted at three points — after each tool completes (the convergence guarantee), on
client connect/reconnect, and as server-side log compaction. When the client detects
a gap in `seq`, it does not try to repair — it requests a fresh snapshot and moves on.
Cheap and reliable

Persistence across tool calls follows naturally: the backend owns the canonical
agent state and includes existing shapes and signals in every next snapshot. The
frontend does not "preserve" anything — it renders what it is told, and clearing
happens only through an explicit event

### Ownership: split by attribute, not only by object

Every piece of state has exactly one writer. The store has three parts:

- **`agentState`** — graph topology (nodes, edges, data), agent-drawn map shapes and
  signals, the agent's proposed graph layout. Written only by stream events. A snapshot
  replaces this slice wholesale
- **`userState`** — user-drawn map shapes, node position overrides
  (`nodeId -> {x, y}`), selection, comments. Written only by user actions
- **`uiState`** — both viewports, run status, agent-activity indicators

The agent snapshot structurally does not contain the user namespace, so it cannot
overwrite user state — the protection is at the schema level, not a matter of careful
merging. Merging happens only at render time: the canvas draws both layers on top of
each other, and there is no merge logic to get wrong

The surfaces have different interaction contracts:

- **Graph.** Topology is fully agent-owned; the user cannot add nodes. The user can
  select nodes and move them. User positions take priority: a new snapshot applies the
  agent's layout only to new nodes, surviving nodes stay where the user put them. When
  the layouts diverge, the UI shows a **Realign** button that applies the agent's
  stored layout wholesale via the `clearPositionOverrides` canvas mutation so
  persisted user state matches the realigned view on reload (the agent layout itself
  already lives in `agentState`)
- **Map.** Both sides draw. Agent shapes are read-only for the user, but the user can
  attach **comments** to them — persistent annotations that live in `userState`, are
  keyed by shape id, and are included in every subsequent run context
- **Cross-layer references** degrade softly by id: if the agent deletes an entity that
  a user comment or position override points to, the orphan simply stops rendering.
  No cascade logic

- **Selection is agent context.** It is sent upstream and included in the run context —
  this enables "select three nodes, ask what connects them", which is the whole point
  of having selection

### Viewports: the agent suggests, the user's gesture is absolute

Both cameras follow one policy. The agent moves a camera in notification mode: a
`VIEWPORT_COMMAND` produces a smooth designed flight plus a short "agent moved the
view" indicator — it does not ask, it does and shows. But a user gesture is absolute:
if the user is panning at that moment, the agent's command is silently dropped. Between
runs the user navigates completely freely

### Concurrency: soft lock during a run

While a run is active, user **mutations** are softly blocked: drawing, node dragging
and commenting are visually disabled with an "agent is working" indication. Selection,
pan and zoom stay live (they are harmless — the run context is snapshotted at run
start, so mid-run selection changes only affect the next run), and the chat input stays
live too. Since the user cannot be locked out, a **Stop** button is always available:
`POST /session/{id}/runs/current/cancel` produces a `RUN_CANCELLED` event and returns
control immediately

This one policy removes an entire class of concurrency problems by construction: the
agent's context cannot go stale mid-run, there are no gesture-versus-snapshot races on
shared objects, and FIFO of a single run over a single stream is the only ordering that
matters

## 4. Session Continuity

The server persists the session event log plus periodic compaction snapshots; the user
layer (shapes, comments, positions, selection, both viewports — everything) is
persisted through the same upstream mutations. The `sessionId` lives in the URL

Reload and reconnect are the same mechanism with different tail lengths:

1. `GET /session/{id}/state` returns the latest compacted snapshot (both layers) plus
   the tail of events after it
2. The reducer folds the tail — constant-time regardless of session age, because the
   server compacts the log in the background
3. The client subscribes to the stream with `Last-Event-ID = seq` and continues live

If the connection drops mid-run, the browser reconnects with the last seen `seq` and
receives the missed tail; if the server detects the cursor is too old (already
compacted away), it responds with a fresh snapshot instead. During reconstruction the
canvas stays hidden behind skeletons until the fold completes, to avoid visual jitter

## 5. Bidirectional Binding

The loop closes through the server, which is the single arbiter for shared state:

- **Frontend to agent:** user actions apply optimistically to the local store, then go
  upstream as coalesced REST mutations (debounced viewport, per-node batched edits).
  The server materializes them into the canonical user layer. On the next run the agent
  receives a **compact materialized slice** of current state — "the user drew these two
  polygons, selected these nodes, commented this on shape X, viewport is here" — not a
  raw edit journal. The model needs "what is now", not "how we got here"; history would
  burn context for nothing
- **Agent to frontend:** only through stream events — snapshots, deltas, tool events,
  viewport commands. No side channels. The agent reads the user layer but has no tool
  that writes to it, so it cannot corrupt user state even in principle
- Tool errors flow back too: a failed tool produces `TOOL_RESULT {status: error}`,
  which both renders the card's designed error state and is fed back to the model by
  the backend loop so it can correct itself or stop

## 6. Nondeterministic UI Control

Classic UI is deterministic because every transition was written by a person. Here the
"caller" of the components is an LLM that decides at runtime which surfaces to touch,
in what order, and with how much data. The answer is not to trust the model with UI
decisions, but to narrow what it *can* do to a vocabulary where every element was
designed by a human. Four fences:

**Fence 1 — a closed protocol vocabulary.** The agent physically cannot produce
anything except our event types and registered tools. It never picks colors, layouts
or animations — it says "show a tool card with this data", "here is the new graph
state", "fly here". Extending the agent's reach is a deliberate act: design a
component, define a schema, register a tool. A design process with review, not a
prompt edit

**Fence 2 — a component registry.** Each intent type maps to exactly one
designer-built component: the tool card with all its states (running, success, error,
cancelled), the graph node, the map shape. The model chooses *what and with which
data*; the component decides *how it looks*, including what to do with bad data

**Fence 3 — boundary validation and a degradation ladder.** Every event passes a
schema (zod) before reaching the reducer. Three rungs, each one designed:

- valid known intent → the full component
- known intent, malformed payload → a designed fallback card ("agent executed
  {toolName}", details collapsed) — never a crash, never a raw JSON dump
- unknown type → a generic card plus a telemetry event

Telemetry is not optional here: the designer must *see* what the agent tried and
failed to do — that is the feedback loop for evolving the vocabulary

**Fence 4 — behavior policies, not just appearance.** Everything described above:
cameras move in notification mode and a user gesture is absolute; agent shapes are
read-only; mutations lock softly during a run with a visible indicator and Stop is
always reachable. The unifying principle: **every agent action is visible and
attributed** ("agent moved the view", "agent is working", "controlled by agent"
accents). The user always distinguishes "I did this" from "the agent did this" —
trust in a nondeterministic system is built on the visibility of its actions

**Volume is a design constraint too.** The model is unpredictable not only in choice
but in quantity — it may emit 500 graph nodes in a second or 30 tool calls in a row.
The designer owns the pace: delta rendering is batched through `requestAnimationFrame`
(frames, not 500 repaints); above a node threshold the graph switches to a designed
clustering/aggregation mode instead of degrading into lag; the freshest tool card is
expanded while previous ones auto-collapse into a compact strip

*Considered: microfrontends (my v1 proposal — Chat, Canvas shell, Map as separate
MFEs).* Microfrontends are an organizational tool that pays off when separate teams
ship surfaces independently. For a single application it is a tax without a benefit:
federation infrastructure, contract versioning, duplicated dependencies. The same
modularity is achieved for free — one SPA, each surface an isolated module subscribed
to its own store slice, unaware of its neighbors

## Resilience Summary

- **Transport:** automatic reconnect with exponential backoff; `Last-Event-ID` resume;
  SSE heartbeat comments plus a client-side timeout that surfaces a designed
  "agent is not responding" state with a retry
- **Ordering:** `seq` gap detected → request a fresh snapshot, do not attempt repair;
  duplicate delivery is idempotent by `seq`
- **Runs:** `RUN_ERROR` and `RUN_CANCELLED` are first-class events with designed UI
  states; tool failures feed back to the model; Stop is always available
- **Data:** upstream mutations are idempotent and retried; optimistic local apply with
  the server as the arbiter

## Testing

The trick is that after the four fences, what needs testing is not the model but the
boundary — and the boundary is deterministic:

- **Reducer golden tests:** recorded event logs from real sessions as fixtures →
  snapshot the folded state. Replay is the test
- **Registry components in Storybook** with fixture payloads, including adversarial
  ones: empty arrays, 10KB strings, unicode, 10k nodes
- **Fuzz / property-based tests:** generate arbitrary *schema-valid* payloads → the
  render must not crash or break layout
- **Contract invariant:** prompt changes cannot break the UI in principle, because the
  UI only sees what passed the schema. Prompt regressions are caught separately by
  answer-quality evals — that is not the frontend's job
- **Transport tests:** simulated disconnects, gaps, duplicates and reordering against
  the SSE reader; the store must converge to the same state as an uninterrupted run

—

Author: Andrey Nekrasov
bonerdelli@gmail.com
