# TODO

This list tracks open work derived from `spec.md` and current implementation. It is intentionally exhaustive.

## Stack Migration: Next.js 16 + Bun
- [x] Decide renderer strategy: Next.js App Router embedded in Electron (static export) vs dev server.
- [x] Add `bun.lock` and set `packageManager` to Bun in `package.json`.
- [x] Replace Vite renderer with Next.js 16 project structure (`src/renderer` -> `src/renderer/app`).
- [x] Create Next.js config for Electron-friendly builds (static output, asset prefix, base path).
- [x] Update Electron main to load Next.js dev server URL in dev and static build in prod.
- [x] Update build scripts to use `bun run` and add `dev`, `build`, `test`, `lint` variants.
- [x] Remove Vite-specific configs once Next.js is live.
- [ ] Verify hot reload, source maps, and production bundle size.

## Core Domain: Data Models and Validation
- [x] Add basic validation for `Question`.
- [x] Add basic validation for `TestTemplate`, `TestInstance`, `HeaderPreset`, `LayoutPreset`.
- [x] Add per-type validation rules for choice-based questions.
- [ ] Define schema versioning and migrations (SQLite).
- [ ] Expand `Question` model to cover all spec fields (metadata, images, solutions).
- [ ] Add explicit `created_at`/`updated_at` handling in repository layer.

## Storage: SQLite + Caching
- [x] Make SQLite the default storage backend for questions.
- [x] Add basic schema version tracking for SQLite migrations.
- [x] Add tables for tests, templates, presets, exports, settings.
- [x] Implement a basic migration framework.
- [x] Add seed data for default templates/presets/settings.
- [x] Add a basic in-memory LRU cache for question reads.
- [ ] Add AI-specific cache namespace + TTL policies.
- [ ] Add in-memory LRU cache in main process with TTL for AI content.
- [ ] Add cache invalidation hooks for question/test updates.
- [ ] Add per-project cache namespaces and size limits.

## Question Bank UX
- [x] Add filters: subject, topic, subtopic, difficulty, tags, author.
- [ ] Add sorting (last modified, difficulty, topic).
- [ ] Support bulk import/export (JSON/YAML).
- [ ] Add tag management (create, rename, merge).
- [ ] Add image upload flow and placement controls.
- [x] Add question cloning and deletion confirmations.

## Question Editor
- [ ] Add LaTeX-aware editor with live preview and error panel.
- [ ] Add type-specific editors for MC, MS, T/F, short answer.
- [ ] Add choice-level image support (per-choice images).
- [x] Add solution/explanation fields with LaTeX support.

## Test Assembly (Manual)
- [ ] Implement section creation and reordering UI.
- [ ] Add drag-and-drop of questions into sections.
- [ ] Add per-question points and local overrides.
- [ ] Add include/exclude toggles without deletion.

## Test Assembly (Auto / Rule-Based)
- [ ] Define constraint builder UI.
- [ ] Implement selection logic honoring topic/difficulty/type constraints.
- [ ] Add preview and editable result set with DnD.

## AI-Assisted Auto Builder
- [ ] Define prompt schema and request types for AI proposals.
- [ ] Implement AI provider interface (OpenAI + local).
- [ ] Add review flow (accept/edit/reject/replace).
- [ ] Persist AI-generated questions with explicit confirmation.
- [ ] Add rate limiting and retry handling.

## Randomization & Versioning
- [x] Implement deterministic shuffling with seed.
- [x] Shuffle choices for MC and MS questions.
- [ ] Maintain image-to-question pairing after shuffle.
- [x] Add version labeling (A-T) and mapping to answer keys.

## LaTeX Pipeline
- [ ] Implement template system for header/layout presets.
- [ ] Add LaTeX compilation module with logs and error surfacing.
- [ ] Support `pdflatex` and `xelatex` configuration.
- [ ] Add render preview for individual questions and whole tests.

## Exports: CSV/Excel
- [ ] Generate answer key CSV per version.
- [ ] Generate question metadata export.
- [ ] Generate grading matrix Excel with formulas.
- [ ] Add export configuration UI and profiles.

## Project Management
- [ ] Implement project creation wizard and recent projects list.
- [ ] Add project import/export (.examproj) with media/templates.
- [ ] Add project-level templates and presets.

## UI/UX and Theming
- [ ] Implement glassmorphism tokens and theme switcher.
- [ ] Add navigation shell (Dashboard, Bank, Builder, AI, Exports, Settings).
- [ ] Add keyboard shortcuts for common actions.
- [ ] Add responsive layouts for smaller screens.

## Security & Privacy
- [ ] Encrypt AI keys using OS keychain.
- [ ] Add clear-data flows (remove keys, clear cache).
- [ ] Add audit metadata (author and last modified).

## Testing & QA
- [ ] Add unit tests for randomization and constraint solver.
- [ ] Add tests for export generation and LaTeX templates.
- [ ] Add integration tests for project import/export.
- [ ] Add E2E Electron tests for key user flows.

## Build & Release
- [ ] Wire `electron-builder` with Next.js output.
- [ ] Add CI pipeline for lint/test/build artifacts.
- [ ] Add per-OS packaging configs.
