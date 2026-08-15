# Changelog

Notable changes to the pd-fade demo application. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); entries go under `[Unreleased]`
until a release is cut.

## [Unreleased]

### Added

- Extract Berlin demo dataset into `server/src/agent/dataset.ts` with typed search and signal helpers shared by mock and Anthropic drivers
- Add deterministic tool executors (`search_entities`, `plot_signals`, `focus`) returning tool payloads and cumulative `agentState` snapshots
- Add `AnthropicAgentDriver` with stream translator, materialized context slice system prompt and `AGENT_DRIVER=anthropic` selection via `@anthropic-ai/sdk`
- Add unit tests for dataset, executors, translator fake stream sequences and driver factory selection without network calls
- Reconcile orphaned runs after server restart with `RUN_ERROR` reason `server_restarted` and startup/lazy session touch hooks
- Full-fidelity session reload E2E covering user mutations, viewports, selection and mid-run hydrate
- SSE `409 cursor_ahead` response and client resync when the reconnect cursor is beyond the persisted log
- SSE replay test for `Last-Event-ID` older than the latest snapshot anchor
- Localized run error copy for `server_restarted` and chat scroll-to-bottom on restore
- Shared camera command helpers, `useCameraCommand` hook and surface-agnostic indicator components for graph and map
- `clearPositionOverrides` canvas mutation to reset graph node position overrides for Realign
- Graph surface with React Flow entity nodes, position overrides, Realign, camera commands and run soft-lock
- Architecture design document (`FE-Arch-Exercise-v2.md`)
- pnpm workspace scaffolding with shared TypeScript, ESLint, Prettier and Vitest tooling
- `@pd-fade/shared` protocol package with zod schemas for agent events, state models, chat read model and REST contracts
- Shared protocol unit tests covering every event and canvas mutation schema
- `@pd-fade/client` Vite + React + Tailwind skeleton with i18n namespaces and Zustand store stub
- `@pd-fade/server` Fastify skeleton with health endpoint and placeholder modules for HTTP, DB and agent layers
- Implement client event reducer with golden tests covering mock-run replay, ownership boundaries and tool card lifecycle
- Add fetch-based SSE transport with seq gap detection, invalid payload dropping and reconnect backoff
- Wire session bootstrap from URL query param through state hydration to live SSE subscription
- Add optimistic upstream mutation helpers with debounced viewport/selection and coalesced position overrides
- Expose `useSessionBootstrap`, `useRunLock` and `useMutations` hooks for surface phases
- SQLite session store with append-only event log, snapshot compaction anchors, user state persistence and materialized chat read model
- Server REST and SSE endpoints for session state, messages, canvas mutations and run cancellation
- Deterministic mock agent driver with Berlin entity dataset and run manager with single active run per session
- Server integration tests for event log, SSE replay, run lifecycle, canvas soft-lock and mock snapshot validation
- Implement Map surface with MapLibre GL agent layers, terra-draw user editing, camera commands and soft-lock hints
- Chat surface with streaming messages, tool card registry, run lifecycle UI, scroll-pinned message list and composer

### Fixed

- Finalize orphaned in-flight tool cards when a run is reconciled after server restart
- Allow native builds for `better-sqlite3` and `esbuild` under pnpm 10
- Harden shared protocol: strict `agentStateSchema`, non-null `runId` on run-scoped events, union regression tests, REST path builders
- Add chat slice to client store, wire canvas tab to Zustand, deduplicate initial state, set document title from i18n
- Fix session hydrate duplicating chat by treating server `chat` as authoritative over tail replay
- Fix SSE subscribe/replay race that could drop live events on connect
- Mirror server comment cascade in optimistic `deleteUserShape` client mutations
- Move mutation error strings to i18n keys rendered in the app shell
- Keep resync on `reconnecting` status during gap recovery instead of flashing `down`
- Accept optional client `messageId` on POST messages for optimistic id alignment
- Finalize in-flight tool cards as cancelled or error when a run ends with RUN_CANCELLED or RUN_ERROR
- Keep map draw toolbar in sync with terra-draw after run soft-lock releases
- Remove unused submitClearPositionOverrides mutation helper export
- Add hydrate E2E coverage for cancelled runs with cancelled in-flight tool cards

### Changed

- Refactor mock agent driver to use shared dataset and tool executors while preserving deterministic mock-run fixture event structure
- Export `createAgentDriver` from dedicated factory supporting `mock` and `anthropic` drivers
- Rebuild client reducer golden fixture from the real mock driver event log
- Emit graph VIEWPORT_COMMAND from mock driver after search snapshot
- Force terra-draw to select mode during run soft-lock and hide stale agent shape popups when shapes disappear
- Document Realign clearing position overrides through upstream mutation for session continuity
- Document session state chat/tail contract on `sessionStateResponseSchema`
