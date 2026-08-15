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
