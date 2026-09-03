# AGENTS.md

## Project overview

Relay is a single local-first React/Vite application. The default surface is a terminal-style personal dashboard for focus tasks, weather, assignments, GitHub pull requests, and a Qwen assistant. `App` can switch into a separate academic workspace for Assignment and Tutor conversations backed by a durable local workspace fixture.

Read these documents before making broad product or visual changes:

- `README.md` — user-facing setup and provider requirements.
- `DESIGN.md` — implementation-derived typography, color, spacing, components, layout, motion, and responsive guidance.
- `docs/designs/agent-workspace.md` — the academic workspace product brief and trust boundaries.
- `docs/designs/chatgpt-study-memory-bridge.md` — an alternate product brief for a future ChatGPT-to-local-memory bridge; treat it as planning context, not current implementation behavior.

## Commands

```bash
npm install
npm run dev
npm run build
npm test
npm run preview
```

`npm test` runs Vitest in run mode. The focused runtime coverage is in `src/services/academicRuntime.test.js`.

## Source map

- `src/main.jsx` mounts the app and imports `src/styles/index.css`.
- `src/App.jsx` owns top-level dashboard/workspace routing, focus-task state, assignment import, modal state, and service orchestration.
- `src/components/` contains the dashboard panels, assistant docks, academic workspace, modal, markdown renderer, shared panel shell, and project-owned icon set.
- `src/styles/` contains the imported CSS surfaces. `index.css` imports dashboard, panels, assistant, modal, responsive, and academic styles.
- `src/services/` contains network/provider adapters: local Qwen/Ollama, Luna bridge, weather/Open-Meteo, GitHub, syllabus/PDF extraction, and academic runtime records.
- `src/utils/` contains local-storage helpers, date/formatting helpers, and JSON extraction.
- `src/constants/` contains provider URLs/models, seeded task/weather data, and prompts.

## Data and provider boundaries

- Focus state, assignments, GitHub configuration, and the academic workspace are persisted in browser storage through `src/utils/storage.js` and `src/services/academicRuntime.js`. Preserve the existing keys and defensive fallbacks when changing persistence.
- Qwen uses Ollama at `http://localhost:11434/api/chat` with model `qwen2.5:7b`. It handles operational planning, task capture, and syllabus extraction.
- The academic provider is Luna 5.6 through `VITE_LUNA_BRIDGE_URL`. The browser talks to the local companion bridge; do not put Luna/Codex credentials in browser storage.
- GitHub credentials are currently stored in local storage by the MVP. Treat this as sensitive and do not expand token exposure; the README identifies Windows keychain storage as a future Tauri improvement.
- Academic artifacts, runs, handoffs, signals, and learner-profile changes must remain visible and explainable. The workspace must not silently overwrite a draft, submit academic work, or create dashboard tasks.
- External requests must accept/propagate `AbortSignal` where the surrounding adapter already does so, and UI loading/error states must not be presented as successful provider runs.

## UI conventions

- Reuse `Panel` for terminal dashboard panels and `Icon` for symbols. Do not add a UI component library without an explicit product decision.
- Use the existing CSS custom-property systems: `--term-*` for the dashboard and `--academic-*` for the school workspace. Keep new appearance values tokenized when they represent a reusable role.
- Preserve the visual language: dark surfaces, thin borders/dividers, JetBrains Mono fallbacks for utility text, green primary accents, amber caution/tutor states, and red dashboard danger states.
- Keep the existing responsive breakpoints in scope: dashboard `850px`/`560px`; academic `1120px`/`760px`/`450px`.
- Preserve keyboard behavior and visible focus styles. The task modal has Escape handling and a focus trap; new dialogs should maintain equivalent semantics.
- Preserve `prefers-reduced-motion: reduce` behavior when adding animations or transitions.
- Use semantic elements and accessible labels already established in the components. Keep external links using `target="_blank"` with `rel="noreferrer"` as the GitHub components do.

## Change workflow

1. Inspect the relevant component, service, and stylesheet before editing.
2. Keep dashboard concerns in the dashboard components/services and academic concerns in `AcademicWorkspace`, `academicRuntime.js`, and `lunaProvider.js`.
3. Add or update focused tests for runtime/data behavior in `src/services/*.test.js` when behavior changes.
4. Run `npm test` and `npm run build` before handing off. If a provider or browser-only behavior cannot run locally, document that limitation instead of faking a successful result.
5. Review responsive and reduced-motion implications for visual changes. Use `DESIGN.md` as the implementation-derived reference and update it when the documented design system intentionally changes.

Avoid unrelated formatting or dependency churn. Keep the repository’s current line endings and existing code style unless the change requires otherwise.
