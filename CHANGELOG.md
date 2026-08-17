# Changelog

Notable changes to the pd-fade demo application. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); entries go under `[Unreleased]`
until a release is cut.

## [Unreleased]

### Added

- New chat control in canvas header to start a fresh session without full page reload
- Lazy-load MapPanel with React Suspense so MapLibre GL and terra-draw ship in a separate chunk
- `CanvasSurfaceErrorBoundary` with localized fallback and retry remount for graph and map surfaces
- Unit tests for map instance resize/load readiness and canvas surface error boundary recovery
- Ansible local build and release archive deploy with versioned releases and rollback via `current` symlink
- Ansible controller build script and post-deploy `/health` check
- Ansible provisioning for demo/production VMs (Node.js 20, pnpm via corepack, systemd, nginx, optional TLS)
- Root README pointer to `ansible/README.md`
- Anthropic demo system prompt module with tool choreography, protocol boundary, and user-context instructions
- Suggested Anthropic live-demo script with paste-ready messages in README
- Unit test for composeSystemPrompt and cumulative tool executor merge semantics
- Root README with setup, demo walkthrough, and known limitations
- Client SSE stall watchdog with 45s silence threshold and reconnect on stream stall
- SSE transport chaos tests for disconnect resume, duplicate seq drop, and gap resync convergence
- Unit tests for SSE activity watchdog with fake timers
- Extract Berlin demo dataset into `server/src/agent/dataset.ts` with typed search and signal helpers shared by mock and Anthropic drivers
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
- Chat debug mode toggle in header with `uiState.debugMode` hiding fallback tool card raw JSON arguments
- Selection context hint above chat composer when graph nodes are selected, with clear control via `setSelection`

### Fixed

- Point MapLibre 6 at a Vite-bundled worker URL so the map tab no longer hangs on a missing `maplibre-gl-worker.mjs`
- Actually enable the Ansible swapfile with `swapon` (fstab-only `state: present` left it inactive) and prefer glibc prebuilds for better-sqlite3
- Add a 1G swapfile during Ansible base provision so `better-sqlite3` can compile on small VMs
- Surface pnpm install failures with stdout/stderr, dmesg OOM traces, and a clean retry (remove broken release)
- Run target `pnpm install` as root so Corepack does not hang on a download prompt under `become_user`
- Pin target pnpm via Corepack to 10.28.0 so Node 20 hosts do not download pnpm 11
- Defer Ansible pd-fade service restart until after the release symlink exists on first provision
- Include client package manifest in Ansible release archives for pnpm workspace lockfile verification
- Read Ansible release metadata from a controller JSON file instead of parsing build script stdout
- Install systemd unit before Ansible release deploy so first-provision restart handlers succeed
- Exclude the active release directory from Ansible release pruning after rollback
- Re-check lifecycle token after connectSse await and discard stale handles on stop/unmount
- Disconnect existing SSE stream at the start of session start and resync replace paths
- Add silent SSE disconnect option to avoid spurious down status on stream replacement
- Fix tool card Expand click doing nothing for non-latest cards by retaining manual expanded state in `useToolCardExpandedState`
- Fix blank Map tab by resizing MapLibre after layout settles and deferring draw/layer setup until map load
- Exclude maplibre-gl from Vite dependency pre-bundling to avoid missing worker asset in dev
- Clear `connectSse` mock call history between session controller unit tests
- Fix doubled SSE event application from StrictMode bootstrap and leaked reconnect loops by disconnecting replaced streams and guarding in-flight session lifecycle
- Ignore duplicate event seq in store applyEvent as a global dedup backstop
- Flush Ansible nginx handlers before certbot webroot so ACME challenges succeed on first TLS run
- Make Ansible git known_hosts management idempotent via the known_hosts module
- Rebuild pd-fade on retry when dist outputs or build stamp lag behind the checked-out revision
- Switch Ansible TLS to certbot webroot so renewals work while nginx holds port 80
- Keep nginx running when Let's Encrypt issuance fails on first TLS enable
- Restart pd-fade only when git checkout or environment file changes on redeploy
- Run NodeSource setup script only when the APT source is not yet configured
- Obtain Let's Encrypt certificate before deploying TLS nginx vhost on first provision
- Remove unused pd_fade role handlers left over after explicit service state task
- Fix tool card name i18n lookup to use the `toolCards.toolNames` namespace path
- Sync hydrated user map shapes into terra-draw after deferred map load setup
- Clear historical viewport commands on session hydrate and skip replay on surface remount
- Wire SSE stall watchdog through session controller and add bootstrap retry on load failure
- Rework SSE gap chaos test to compare partial client state against true server resync payload
- Assert Anthropic driver second stream call includes tool_result in messages payload
- Align mid-run hydrate E2E with independent live fold and explicit running-state assertions
- Abort Anthropic SDK streams promptly on run cancellation via signal listener and RequestOptions.signal
- Add Anthropic driver-level tests for multi-turn loop, cancellation, executor errors and API failures
- Type Anthropic stream test fixtures against SDK event shapes in `anthropic-stream-fixtures.ts`
- Strengthen full-fidelity reload E2E with independent live SSE folding and explicit session-state field assertions
- Add startup reconciliation test for multiple orphaned runs across sessions
- Fix SSE snapshot-anchor replay test to derive the compaction cursor from tail events instead of tailEvents
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
- Fix server `dev` script so tsx `watch` is a subcommand and `--env-file` still loads `.env`
- Keep map overlays and terra-draw attached after map clicks by stabilizing map instance lifecycle and re-syncing layers on map ready epoch changes

### Changed

- Align `FE-Arch-Exercise-v2.md` with the implemented demo (snapshot-anchor strategy, chat read model, four store slices, dual-side run lock, resilience details) and drop superseded v1 alternatives
- Slim Ansible demo group_vars to domain and agent driver; move shared defaults into roles
- Point Ansible demo inventory at `157.230.124.0` and `root_domain` at fade.kjam.net
- Drop redundant `pd_fade_repo_root` from Ansible group_vars (controller path stays a role default)
- Serve Ansible nginx as HTTP-only origin; terminate HTTPS at Cloudflare
- Rework Ansible app deploy to controller-side build and release archives (no git on target)
- Left-align the chat debug mode toggle and drop its separator border
- Move New chat control from canvas header to chat header; move debug mode toggle to a footer row below the composer
- Hide tool card Expand control when expanded content would repeat the collapsed summary; registry `hasDetails` predicates per card type and debug mode
- Hide plot_signals center coordinates in designed tool cards unless chat debug mode is on
- Align chat composer input and Send button height; auto-grow textarea with top-pinned action button
- Switch chat/canvas two-column layout breakpoint from `lg` (1024px) to `md` (768px)
- Remove app header and Graph panel subtitle; show bootstrap and mutation errors in a centered canvas overlay
- Default Ansible TLS to off for HTTP-first bring-up; document enable-TLS path
- Move Ansible pnpm store to `/var/cache/pd-fade/pnpm`, separate from SQLite data dir
- Drop unused `python3-certbot-nginx` package and `ansible.posix` collection from Ansible requirements
- Make search_entities and plot_signals executors merge cumulatively into agent state
- Update Anthropic system prompt and demo script for per-call search/plot choreography
- Add optional `reasonCode` on RUN_ERROR events with server restart and driver crash reason codes
- Resolve run error banner copy from `reasonCode` with human-readable message fallback
- Localize tool card header names via chat i18n mapping with raw-name fallback
- Extend README known limitations and demo walkthrough for mock delay env and design-doc gaps
- Document camera consume-once semantics, composer run policy, comment panel placement and bundle size in README
- Refactor mock agent driver to use shared dataset and tool executors while preserving deterministic mock-run fixture event structure
- Export `createAgentDriver` from dedicated factory supporting `mock` and `anthropic` drivers
- Rebuild client reducer golden fixture from the real mock driver event log
- Emit graph VIEWPORT_COMMAND from mock driver after search snapshot
- Force terra-draw to select mode during run soft-lock and hide stale agent shape popups when shapes disappear
- Document Realign clearing position overrides through upstream mutation for session continuity
- Document session state chat/tail contract on `sessionStateResponseSchema`
- Update chat composer placeholder to "Ask me about anything"

### Removed

- Unused Ansible `locale` and `pd_fade_app_name` variables
- Let's Encrypt / certbot from Ansible nginx (TLS flags, webroot ACME, renewal cron)
- Ansible target-host git checkout deploy path (deploy keys, repo URL vars, on-host build)
- React Flow MiniMap from the graph canvas (non-functional in current setup)
