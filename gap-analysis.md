# AGPA Check (Architecture Gap & Plan Alignment)

AGPA = Architecture Gap and Plan Alignment. This document compares the current codebase to `spec.md` and highlights gaps, risks, and next actions.

## Scope and Method
- Source of truth: `spec.md`
- Codebase scanned: `src/main.ts`, `src/preload.ts`, `src/models.ts`, `src/repository/*`, `src/renderer/*`, `src/__tests__/*`
- Focus: stack alignment, core features, data model coverage, and build/test pipeline

## Current Codebase Snapshot
- Electron main process with IPC for question CRUD and basic project/media management (`src/main.ts`).
- Renderer is Vite + React with a minimal question list/editor (`src/renderer/*`).
- Storage backends: JSON file default, optional SQLite (`src/repository/storage.ts`, `src/repository/sqliteStorage.ts`).
- Data models for questions and test scaffolding exist, but many fields are unused.
- Test coverage: unit tests for repository, basic UI, seeded shuffle, and project manager.

## Stack Alignment vs Spec (High-Level)
| Area | Spec Target | Current State | Gap |
| --- | --- | --- | --- |
| Renderer framework | Next.js 16 + React | Vite + React | Migration needed |
| Package manager | Bun | npm (package-lock) | Migration needed |
| Electron security | Context isolation, no nodeIntegration | Implemented | Partial (validation missing) |
| Storage | SQLite + cache | JSON default, optional SQLite | Missing cache, migrations |
| LaTeX pipeline | pdflatex/xelatex, logs | Not implemented | Missing |
| AI provider | Pluggable + safe | Not implemented | Missing |
| Test builder | DnD + constraints | Not implemented | Missing |
| Exports | CSV/Excel matrices | Not implemented | Missing |

## Data Model Coverage
- `Question` includes most fields, but there is no validation or strict typing for per-type content.
- `HeaderPreset` is duplicated in `src/models.ts` (duplicate interface definition).
- `TestTemplate`, `TestInstance`, `ExportProfile`, `Settings` exist but are not persisted or used.

## Key Gaps and Risks
- Project activation bug: `project:activate` replaces `global.repo` instead of the module `repo`, so IPC handlers keep using the old repository instance (`src/main.ts`).
- Renderer does not implement any of the test builder, drag-and-drop, or export flows.
- No LaTeX compiler integration or error reporting.
- No AI provider interface or key management.
- No caching layer; SQLite is optional and not the default.
- No migration framework; data files are not versioned.
- No theming or glassmorphism token system in UI.
- Build scripts and tooling are Vite/npm-based, not Bun + Next.js.

## AGPA Result Summary
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
