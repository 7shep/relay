# Relay design system

<!-- GENERATED:overview source=/document updated=2026-09-02 -->

## Overview

Relay is a local-first React/Vite personal dashboard with a terminal-style daily focus surface, weather and assignment panels, GitHub pull-request visibility, a local Qwen assistant dock, and a separate academic workspace for Assignment and Tutor skills. This document describes the implementation in `src/App.jsx`, `src/components/`, `src/services/`, `src/constants/`, and the imported styles under `src/styles/`, with product context from `docs/designs/agent-workspace.md` and `docs/designs/chatgpt-study-memory-bridge.md`. It was generated on 2026-09-02. No Design Plan v2 or selected art direction was found; the available design notes are product briefs rather than selected visual directions.
<!-- /GENERATED:overview -->

<!-- GENERATED:typography source=/document updated=2026-09-02 -->

## Typography

| Role | Declaration | Evidence |
| --- | --- | --- |
| Global/dashboard body and UI | `"JetBrains Mono", "Cascadia Mono", Consolas, monospace` | `src/styles/dashboard.css:1-6`; the academic surface repeats the same stack in `src/styles/academic.css:18`. |
| Dashboard display heading | `clamp(28px, 3.1vw, 42px)`, weight `500`, line-height `1`, letter-spacing `-0.08em` | `src/styles/dashboard.css:96-105`. |
| Dashboard compact metadata and panel chrome | `11px` for shared metadata/table text; panel and control-specific sizes range from `8px` to `13px` | `src/styles/dashboard.css:77-83`; `src/styles/panels.css:34-49`, `src/styles/panels.css:153-177`. |
| Weather display value | `27px`, weight `400`, line-height `1`, letter-spacing `-0.06em` | `src/styles/panels.css:216-227`. |
| Task modal heading | `clamp(20px, 4vw, 29px)`, weight `400`, line-height `1.15`, letter-spacing `-0.06em` | `src/styles/modal.css:53-61`. |
| Academic page display heading | `Georgia, serif`, `clamp(27px, 3vw, 40px)`, weight `400`, line-height `1`, letter-spacing `-.045em` | `src/styles/academic.css:98-102`. |
| Academic context headings | `Georgia, serif`; context pane heading `19px`, assignment heading `20px` with line-height `1.05` | `src/styles/academic.css:160-165`. |
| Academic assistant message body | `12px`, line-height `1.7`; user message `11px`, line-height `1.55`; composer `11px`, line-height `1.5` | `src/styles/academic.css:129-149`. |
| Weight usage | Most UI text is `400`; dashboard heading uses `500`; rendered academic markdown emphasis uses `600` | `src/styles/dashboard.css:101-104`; `src/styles/academic.css:130`. |

No `@font-face` declaration or web-font import was found. The rendered font therefore depends on the host having the preferred mono font installed, with the listed fallbacks.
<!-- /GENERATED:typography -->

<!-- GENERATED:color source=/document updated=2026-09-02 -->

## Color

### Dashboard tokens

| Token | Value | Definition | Use |
| --- | --- | --- | --- |
| `--term-bg` | `#070a0b` | `src/styles/dashboard.css:7` | Page and app background. |
| `--term-panel` | `#0b1011` | `src/styles/dashboard.css:8` | Panel and weather-summary surface. |
| `--term-raised` | `#101718` | `src/styles/dashboard.css:9` | Hover and raised interactive surface. |
| `--term-border` | `#263134` | `src/styles/dashboard.css:10` | Primary dividers and borders. |
| `--term-border-soft` | `#1b2527` | `src/styles/dashboard.css:11` | Softer nested dividers. |
| `--term-text` | `#d2ddd5` | `src/styles/dashboard.css:12` | Primary text. |
| `--term-muted` | `#64736c` | `src/styles/dashboard.css:13` | Secondary text and metadata. |
| `--term-accent` | `#38e681` | `src/styles/dashboard.css:14` | Primary green accent, focus outline, progress, active states. |
| `--term-accent-dim` | `#113426` | `src/styles/dashboard.css:15` | Accent-tinted surfaces. |
| `--term-accent-line` | `#1e9d59` | `src/styles/dashboard.css:16` | Accent borders and forecast bars. |
| `--term-warn` | `#e6bd3f` | `src/styles/dashboard.css:17` | Planning/loading and approaching-due status. |
| `--term-danger` | `#ef665d` | `src/styles/dashboard.css:18` | Offline/error and urgent assignment status. |

### Academic workspace tokens

| Token | Value | Definition | Use |
| --- | --- | --- | --- |
| `--academic-bg` | `#080c0d` | `src/styles/academic.css:2` | Workspace background. |
| `--academic-panel` | `#0d1415` | `src/styles/academic.css:3` | Declared panel surface. |
| `--academic-panel-raised` | `#111b1c` | `src/styles/academic.css:4` | Rail item hover/active surface. |
| `--academic-border` | `#263638` | `src/styles/academic.css:5` | Structural borders. |
| `--academic-border-soft` | `#1a292a` | `src/styles/academic.css:6` | Softer section dividers. |
| `--academic-text` | `#d9e5dc` | `src/styles/academic.css:7` | Primary workspace text. |
| `--academic-muted` | `#718279` | `src/styles/academic.css:8` | Secondary text. |
| `--academic-dim` | `#50625a` | `src/styles/academic.css:9` | Low-emphasis labels and metadata. |
| `--academic-green` | `#45e38b` | `src/styles/academic.css:10` | Primary academic accent, active skill, provider-ready state. |
| `--academic-green-dim` | `#103521` | `src/styles/academic.css:11` | Accent-tinted controls and surfaces. |
| `--academic-amber` | `#e2bd58` | `src/styles/academic.css:12` | Tutor/provider-not-configured distinction. |

Ad hoc literals are also part of the current implementation signal: academic surfaces use `#0a1011`, `#0b1112`, `#111b1a`, `#a7b7ad`, `#aebdb3`, `#45582e`, `#b8c994`, `#141a10`, `#b8c8bd`, `#ecf3ed`, `#344642`, `#d2ded5`, `#172020`, `#334443`, `#0e1718`, `#d6e3d9`, `#1f3030`, and `#b8c7bc` in `src/styles/academic.css:39-191`. Dashboard action/error styles additionally use `#46534d` and `#16432e` in `src/styles/panels.css:746-756` and `#16432e` in `src/styles/modal.css:145`; the modal backdrop and shadow use `rgb(0 0 0 / 0.78)` and `rgb(0 0 0 / 0.5)` in `src/styles/modal.css:8-16`.

No contrast calculations were performed in this documentation pass. No separate academic danger token or formal success/error token set was found.
<!-- /GENERATED:color -->

<!-- GENERATED:spacing source=/document updated=2026-09-02 -->

## Spacing

No named spacing scale, base unit, or spacing multiplier tokens were found. Spacing is implemented as repeated literal pixel values.

- Dashboard frame: `padding: 32px 30px 28px`; it changes to `25px 20px` at `850px` and `20px 12px` at `560px` (`src/styles/dashboard.css:55-58`; `src/styles/responsive.css:6-7`, `src/styles/responsive.css:47-48`).
- Dashboard grid and stacked panels: `16px` gaps; the focus list uses `12px 10px` task padding and the panel header uses `6px 10px` (`src/styles/panels.css:2-4`, `src/styles/panels.css:24-27`, `src/styles/panels.css:34-39`, `src/styles/panels.css:124-129`).
- Academic workspace desktop gutters: `34px` around the page header, skill switcher, notices, and chat surface; the chat surface uses `margin: 16px 34px 28px` (`src/styles/academic.css:99`, `src/styles/academic.css:106`, `src/styles/academic.css:115`, `src/styles/academic.css:119`).
- Common academic internal spacing includes `7px`, `8px`, `9px`, `10px`, `11px`, `12px`, `14px`, `16px`, `17px`, `22px`, `23px`, `25px`, and `34px` gaps, margins, and paddings (`src/styles/academic.css:54-191`).
- Borders are generally `1px`; progress tracks are `3px` or `5px`, and icon/status dots are typically `3px` to `7px` (`src/styles/panels.css:99-105`, `src/styles/academic.css:167-169`, `src/components/Icons.jsx:1-18`).

The system favors dividers and whitespace around groups, but it does not currently encode a reusable spacing contract.
<!-- /GENERATED:spacing -->

<!-- GENERATED:components source=/document updated=2026-09-02 -->

## Components

| Component | Purpose and appearance-relevant surface | Source |
| --- | --- | --- |
| `App` | Root routing between the dashboard and academic workspace; owns task, assignment, weather, and modal state. | `src/App.jsx:7-218`. |
| `DashboardHeader` | Terminal command line, greeting, live clock/task count, academic workspace launcher, and weather summary. | `src/components/DashboardHeader.jsx:4-14`. |
| `Panel` | Shared bordered terminal panel shell with path header, optional metadata, primary accent state, class name, and stagger index. | `src/components/Panel.jsx:1-8`. |
| `FocusTasks` | Primary task list with progress, done filter, next-task accent, completion state, and task modal entry. | `src/components/FocusTasks.jsx:4-25`. |
| `WeatherPanel` | Current temperature/details plus six-hour forecast bars. | `src/components/WeatherPanel.jsx:4-13`. |
| `AssignmentsPanel` | Syllabus-derived assignment timeline, urgency colors, add/clear actions, and empty/error/import states; includes `SyllabusImportButton`. | `src/components/AssignmentsPanel.jsx:5-35`. |
| `PullRequestsPanel` | GitHub setup, sync/error states, open-PR rows, hide controls, and repository summary; includes `GitHubSetup`, `GitHubDataView`, `GitHubPRRow`, and `GitHubRepositorySummary`. | `src/components/PullRequestsPanel.jsx:7-75`. |
| `ChatBar` | Collapsible Qwen assistant dock with streaming messages, thinking disclosure, activity state, task capture, stop, reset, and suggested prompts. | `src/components/ChatBar.jsx:24-154`. |
| `TaskModal` | Focus-task detail/edit dialog with Escape close, focus trap, timeline editor, and complete/reopen action. | `src/components/TaskModal.jsx:4-88`. |
| `AcademicWorkspace` | Academic shell with course/assignment rail, Assignment/Tutor skill tabs, chat surface, context pane, artifacts, handoffs, and learner signals. | `src/components/AcademicWorkspace.jsx:7-218`. |
| `AssistantMarkdown` | Small renderer for assistant paragraphs, bold spans, inline code, blockquotes, numbered lists, and bullets. | `src/components/AssistantMarkdown.jsx:3-16`. |
| `Icon` | Project-owned inline SVG icon set using `currentColor`; supports weather, task, GitHub, assistant, navigation, and composer icons. | `src/components/Icons.jsx:3-18`, `src/components/Icons.jsx:20-21`. |

No external component library is used. Appearance is primarily controlled by CSS classes and the two token groups described in the color section.
<!-- /GENERATED:components -->

<!-- GENERATED:layout source=/document updated=2026-09-02 -->

## Layout

### Terminal dashboard

- `.terminal-app` is a full-height two-column grid: main content plus an assistant dock constrained to `minmax(266px, 350px)`. When the dock is collapsed, the second column becomes `48px` (`src/styles/dashboard.css:46-52`).
- `.dashboard-frame` is centered at `width: min(100%, 1440px)` with a desktop gutter/padding of `32px 30px 28px` (`src/styles/dashboard.css:55-58`).
- `.dashboard-grid` is a 12-column grid with a `16px` gap. The focus panel spans 7 columns, the weather/assignments `.side-stack` spans 5 columns and has two rows, and the pull-request panel spans all 12 columns (`src/styles/panels.css:1-31`).
- Header and toolbar composition uses flex alignment; lists and data surfaces use compact rows, dividers, and overflow ellipsis. GitHub content has horizontal overflow for its table and a `480px` vertical scroll region (`src/styles/panels.css:417-420`, `src/styles/panels.css:536-536`).

### Academic workspace

- `.academic-layout` is a three-column grid: `230px` workspace rail, `minmax(440px, 1fr)` chat canvas, and `278px` context pane (`src/styles/academic.css:52-53`).
- The rail is a vertical flex column with courses, assignments, recent runs, and a footer. The center is a vertical flex column containing the page header, two-column skill switcher, optional notice, chat surface, messages, suggestions, and composer (`src/styles/academic.css:53-54`, `src/styles/academic.css:98-151`).
- The context pane is a vertical flex column with assignment, sources, learner memory, and a bottom-aligned handoff footer (`src/styles/academic.css:157-189`).
- The task modal is a centered overlay with a max width of `560px`, scrollable content, and a dark backdrop (`src/styles/modal.css:1-18`).

No universal max-width or shared layout primitive connects the two surfaces beyond the common CSS import and token conventions.
<!-- /GENERATED:layout -->

<!-- GENERATED:motion source=/document updated=2026-09-02 -->

## Motion

| Element/state | Trigger | Timing/technique | Evidence |
| --- | --- | --- | --- |
| Terminal panels | Initial render | CSS `opacity` animation `panel-in`, `340ms`, `cubic-bezier(0.23, 1, 0.32, 1)`, with a per-panel delay of `index * 45ms` capped by the `Panel` component's index expression | `src/styles/panels.css:6-16`; `src/components/Panel.jsx:1-4`. |
| Focus progress bar | Task completion/state update | CSS width transition `220ms ease` | `src/styles/panels.css:99-105`. |
| Focus task hover/focus | Pointer or keyboard focus | Background transition `150ms ease`; task-open icon transitions color, opacity, and `translate(1px, -1px)` over `150ms ease` | `src/styles/panels.css:124-134`, `src/styles/panels.css:190-201`. |
| Dashboard caret and assistant prompt mark | Continuous status/terminal decoration | `blink` keyframes, `1.05s steps(1) infinite` | `src/styles/dashboard.css:124-130`; `src/styles/assistant.css:291-303`. |
| Loader icon | GitHub loading state | `icon-spin`, `900ms linear infinite` | `src/styles/icons.css:27-43`; `src/components/PullRequestsPanel.jsx:43`. |
| Academic typing dots | Academic assistant message is empty/streaming | `academic-typing`, `1s steps(1) infinite`, with `.15s` and `.3s` delays on dots 2 and 3 | `src/styles/academic.css:133-137`; `src/components/AcademicWorkspace.jsx:204`. |

The JavaScript layer also updates the dashboard clock every second and rotates Qwen activity labels every `1400ms`; these are state updates rather than CSS motion (`src/App.jsx:31-34`; `src/components/ChatBar.jsx:81-84`). No animation library was found.
<!-- /GENERATED:motion -->

<!-- GENERATED:responsive source=/document updated=2026-09-02 -->

## Responsive

| Breakpoint | Surface and changes | Evidence |
| --- | --- | --- |
| `max-width: 1120px` | Academic layout drops the context pane below the center column; the rail narrows from `230px` to `208px`; context borders change from left to top. | `src/styles/academic.css:195-202`. |
| `max-width: 850px` | Dashboard becomes a block layout; frame padding becomes `25px 20px`; header stacks; dashboard panels become one column; side stack becomes two equal columns; assistant dock becomes in-flow with a top border and messages capped at `245px`. | `src/styles/responsive.css:1-43`. |
| `max-width: 760px` | Academic top bar stacks; layout becomes block; rail sections become horizontal scrolling course/assignment lists; recent runs/footer hide; center header stacks; context pane hides; chat margins/gutters shrink. | `src/styles/academic.css:204-227`. |
| `max-width: 560px` | Dashboard frame becomes `20px 12px`; heading is `26px`; side stack becomes one column; GitHub fields stack; PR metadata hides; modal padding shrinks. | `src/styles/responsive.css:45-92`. |
| `max-width: 450px` | Academic provider state hides, heading is `31px`, skill icons/buttons shrink, message gap reduces to `18px`, and academic message text becomes `11px`. | `src/styles/academic.css:229-237`. |

The dashboard and academic surfaces have explicit responsive handling. No additional breakpoint configuration file or container-query usage was found.
<!-- /GENERATED:responsive -->

<!-- GENERATED:motion-reduced source=/document updated=2026-09-02 -->

## Reduced motion

The dashboard has a global `@media (prefers-reduced-motion: reduce)` rule that reduces all animation and transition durations to `0.01ms` and limits animation iteration to one (`src/styles/responsive.css:94-101`). The icon stylesheet separately disables `icon-spin` under the same preference (`src/styles/icons.css:48-52`). This covers the shared dashboard/academic stylesheet import, including panel entry, caret, assistant/academic typing, hover transitions, and loader motion.
<!-- /GENERATED:motion-reduced -->

<!-- GENERATED:implementation-guidance source=/document updated=2026-09-02 -->

## Implementation guidance

- Reuse the existing `Panel` shell for dashboard panels and `Icon` for project-owned SVG symbols. Keep appearance in the imported CSS files and use the existing `--term-*` or `--academic-*` custom properties rather than introducing one-off theme values (`src/components/Panel.jsx:1-8`, `src/components/Icons.jsx:3-21`, `src/styles/dashboard.css:7-18`, `src/styles/academic.css:1-12`).
- Preserve the established visual language: near-black surfaces, thin `1px` dividers, mono utility text, green as the primary action/state color, amber for caution/tutor distinction, and red for dashboard danger/error. Keep ad hoc literals consolidated if extending an existing token role.
- Keep dashboard and academic responsibilities separate. Qwen/Ollama powers planning, syllabus extraction, and the operational assistant; the academic workspace uses the Luna provider adapter and must not silently create focus tasks (`src/services/qwen.js:1-20`, `src/services/lunaProvider.js:1-13`, `docs/designs/agent-workspace.md:17-22`).
- Keep provider access behind adapters. The browser calls local Ollama at `http://localhost:11434/api/chat`; Luna requests go to a configured local companion bridge via `VITE_LUNA_BRIDGE_URL`, and the Luna implementation explicitly keeps credentials out of `localStorage` (`src/constants/config.js:1-2`, `src/services/lunaProvider.js:1-13`).
- Persist only through the existing storage helpers and preserve their graceful fallbacks. Focus state, assignments, GitHub configuration, and the academic workspace each have named local-storage keys and read/write helpers (`src/utils/storage.js:1-86`, `src/services/academicRuntime.js:1-80`).
- Use semantic React elements and CSS custom properties. This aligns with the available website design rules: make the first viewport communicate hierarchy and purpose, vary composition while preserving one visual system, use typography compositionally, prefer dividers/whitespace to wrapping every group in a card, prefer transform/opacity for motion, and respect reduced motion (`mcp__universal__get_design_rules`, category `website`, retrieved 2026-09-02).
- Keep the responsive contracts at `1120px`, `850px`, `760px`, `560px`, and `450px` intact unless the changed surface is tested at the affected widths. Do not add a component library; the design rules explicitly constrain implementation to semantic React components, CSS custom properties, static functionality unless requested, and no component library.
<!-- /GENERATED:implementation-guidance -->

<!-- GENERATED:open-questions source=/document updated=2026-09-02 -->

## Open questions

No Design Plan v2 or selected art direction was found in the conversation or repository; the available office-hours notes are product briefs rather than selected visual directions.

No named spacing scale or base spacing unit was found in the implementation.

No bundled font file or font import was found, so the runtime availability of JetBrains Mono is host-dependent.

No contrast calculations were performed, and the implementation does not declare a formal academic danger/success token set.

The visual result was not screenshot-tested in this documentation pass; this document records declared implementation values rather than rendered evidence.
<!-- /GENERATED:open-questions -->
