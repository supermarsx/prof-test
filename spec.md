# Cross-Platform LaTeX Test Generator – Specification

## 1. Overview

A cross-platform desktop application (Windows, macOS, Linux) that allows teachers to:

- Maintain a structured bank of questions (including questions with images/figures).
- Assemble LaTeX-formatted tests from that bank.
- Configure reusable headers and layout presets for tests.
- Automatically generate up to 20 randomized versions of each test (with matching answer keys).
- Use AI assistance to generate and refine questions and distractors.
- Use **AI-assisted auto test builder** that can propose full tests from constraints and syllabus.
- Visually customize test structure and ordering using **drag-and-drop**.
- Export answer keys and grading matrices to **CSV and Excel** for offline or external grading.

The app should be self-contained, offline-first (for test authoring and LaTeX compilation), with optional online connectivity for AI features.

Primary implementation:

- **Electron + TypeScript app**: Electron shell, React/TS frontend, Node backend, bundled LaTeX toolchain.

## 2. User Roles & Personas

### 2.1 Roles

- **Teacher/Instructor**
  - Creates and maintains question banks.
  - Builds tests and variants.
  - Uses AI assistance to generate/modify questions.
  - Uses AI-assisted auto builder to propose full tests.
  - Uses CSV/Excel exports and grading matrices to grade exams.

- **Administrator (optional)**
  - Manages shared question banks (if multi-user mode added later).
  - Manages global settings (LaTeX templates, presets, AI provider settings).

> Students do **not** use this app directly.

### 2.2 Key User Goals

- Quickly create high-quality, LaTeX-formatted exams.
- Avoid repetition by generating multiple randomized versions.
- Ensure consistent difficulty and coverage across test variants.
- Reuse questions and layout/header presets across courses/years.
- Use AI to speed up question authoring and test building while preserving full control.
- Export structured answer keys and grading matrices to spreadsheets without needing direct LMS integrations.

## 3. Core Features

### 3.1 Question Bank Management

- **Question Types**
  - Multiple Choice (single correct answer).
  - Multiple Select (multiple correct answers).
  - Short Answer / Free Response.
  - True/False.
  - Matching (optional for v1, or v1.1 feature).

- **Question Metadata**
  - Unique ID (internal).
  - Subject (e.g., Math, Physics).
  - Topic / Subtopic.
  - Difficulty (e.g., 1–5 or Easy/Medium/Hard).
  - Tags (free-form labels).
  - Estimated time to answer.
  - Author.
  - Last modified timestamp.

- **Content Fields**
  - Question stem (supports rich text / markdown-like input with LaTeX, rendered preview).
  - Choices & correct answer(s) (for choice-based questions).
  - Explanations / solutions (LaTeX-supported).
  - **Image/figure support**:
    - Attach one or more images per question.
    - Per-image metadata: alt text, caption, placement (above stem, below stem, inline with text, per-choice image for MC).
    - Stored as files in project media folder and referenced in LaTeX.

- **Operations**
  - Create, edit, clone, delete questions.
  - Create "question with image" via a dedicated flow (select/upload image first, then write stem referencing it).
  - Bulk import/export question banks:
    - JSON/YAML (structured format).
  - Search/filter questions by metadata and text.
  - Tag management (create/rename/merge tags).

### 3.2 Test Assembly

- **New Test Wizard**
  - Choose course/subject.
  - Set test-level metadata:
    - Title, subtitle.
    - Date.
    - Duration.
    - Instructions.
  - Choose or define a **header preset**.
  - Choose target number of questions per section.
  - Define sections (e.g., Section A – Multiple Choice, Section B – Short Answer).

- **Configurable Header & Layout Presets**
  - **Header configuration** (per test, with reusable presets):
    - School name/logo.
    - Course name & code.
    - Instructor name.
    - Test title and variant label (A–T).
    - Student name/ID fields (lines or boxes).
    - Date and duration fields.
  - **Presets**:
    - Save current header layout and content as a named preset.
    - Global presets (available to all projects) and project-level presets.
    - Presets cover: header, footer, page style (margins, font, line spacing), question numbering style, and points display.
    - Ability to duplicate a preset and tweak.

- **Manual Assembly Mode**
  - **Drag-and-drop customizer**:
    - Drag questions from a filtered question list into the test structure.
    - Drag to reorder questions within a section.
    - Drag questions between sections.
    - Drag to reorder sections.
  - Edit per-question properties inside the test:
    - Points.
    - Local instructions.
    - Visibility (include/exclude without removing from template).

- **Automatic Assembly Mode (Rule-Based)**
  - Define constraints:
    - Total number of questions.
    - Per-topic question count/percentage.
    - Difficulty distribution (e.g., 30% easy, 50% medium, 20% hard).
    - Question type distribution.
    - Exclude tags (e.g., previously used in last exam).
  - System selects questions that satisfy constraints.
  - Teacher can preview/edit the auto-generated selection using drag-and-drop.

- **AI-Assisted Auto Builder**
  - Takes as input:
    - Course/subject.
    - Syllabus topics/learning objectives (can paste or pick from preset topic lists).
    - Target difficulty mix.
    - Target length (number of questions and/or total estimated time).
    - Question type preferences.
  - AI proposes:
    - A candidate test structure (sections, question counts).
    - A mix of **existing questions** from the bank plus newly suggested AI-generated questions (flagged as "draft").
  - Workflow:
    1. Teacher launches AI Auto Builder.
    2. Define constraints and choose header/layout preset.
    3. AI returns a proposed test.
    4. Teacher reviews each question (existing + new) and can:
       - Accept as-is.
       - Edit.
       - Reject.
       - Replace via "Suggest alternative".
    5. Accepted questions are added to the test; new AI questions are also added to the bank (after explicit confirmation).
  - AI never directly finalizes a test without user review.

- **Versioning & Templates**
  - Save a test definition as a reusable template (structure + constraints + header/layout preset, but not necessarily specific questions).
  - Versioning of tests (v1, v2, etc.) with change log.

### 3.3 Test Version Generation (Randomization)

- **Randomization Parameters**
  - Number of versions to generate (1–20).
  - Randomization strategy:
    - Shuffle question order.
    - Shuffle answer choices (for multiple choice).
    - Optionally swap equivalent questions from the same topic/difficulty pool.
  - Fix random seed per generation to allow reproducibility.
  - Respect constraints for **questions with images**:
    - Ensure associated images follow the question when shuffling.
    - Ensure LaTeX figure labels/captions remain correct.

- **Constraints**
  - Keep section structure consistent across all versions.
  - Maintain similar difficulty profile and coverage across versions.
  - Ensure correct mapping between each test version and its corresponding answer key.

- **Outputs**
  - For each version:
    - LaTeX source file.
    - Compiled PDF (if LaTeX toolchain available).
  - For answer keys:
    - LaTeX/PDF keys per version (e.g., Test A, Test B, etc.).
    - Structured **CSV/Excel exports**, including grading matrices (see 3.7).

### 3.4 LaTeX Integration

- **Template System**
  - Global LaTeX templates for:
    - Test document preamble.
    - Question and choice formatting.
    - Header/footer, page numbering.
  - Header/footer driven by **configurable header presets**.
  - Per-test overrides (e.g., display points next to questions, custom headers).

- **Preview**
  - Live LaTeX preview for:
    - Individual questions (including question-with-image layout).
    - Assembled test (quick layout preview, including header presets and drag-and-drop ordering).
  - Error panel to show LaTeX compilation errors and link them to question content.

- **Compilation**
  - Bundled minimal LaTeX distribution or configurable external LaTeX path.
  - Support for `pdflatex` or `xelatex`.
  - Build logs stored per compilation.

### 3.5 AI-Assisted Question Generation

- **Use Cases**
  - Generate new questions from:
    - A topic outline (e.g., "Quadratic equations – solving by factoring").
    - A reference explanation or passage.
  - Generate distractors for a given correct answer.
  - Rephrase questions at different difficulty levels.
  - Generate solutions and explanations.
  - Suggest image-based questions, with:
    - Prompt for the desired figure (e.g., "parabola graph", "circuit diagram").
    - Textual description that can be turned into a diagram by the teacher or external tool.

- **Workflow**
  1. Teacher opens AI panel.
  2. Selects subject/topic and question type; optionally indicates "question with image".
  3. Provides prompts/context (e.g., concepts, target difficulty, figure description).
  4. AI returns multiple draft questions.
  5. Teacher reviews, edits, and selectively adds them to the question bank.

- **AI-Assisted Auto Builder Integration**
  - The AI panel is also used by the auto builder:
    - For missing coverage in certain topics, AI suggests additional questions.
    - For difficulty balancing, AI proposes variants of existing questions.

- **Controls & Safety**
  - All AI output must be editable; nothing is auto-published into the bank.
  - Clear indication that suggestions come from AI.
  - Configurable AI provider (e.g., OpenAI, local model API) with pluggable architecture.
  - Rate limiting and retry handling around API calls.

### 3.6 Project & File Management

- **Project Concept (Optional for v1 but recommended)**
  - A "project" groups:
    - Question banks.
    - Tests and their variants.
    - LaTeX templates.
    - Header/layout presets.
  - Project stored as a folder with:
    - SQLite DB or structured JSON files.
    - `media/` for images.
    - `templates/` for LaTeX.

- **Import/Export**
  - Export entire project as a single archive file (.examproj).
  - Import projects on another machine.
  - Export single test (LaTeX + assets) for use outside the app.

### 3.7 CSV & Excel Exports + Grading Matrices

- **Export Types**
  - **Answer Key CSV** per test/version:
    - Columns: Test ID, Version label, Question number, Question ID, Correct answer(s), Points.
  - **Question Metadata CSV/Excel**:
    - Columns: Question ID, Subject, Topic, Difficulty, Tags, Estimated time, Usage count, Last used date.
  - **Grading Matrix Excel Template**:
    - One worksheet per test (or per version group if desired).
    - Rows: Students (with blank or pre-filled Name/ID columns).
    - Columns: Question numbers, auto-populated correct answers row, point values row.
    - Additional columns: Total score, Percentage, Grade.
  - **Response Import Template (Excel)**:
    - Designed to be printed or used directly in Excel for manual entry of student answers.

- **Grading Matrix Behavior**
  - For each generated test:
    - Create an Excel file with:
      - `AnswerKey` sheet: structured key for all versions.
      - `GradingMatrix_VersionX` sheets: one per version.
    - Pre-fill formulas for:
      - Per-question correctness (e.g., compare student response to answer key).
      - Per-student total score and percentage.
      - Optional conditional formatting to highlight incorrect answers or low scores.
  - Support both:
    - **Per-version grading** (one sheet per version).
    - **Mixed-class grading** where different versions appear in one sheet, with a Version column used to look up correct answers.

- **Export Configuration**
  - UI to choose:
    - Which tests/versions to export.
    - Export formats (CSV, Excel, or both).
    - Level of detail (e.g., include solutions/explanations or not).
  - Remember last used export settings on a per-project basis.

## 4. Non-Functional Requirements

### 4.1 Platform Support

- OS: Windows 10+, macOS 12+, modern Linux distros.
- Cross-platform UI must behave consistently.
- The app must run offline for everything except AI calls.

### 4.2 Performance

- Load question banks with up to:
  - 50k questions without noticeable lag in search/filter operations.
- Generate and compile up to 20 variants of a typical exam (<10 pages) within reasonable time, assuming LaTeX toolchain is installed.
- UI should remain responsive during long tasks (use background workers / async).

### 4.3 Reliability & Resilience

- Autosave edits (questions/tests) every N seconds.
- Crash recovery: on restart, offer to restore last autosaved state.
- Transactions around DB writes to prevent corruption.

### 4.4 Usability

- Clean, minimal UI with clear separation between:
  - Question bank.
  - Test assembly.
  - AI assistance / auto builder.
  - Settings.
- Intuitive **drag-and-drop** interactions with visual affordances (grab handles, ghost previews).
- Keyboard shortcuts for power users (search, add question, compile, move question up/down, etc.).
- Localization-ready (string extraction), default English.

## 5. Architecture

### 5.1 High-Level Architecture

High-level architecture for the Electron implementation:

- **Presentation Layer (UI)**
  - Displays question bank, test builder, AI panel, export dialogs.
  - Drag-and-drop operations for test customization.
  - Handles user input, validation, and navigation.

- **Application Layer**
  - Orchestrates operations (e.g., assemble test, generate versions, invoke AI auto builder, build grading matrices).
  - Implements business rules (difficulty balancing, randomization logic, header preset application, grading matrix generation).

- **Domain/Data Layer**
  - Manages persistence of questions/tests/templates/presets/settings.
  - Provides search/filter over questions.
  - Generates exports (CSV/Excel) from stored data.

- **Integration Layer**
  - LaTeX toolchain module.
  - AI provider module(s).

### 5.2 Data Model (Simplified)

#### Entities

- **Question**
  - id: UUID
  - type: enum
  - subject: string
  - topic: string
  - subtopic: string
  - difficulty: int
  - tags: string[]
  - estimated_time_min: float
  - stem: text (LaTeX/markdown)
  - choices: [{ id, text, is_correct }]
  - solution: text
  - explanation: text
  - media_refs: [{ id, path, alt_text, placement, caption }]
  - author: string
  - created_at: datetime
  - updated_at: datetime

- **HeaderPreset**
  - id: UUID
  - name: string
  - scope: enum (global | project)
  - latex_snippet: text (header block)
  - fields_config: {
      show_logo: bool,
      logo_path: string,
      show_course: bool,
      show_instructor: bool,
      show_date: bool,
      show_duration: bool,
      student_name_line: bool,
      student_id_line: bool
    }

- **LayoutPreset** (can be merged with HeaderPreset or kept separate)
  - id: UUID
  - name: string
  - page_margins: { top, bottom, left, right }
  - font_family: string
  - base_font_size: int
  - line_spacing: float
  - numbering_style: enum
  - show_points_inline: bool

- **TestTemplate/TestDefinition**
  - id: UUID
  - title: string
  - course: string
  - description: text
  - metadata: { date, duration, custom_fields }
  - header_preset_id: UUID
  - layout_preset_id: UUID
  - sections: [SectionDefinition]
  - constraints: {
      difficulty_distribution,
      topic_distribution,
      total_questions,
      per_section_questions,
      type_distribution
    }
  - randomization_options: {
      shuffle_questions,
      shuffle_choices,
      swap_equivalent_questions
    }

- **SectionDefinition**
  - id: UUID
  - name: string
  - description: text
  - order_index: int
  - question_references: [QuestionRef | ConstraintRef]

- **TestInstance (Version)**
  - id: UUID
  - test_template_id: UUID
  - version_label: string (A–T)
  - random_seed: int
  - generated_questions: [QuestionInstance]
  - latex_source_path: string
  - pdf_path: string
  - answer_key: structured mapping { question_number -> correct_answer(s) }

- **QuestionInstance**
  - id: UUID
  - base_question_id: UUID
  - points: float
  - local_overrides: {
      stem,
      choices,
      solution,
      explanation,
      media_refs
    }
  - order_index: int

- **ExportProfile** (optional for v1)
  - id: UUID
  - name: string
  - format: enum (csv | xlsx)
  - includes: enum set (answer_keys, grading_matrix, question_metadata)
  - options: JSON (e.g., per-version vs combined, include_solutions)

- **Settings**
  - latex_path / use_embedded_latex: bool/string
  - ai_provider: enum
  - ai_api_key_encrypted: string
  - language: string

### 5.3 Storage

- **Local Database**: SQLite recommended.
  - Optionally use encryption (e.g., SQLCipher) if storing sensitive data.
- **File Storage**:
  - Store LaTeX, PDFs, presets, and media in project directory.
  - Use relative paths in DB for portability.

### 5.4 Caching Layer

- **In-Memory Cache** (in Electron main process):
  - Used to speed up access to:
    - Frequently-used questions and metadata.
    - Recently-opened tests and templates.
    - AI-assisted auto builder intermediate results.
  - Implemented as an LRU-style cache with configurable size limit.
  - Per-project cache namespaces to avoid cross-project leakage.

- **Guardrails for Caching**:
  - Hard upper bound on memory usage; when exceeded, cache evicts least-recently-used entries.
  - TTL (time-to-live) for AI-related cache entries to avoid stale pedagogy/content.
  - No caching of sensitive secrets (AI keys, etc.).
  - Cache invalidation hooks:
    - On question update/delete, invalidate that question's cached entry.
    - On template/preset change, invalidate related compiled/expanded LaTeX fragments.
  - Only derived/replicable data is cached; SQLite remains the source of truth.

- **SQLite + Cache Interaction**:
  - Read path: check in-memory cache → fallback to SQLite → populate cache.
  - Write path: write to SQLite inside a transaction → update/invalidate cache in the same flow.
  - All persistence-critical operations must succeed in SQLite even if the cache is disabled.

## 6. Chosen Implementation – Electron + TypeScript

### 6.1 Tech Stack

- **Frontend**: React + TypeScript.
- **Desktop Shell**: Electron.
- **Styling**:
  - CSS-in-JS or utility-first CSS (e.g., Tailwind) with design tokens.
  - Glassmorphism-friendly components (blurred backgrounds, subtle borders, translucency).
  - Default **dark mode** with well-contrasted colors; optional light mode.
- **State Management**: Redux Toolkit or Zustand.
- **Drag-and-Drop**: React DnD or native HTML5 drag-and-drop APIs.
- **DB Layer**:
  - SQLite via Node bindings (e.g., better-sqlite3) or an embedded DB like `sql.js`.
  - In-memory caching layer on top of SQLite in the main process.
- **IPC**: Electron main process for FS/LaTeX/AI, renderer for UI.
- **Build & Packaging**: `electron-builder` for installers.

### 6.2 Process Architecture

- **Electron Main Process**
  - Manages window lifecycle.
  - Handles LaTeX compilation via child processes.
  - Manages DB access and file system interactions.
  - Generates CSV/Excel exports and grading matrices.
  - Hosts secure configuration (encrypted AI keys, LaTeX paths).

- **Renderer Process (React UI)**
  - Implements glassmorphism UI using CSS variables (for blur, opacity, border radii, etc.).
  - Implements main app screens: Question Bank, Question Editor, Test Builder, AI Auto Builder, Exports, Settings.
  - Communicates with main via IPC (e.g., `contextBridge` + `ipcRenderer` in a preload script).

### 6.3 IPC & Security

- Use **context isolation** with a preload script that exposes a minimal, typed API to the renderer.
- Disable `nodeIntegration` in renderer.
- Strictly validate IPC messages in the main process.
- Use TypeScript interfaces for request/response payloads (e.g., `GenerateTestRequest`, `CompileLatexRequest`, `ExportGradingMatrixRequest`).

### 6.4 LaTeX Integration

- Main process spawns `pdflatex`/`xelatex` child processes.
- Manage temp directories and cleanup.
- Stream compilation logs back to renderer via IPC for error display.
- Support configurable LaTeX path; optionally detect typical installations on first run.

### 6.5 AI Integration

- Main process hosts AI client layer:
  - Wraps HTTP calls to AI provider(s).
  - Performs request shaping and response post-processing.
- Renderer sends:
  - Question-generation prompts.
  - Auto-builder constraints.
- Main responds with structured question objects or auto-builder proposals.

### 6.6 Packaging & Distribution

- Use `electron-builder` to create installers for:
  - Windows: `.exe`.
  - macOS: `.dmg` or `.pkg`.
  - Linux: `.AppImage` / `.deb` / `.rpm`.
- Optional auto-update channel (later), using GitHub Releases or custom update server.

## 7. UI Style & Theming Guidelines (Glassmorphism + Dark Mode)

### 7.1 General Visual Style

- **Glassmorphism** principles:
  - Semi-transparent panels with background blur (e.g., `backdrop-filter: blur(...)`).
  - Subtle borders (1px) with slightly lighter or darker tints than background.
  - Rounded corners (8–16px) for cards, dialogs, and panels.
  - Soft shadows, minimal depth stacking.
- Maintain a **clean, low-noise** layout: few strong colors, focus on typography and spacing.

### 7.2 Dark Mode (Default)

- Default theme is **dark**:
  - Background: very dark, slightly tinted (e.g., near-black with a hue).
  - Panels: translucent dark surfaces with blur.
  - Text: high-contrast light typography, meeting accessibility contrast ratios.
  - Primary accent color used sparingly for:
    - Primary buttons.
    - Active filters.
    - Selected items and drag handles.
- Light theme available as a toggle, but dark is the primary design target.

### 7.3 Layout & Components

- **Main Layout**
  - Top app bar (translucent) with project name, quick actions, theme toggle.
  - Side navigation (glass panel) for switching between main areas: Dashboard, Question Bank, Test Builder, AI Auto Builder, Exports, Settings.
  - Content area uses stacked glass panels for different functional regions.

- **Question Bank & Builder**
  - Cards/lists for questions with clear visual states: selected, hovered, drag-in-progress.
  - Drag-and-drop handles styled as subtle grabbable areas.

- **AI Panels**
  - Split view: prompt/config on left, AI suggestions on right as cards.
  - Each suggestion card has clearly-separated actions (Accept, Edit, Reject).

- **Exports & Grading**
  - Wizard-style or tabbed UI for selecting tests/versions and export formats.
  - Preview of generated CSV/Excel structure (e.g., sample rows/columns).
  - Clear indication of where grading formulas live in the Excel output.

### 7.4 Theming Implementation

- Use a **design token** system:
  - Colors, spacing, typography, radii, blur levels defined as CSS variables.
  - Dark and light themes implemented via theme classes on `body` (e.g., `.theme-dark`, `.theme-light`).
- Respect OS color scheme when first launching the app but keep dark as default if no preference is detected.
- Provide in-app theme toggle in Settings and in the top bar.

## 8. Security & Privacy Considerations

### 8.1 Local Data

- Store all question/test data locally by default.
- Support encrypted databases (configurable) where required.
- Regular backups (automatic or prompted) to prevent data loss.

### 8.2 AI API Keys

- Keys stored encrypted on disk using OS-provided keychains where possible:
  - Windows Credential Manager.
  - macOS Keychain.
  - GNOME Keyring/KWallet on Linux or a local encrypted file as fallback.

- Never log full keys.
- Allow users to clear keys from settings.

### 8.3 Network & Telemetry

- AI calls only send minimal necessary text/content.
- No automatic telemetry without explicit opt-in.
- If telemetry added, ensure:
  - Anonymization.
  - Clear documentation and controls.

### 8.4 Integrity & Authorship

- Keep change history per question (who/when modified) in DB for auditability (if multiple users share a project file).
- Track AI-generated vs human-authored content for transparency.

### 8.5 Cache Safety

- Never store API keys, passwords, or other secrets in the in-memory cache.
- Respect project boundaries: cache keys must include project identifiers to prevent cross-project data exposure.
- Provide a "Clear cache" action in Settings to flush in-memory caches and reload from SQLite.
- Ensure that cache failures (e.g., OOM, eviction bugs) degrade gracefully by falling back to direct SQLite reads.

## 9. UI/UX Outline

### 9.1 Main Screens

1. **Dashboard / Project Home**
   - Recent projects.
   - Quick links: "New Test", "New Question", "AI Auto Builder", "Exports", "Open Project".

2. **Question Bank View**
   - Left: Filters (subject, topic, difficulty, tags).
   - Center: Question list (table with key metadata + image indicator).
   - Right: Preview of selected question, with LaTeX rendering and inline images.
   - Toolbar: New/Edit/Clone/Delete, Bulk Import/Export, AI Generate.

3. **Question Editor**
   - Tabs: "Content", "Solution/Explanation", "Metadata", "Images".
   - STEM editor with LaTeX helper buttons.
   - Image management area (upload/select, set placement and caption).
   - Live preview pane.

4. **Test Builder (Drag-and-Drop Customizer)**
   - Left: Question bank filtered view.
   - Center: Test structure tree (sections and questions) with drag handles.
   - Right: Properties panel (section metadata, question points, local overrides).
   - Supports drag-and-drop reordering of sections and questions.

5. **AI Auto Builder**
   - Form for constraints and syllabus input.
   - Results view showing proposed test with sections.
   - Inline actions to accept/edit/reject questions.

6. **Test Versions & Export**
   - List of generated versions with status icons (LaTeX compiled, errors, etc.).
   - Preview panel for selected version.
   - Buttons to open PDF, open output folder, regenerate.

7. **Exports & Grading Matrices**
   - Screen to select tests/versions and export format (CSV/Excel).
   - Options to generate answer keys only or full grading matrices.
   - Display of export summary (file names, target locations).

8. **Settings**
   - LaTeX configuration.
   - AI configuration.
   - Header/layout presets management UI.
   - Backup & storage settings.
   - Theme (light/dark mode).
   - Cache management (clear cache, cache size limits).

### 9.2 Accessibility

- High-contrast theme support.
- Keyboard navigability for all features (including drag-and-drop alternatives via move-up/move-down buttons).
- Scalable fonts.

## 10. Testing Strategy

### 10.1 Automated Tests

- **Unit Tests**
  - Randomization logic (ensure deterministic output for given seed).
  - Constraint satisfaction for auto-assembly.
  - Data model validation.
  - AI integration wrapper (mocked calls).
  - Header/layout preset application to LaTeX templates.
  - In-memory cache behavior (LRU eviction, TTL expiration, invalidation on writes).
  - CSV/Excel generation logic (correct columns, formulas, format selection).

- **Integration Tests**
  - Creation of questions (with and without images), assembling tests, generating variants, and exporting LaTeX.
  - LaTeX compile pipeline with sample templates and header presets.
  - DB migrations.
  - End-to-end CSV/Excel export generation for sample tests.

- **End-to-End (E2E) Tests**
  - Simulate user journeys:
    - Create project → Add questions (+images) → Build test via auto builder → Drag-and-drop customize → Generate 5 versions → Export grading matrix → Verify file presence.
  - For Electron: Playwright/Spectron (or similar) for UI flows.

### 10.2 Manual QA

- Cross-platform UI review.
- Large question bank performance tests.
- Fuzzing of LaTeX input for stability (ensure bad LaTeX produces clear errors, not crashes).
- Visual validation of header presets, drag-and-drop behavior, and export configuration.

### 10.3 Regression Testing

- Maintain sample project(s) as golden datasets.
- Snapshot tests for LaTeX outputs where feasible (hash or text diff).
- Snapshot tests for representative CSV/Excel exports (structure and column names).

## 11. Build & Deployment Requirements

- Reproducible build scripts:
  - Electron: `npm`/`pnpm` scripts for lint, test, build, package.

- CI pipeline (GitHub Actions / GitLab CI / etc.):
  - Lint (eslint+tsc).
  - Run tests.
  - Build release artifacts for each OS.

- Release artifacts:
  - Windows: .exe installer.
  - macOS: .dmg or .pkg.
  - Linux: .AppImage/.deb/.rpm.

## 12. Future Enhancements (Post-v1)

- Collaborative editing with a shared central server.
- Cloud sync of projects.
- Advanced analytics on exported results (e.g., import graded Excel files for item analysis).
- Additional question types (code snippets with syntax highlighting, interactive questions).
- AI-assisted diagram generation (exportable as images) for image-based questions.
- More sophisticated Excel grading templates (multiple marking schemes, standards-based grading rubrics).

---

This specification defines the core scope and architecture for the cross-platform LaTeX test generator with AI-assisted question creation, configurable headers and presets, AI-assisted auto test building, support for questions with images, drag-and-drop test customization, and structured CSV/Excel exports with grading matrices.

