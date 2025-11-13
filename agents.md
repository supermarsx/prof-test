This repository contains the specification and initial README for the "prof-test" cross-platform LaTeX test generator.

Agent guidance
- Always run fast searches with `rg` (ripgrep). Prefer `rg` over `grep`.
- When reading files use the provided file read tool (or open the file directly). Avoid dumping very large files to the terminal.
- The repository's root spec is `spec.md`. Use it as the single source of truth for features and data models.
- Respect AGENTS.md rules in nested directories (deeper AGENTS.md override higher-level guidance).
- When making changes:
  - Keep changes minimal and focused to satisfy the requested task.
  - Follow TypeScript/Electron practices described in `spec.md` (TypeScript, React, Electron main/renderer separation).
  - Do not add unrelated changes or reformat the entire repo.
- Testing & validation:
  - Add unit tests for new logic where appropriate.
  - When running tests or builds, use `npm`/`pnpm` scripts if available (prefer `npm run test`, `npm run build`).
- Git policy:
  - Do not push changes to remote; create commits locally when asked.
  - When asked to create a commit, include a concise commit message describing the "why".
- Security & secrets:
  - Do not commit secrets or API keys.
  - Follow `spec.md` guidance for AI keys and encryption.
- File edits:
  - If the environment is read-only, prepare drafts and ask the user for approval before writing.
  - Always present a short preamble before executing file-modifying actions.
- Communication:
  - Provide concise plans for multi-step tasks using the repo todo tool.
  - Update progress frequently for long tasks.

Minimum local workflow (recommended)
- Scaffolding:
  - `npm init -y`
  - Add TypeScript + Electron + React scaffold using preferred tooling.
- Scripts to add to `package.json` (examples):
  - `dev` — run electron + renderer in dev
  - `build` — build and package
  - `test` — run unit tests
- Tests:
  - Place tests under `src/__tests__` or `tests/`.
- When unsure about design choices, refer to `spec.md` first and ask for clarifying direction.

Note about current mode
- This repository is currently in a read-write phase. Proceed with caution and ask for approval for large or destructive changes.

End of agents.md
