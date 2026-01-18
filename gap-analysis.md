# Gap Analysis (Architecture Gap & Plan Alignment)

This document compares the current codebase to `spec.md` and highlights gaps, risks, and next actions.

## Scope and Method
- Source of truth: `spec.md`
- Codebase scanned: `src/main.ts`, `src/preload.ts`, `src/models.ts`, `src/repository/*`, `src/renderer/*`, `src/__tests__/*`
- Focus: stack alignment, core features, data model coverage, and build/test pipeline

## Current Codebase Snapshot
- Electron main process with IPC for question CRUD and basic project/media management (`src/main.ts`).
- Renderer is Next.js App Router (static export) with a minimal question list/editor (`src/renderer/app/*`).
- Storage backends: SQLite default with core tables scaffolded, JSON available for tests, plus LRU cache for question reads (`src/repository/storage.ts`, `src/repository/sqliteStorage.ts`).
- Data models for questions and test scaffolding exist, but many fields are unused.
- Test coverage: unit tests for repository, basic UI, seeded shuffle, and project manager.

## Stack Alignment vs Spec (High-Level)
| Area | Spec Target | Current State | Gap |
| --- | --- | --- | --- |
| Renderer framework | Next.js 16 + React | Next.js App Router | Aligned |
| Package manager | Bun | Bun scripts and bun.lock | Aligned |
| Electron security | Context isolation, no nodeIntegration | Implemented | Partial (validation missing) |
| Storage | SQLite + cache | SQLite default with question LRU cache | Missing AI cache, broader caching |
| LaTeX pipeline | pdflatex/xelatex, logs | Not implemented | Missing |
| AI provider | Pluggable + safe | Not implemented | Missing |
| Test builder | DnD + constraints | Not implemented | Missing |
| Exports | CSV/Excel matrices | Not implemented | Missing |

## Data Model Coverage
- `Question`, `HeaderPreset`, `LayoutPreset`, `TestTemplate`, and `TestInstance` have validation with choice-type rules; remaining per-type validations are still missing.
- `HeaderPreset` is duplicated in `src/models.ts` (duplicate interface definition).
- `TestTemplate`, `TestInstance`, `ExportProfile`, `Settings` exist but are not persisted or used.

## Key Gaps and Risks
- Project activation now swaps the module `repo` correctly; verify with runtime smoke test.
- Renderer does not implement any of the test builder, drag-and-drop, or export flows.
- No LaTeX compiler integration or error reporting.
- No AI provider interface or key management.
- No caching layer; SQLite is optional and not the default.
- Basic SQLite migration framework exists with seed data for defaults.
- No theming or glassmorphism token system in UI.
- Build scripts now target Bun + Next.js; still missing bun.lockb and build verification.

## Gap Analysis Summary
- Alignment: low (prototype-level, core features missing).
- Primary blockers: stack migration (Next.js + Bun), data layer/migrations, LaTeX pipeline, and export generation.
- Secondary blockers: UI structure, DnD, AI integration, and caching.

## Recommended Sequencing (Next 3 Milestones)
1. Stack migration + shell stability (Next.js 16 + Bun + Electron wiring).
2. Data layer foundation (SQLite default, migrations, cache, model validation).
3. Feature vertical slice (question bank -> test builder -> LaTeX -> export).

## Open Questions
- Do we keep Electron + Next.js (static export) or move to a pure web client?
- Should SQLite be mandatory for all projects or optional in v1?
- Which AI provider is the default and what key storage approach is preferred?
