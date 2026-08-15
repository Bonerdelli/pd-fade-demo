# Changelog

Notable changes to the pd-fade demo application. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); entries go under `[Unreleased]`
until a release is cut.

## [Unreleased]

### Added

- Architecture design document (`FE-Arch-Exercise-v2.md`)
- Agent instructions (`AGENTS.md`)
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

### Fixed

- Allow native builds for `better-sqlite3` and `esbuild` under pnpm 10
- Harden shared protocol: strict `agentStateSchema`, non-null `runId` on run-scoped events, union regression tests, REST path builders
- Add chat slice to client store, wire canvas tab to Zustand, deduplicate initial state, set document title from i18n
