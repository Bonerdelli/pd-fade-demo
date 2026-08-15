# Agent instructions — pd-fade

Entry point for AI agents. Read before substantive work.

## What this repo is

Demo application for the Frontend Architecture Design Exercise: a chat with an AI agent
that drives an entity graph and a map canvas in real time over a single SSE stream.

**Architecture source of truth: [FE-Arch-Exercise-v2.md](FE-Arch-Exercise-v2.md).**
Read it before changing anything protocol- or state-related. If an implementation
decision contradicts that document, stop and ask — do not silently diverge.

## Repository structure

```
shared/   — event types, zod schemas, API contracts (single source of truth for the protocol)
server/   — Fastify: session store (SQLite), event log, SSE endpoint, agent loop (Anthropic + mock driver)
client/   — Vite + React + TS + Tailwind: SSE transport, Zustand store, chat / graph / map surfaces
```

## Tech stack

| Layer           | Choice                                      |
| --------------- | ------------------------------------------- |
| Package manager | pnpm workspaces                             |
| Language        | TypeScript everywhere, strict mode          |
| Server          | Node.js + Fastify                           |
| Persistence     | SQLite (better-sqlite3)                     |
| LLM             | Anthropic API (+ scripted mock driver)      |
| Client build    | Vite + React                                |
| State           | Zustand + pure reducer (no Redux, no RxJS)  |
| Graph           | React Flow (xyflow)                         |
| Map             | MapLibre GL                                 |
| Styles          | Tailwind CSS                                |
| i18n            | i18next + react-i18next (client)            |
| Validation      | zod (schemas live in `shared/`)             |
| Tests           | vitest                                      |

Do not add dependencies beyond this list without asking. RxJS, Redux and
microfrontends were considered and explicitly rejected — see the architecture doc.

## Commands

```bash
pnpm install        # install all workspaces
pnpm dev            # server + client in dev mode
pnpm lint           # ESLint across all packages
pnpm typecheck      # tsc across all packages
pnpm test           # vitest across all packages
pnpm format         # Prettier
```

After code changes, run: `pnpm lint && pnpm typecheck && pnpm test`.
Run only what exists — do not invent commands or add formatters/typecheckers
that are not configured.

## Architecture rules (this project)

- **The protocol lives in `shared/`.** Event types, zod schemas and API contracts are
  imported by both sides — never redeclare or duplicate them in `client/` or `server/`
- **Framing belongs to code, semantics belong to the model.** Protocol events are
  emitted by the server middleware, never by the LLM. Do not move envelope, `seq`,
  snapshot or tool-result responsibilities into prompts
- **UI never touches the transport.** All agent data flows
  `SSE -> applyEvent -> pure reducer -> Zustand -> UI`. Surfaces subscribe to store
  slices; they do not parse events
- **Ownership boundaries are structural.** Agent snapshots replace `agentState`
  wholesale and must not contain the user namespace; nothing on the server may write
  to the user layer on the agent's behalf. User gestures are absolute for cameras
- **Changing the event vocabulary** means updating together: `shared/` schemas,
  the server middleware, the client reducer, and reducer golden tests
- New agent capability = new tool schema + designed registry component + review.
  Never let unvalidated payloads reach the render

## Localization

- App language is English, but every user-visible string goes through i18n tables —
  no hardcoded UI text in components, ever
- Client uses i18next + react-i18next; locale files live in
  `client/src/locales/en/<namespace>.json`, one namespace per surface
  (`common`, `chat`, `graph`, `map`)

## Changelog

- Keep [CHANGELOG.md](CHANGELOG.md) up to date: append a bullet under
  `## [Unreleased]` in the matching subsection (Added / Changed / Fixed) for every
  meaningful change, in the same commit as the change itself

## Environment

- `ANTHROPIC_API_KEY` in `server/.env` — never commit it
- `AGENT_DRIVER=mock` env flag runs the deterministic scripted agent (no key needed);
  keep the mock driver working when changing the agent loop
- SQLite session database is disposable dev data, but never delete it on your own —
  session continuity demos depend on it

## Rules for AI agents

### Language

- Respond in Russian
- Code, comments, commit messages in English only
- Never use emojis unless explicitly asked

### Git

Commit after each logical stage — one commit per logical change; do not pile up a
giant diff. Before every commit, in this order:

```bash
git branch --show-current
git stash list
git status
git diff
git diff --staged
```

Stage only your own files for the current stage (`git add <path>…`, never `git add -A`
when unrelated changes are present). If touched files contain edits you did not make —
stop and ask.

**Commit messages:** imperative mood, English, verb first (Add, Fix, Remove, Update,
Refactor, …). Completes the phrase "This commit will …". No Conventional Commits
prefixes. Be specific enough that someone scanning the log understands the change.

- Never run destructive git commands (`reset --hard`, `push --force`, history rewrites)
- Never commit `.env`, secrets, `node_modules`, SQLite database files
- Do not push or open PRs unless the user explicitly requests it

### Parallel work etiquette

Several agents may work in this tree concurrently:

- Edit only files within your assigned scope; when you must touch a shared file
  (e.g. `CHANGELOG.md`, root `package.json`), append or make a minimal targeted
  edit — never rewrite or reorder others' content
- Never revert, reset, stash, overwrite or delete changes you did not make
- Stage only your own files by explicit path; re-check `git status` right before
  committing and leave foreign files unstaged
- If a foreign uncommitted change blocks you — report it, do not "fix" it

### Operational safety

- Never clear caches or reset databases on your own
- Never modify global dependencies, versions or packages outside this project
- Lint, typecheck and unit tests may run freely; dev servers only when the user asks,
  and prefer reusing an already-running one (check existing terminals first)
- If something is unclear — stop and ask, do not improvise

### Code quality

- Study existing code before writing new code: look for helpers, hooks, similar places
- DRY — use library functions and existing implementations instead of duplicating;
  prefer ready solutions from the approved stack over hand-rolled ones
- Keep layers separate: pure helpers in `lib/`, hooks in `hooks/`, components stay
  presentational and reusable — do not pile logic into components, no copy-paste
  between surfaces
- Match the style of the file and the project (imports, abstractions, naming)
- No trivial or obvious comments; comment only non-obvious "why"
- File naming: React components `PascalCase.tsx`, everything else kebab-case

### After edits

Run `pnpm lint && pnpm typecheck && pnpm test` before committing the stage
(once the tooling exists; skip silently while scaffolding is not yet in place).
