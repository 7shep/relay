# AGENTS.md

## Project overview

Relay is a single local-first React/Vite application. The default surface is a terminal-style personal dashboard for focus tasks, weather, assignments, GitHub pull requests, and a Qwen assistant. `App` can switch into the study-memory workspace for ChatGPT session capture, bounded course context, assessment evidence, Tutor guidance, and Assignment guidance backed by a local-first archive.

Read these documents before making broad product or visual changes:

- `README.md` — user-facing setup and provider requirements.
- `DESIGN.md` — implementation-derived typography, color, spacing, components, layout, motion, and responsive guidance.
- `docs/designs/agent-workspace.md` — the legacy academic workspace product brief and trust boundaries; consult it when touching the retained academic runtime.
- `docs/designs/chatgpt-study-memory-bridge.md` — the approved study-memory bridge product brief and current implementation contract.

## Commands

```bash
npm install
npm run dev
npm run build
npm test
npm run preview
npm run bridge
```

`npm test` runs Vitest in run mode. Runtime coverage is in `src/services/academicRuntime.test.js` and `src/services/studyMemoryRuntime.test.js`. `npm run bridge` starts the optional authenticated localhost companion; configure `RELAY_BRIDGE_SECRET` and, when needed, `RELAY_STUDY_ROOT` before starting it.

## Source map

- `src/main.jsx` mounts the app and imports `src/styles/index.css`.
- `src/App.jsx` owns top-level dashboard/workspace routing, focus-task state, assignment import, modal state, and service orchestration.
- `src/components/` contains the dashboard panels, assistant docks, `StudyMemoryWorkspace`, retained academic workspace, modal, markdown renderer, shared panel shell, and project-owned icon set.
- `src/styles/` contains the imported CSS surfaces. `index.css` imports dashboard, panels, assistant, modal, responsive, academic, and study-memory styles.
- `src/services/` contains network/provider adapters and runtimes: local Qwen/Ollama, Luna bridge, weather/Open-Meteo, GitHub, syllabus/PDF extraction, academic runtime records, and `studyMemoryRuntime.js`.
- `src/utils/` contains local-storage helpers, date/formatting helpers, and JSON extraction.
- `src/constants/` contains provider URLs/models, seeded task/weather data, and prompts.
- `bridge/` contains the optional standard-library localhost bridge that owns the real `study-context/` folder.
- `skills/` contains the ChatGPT-side `capture-study-session`, `tutor`, and `assignment` skill contracts.
- `study-sessions/` is the root manual-export directory. Put each generated bundle in its uppercase class folder as `study-sessions/CLASS/CLASS-session-DATE.json`; generated `*.json` bundles are ignored, and the root `.gitkeep` marker must remain.

## Data and provider boundaries

- Focus state, assignments, GitHub configuration, and the academic workspace are persisted in browser storage through `src/utils/storage.js` and `src/services/academicRuntime.js`. Preserve the existing keys and defensive fallbacks when changing persistence.
- Study-memory browser state uses `relay.study-memory.v1` through `src/services/studyMemoryRuntime.js` as a compatibility cache. When configured, the bridge owns the durable `study-context/courses/<COURSE>/` archive; do not treat browser storage as the canonical course archive.
- Study-memory writes are proposal-based: a proposal must be visible, explicitly approved, and committed with its exact short-lived approval token. Preserve immutable raw session/material artifacts, source-linked derived summaries/signals, duplicate detection, cancellation, failure visibility, and append-only learner revisions/tombstones.
- Session bundles follow schema version 1 and the `skills/capture-study-session/SKILL.md` contract. Manual exports use `study-sessions/CLASS/CLASS-session-DATE.json`; `/` in a human date is normalized to `-` for Windows filenames while the JSON keeps the original session date.
- Tutor context is bounded to the selected course/topic even though the Tutor profile refresh is cross-course. Refresh strengths, weaknesses, improvements, unresolved questions, and practice suggestions only after every three newly committed sessions, and keep the refresh an explicit derived proposal.
- Assignment guidance resolves a named assignment from the local context folder/manifest and must expose missing prompt, rubric, draft, material, or learner context instead of inventing it. It may guide and model answers but must not submit work, overwrite drafts, or silently save.
- Graphify is optional. Its refresh state is derived from the canonical study-session evidence archive; Relay remains the canonical evidence reader and must not claim that Graphify changed without a committed adapter response.
- Qwen uses Ollama at `http://localhost:11434/api/chat` with model `qwen2.5:7b`. It handles operational planning, task capture, and syllabus extraction.
- The academic provider is Luna 5.6 through `VITE_LUNA_BRIDGE_URL`. The browser talks to the local companion bridge; do not put Luna/Codex credentials in browser storage.
- GitHub credentials are currently stored in local storage by the MVP. Treat this as sensitive and do not expand token exposure; the README identifies Windows keychain storage as a future Tauri improvement.
- Academic artifacts, runs, handoffs, signals, and learner-profile changes must remain visible and explainable. The workspace must not silently overwrite a draft, submit academic work, or create dashboard tasks.
- The study bridge exposes read-only `/ping` and `/course_context` plus authenticated proposal/approval/commit endpoints. Bind it to localhost, require `RELAY_BRIDGE_SECRET` for writes, enforce the course path allowlist, reject symlink/reparse-point escapes, and never expose it publicly without a reviewed authenticated tunnel.
- External requests must accept/propagate `AbortSignal` where the surrounding adapter already does so, and UI loading/error states must not be presented as successful provider runs.

## UI conventions

- Reuse `Panel` for terminal dashboard panels and `Icon` for symbols. Do not add a UI component library without an explicit product decision.
- Use the existing CSS custom-property systems: `--term-*` for the dashboard and `--academic-*` for the school workspace. Keep new appearance values tokenized when they represent a reusable role.
- Study-memory styles use the local `--memory-*` token system in `src/styles/memory.css`; preserve its dark file/archive surfaces, green primary evidence state, amber caution/tutor state, and red failure state.
- Preserve the visual language: dark surfaces, thin borders/dividers, JetBrains Mono fallbacks for utility text, green primary accents, amber caution/tutor states, and red dashboard danger states.
- Keep the existing responsive breakpoints in scope: dashboard `850px`/`560px`; study-memory/academic `1120px`/`760px`/`450px`.
- Preserve keyboard behavior and visible focus styles. The task modal has Escape handling and a focus trap; new dialogs should maintain equivalent semantics.
- Preserve `prefers-reduced-motion: reduce` behavior when adding animations or transitions.
- Use semantic elements and accessible labels already established in the components. Keep external links using `target="_blank"` with `rel="noreferrer"` as the GitHub components do.

## Change workflow

1. Inspect the relevant component, service, and stylesheet before editing.
2. Keep dashboard concerns in dashboard components/services, study-memory concerns in `StudyMemoryWorkspace`, `studyMemoryRuntime.js`, `bridge/`, and `skills/`, and retained academic concerns in `AcademicWorkspace`, `academicRuntime.js`, and `lunaProvider.js`.
3. Add or update focused tests for runtime/data behavior in `src/services/*.test.js` when behavior changes. For bridge changes also run `node --check bridge/server.mjs`.
4. Run `npm test`, `npm run build`, and the relevant bridge syntax check before handing off. If a provider, filesystem API, or browser-only behavior cannot run locally, document that limitation instead of faking a successful result.
5. Review responsive and reduced-motion implications for visual changes. Use `DESIGN.md` as the implementation-derived reference and update it when the documented design system intentionally changes.

Avoid unrelated formatting or dependency churn. Keep the repository’s current line endings and existing code style unless the change requires otherwise.
