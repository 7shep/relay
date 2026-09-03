# Relay

A local-first personal dashboard and study workspace for planning work, tracking assignments, and building course memory from study sessions.

## Run it

```bash
npm install
npm run dev
```

Relay provides a terminal-style daily dashboard with a live clock and greeting, weather, Qwen-planned focus tasks, upcoming assignments, live GitHub pull requests, responsive layout, and reduced-motion support. Its study-memory workspace connects ChatGPT session exports to source-linked course evidence, assessment questions, learner context, Tutor guidance, and Assignment guidance.

## GitHub setup

The GitHub panel asks for your GitHub username the first time it loads. Public repositories work without a token. Add a read-only GitHub Personal Access Token if you want private repositories or a higher API limit. The browser app stores those values in local storage; a future Tauri version can move the token into the Windows keychain.

## Assignments

The assignments panel uses local Qwen through Ollama to extract assignments, exams, labs, projects, and due dates from syllabus text or text-based PDFs. Click `add syllabus` and select `.txt`, `.md`, `.csv`, `.json`, `.html`, or `.pdf` files. Extracted assignments are normalized and stored in browser local storage so Qwen can use them when drafting the daily focus list. Scanned PDFs without selectable text need OCR before import.

## Local assistant

The assistant dock sends real streaming chat requests to local Ollama at `http://localhost:11434` using `qwen2.5:7b`. Start Ollama and pull that model before chatting. Each request includes the current focus tasks and extracted assignment queue, and the sidebar cycles through live activity labels while the response is generating. Qwen knows about the focus taskbar, assignment queue, GitHub pull-request panel, and weather panel. When a message contains concrete work or asks how to plan or organize the day, Qwen answers normally and automatically captures the concrete work as focus tasks. Explicitly asking to add or create a task is also supported. Qwen fills the task label, project, estimate, due date, description, and timeline before adding it to the list. When every task is complete, the list defaults to an `everything checked off` state; click the done count to reveal completed tasks again.

## Study memory bridge

The `study memory` surface connects ChatGPT study sessions to a local, source-linked course archive. Use the repository skill at [`skills/capture-study-session/SKILL.md`](skills/capture-study-session/SKILL.md) in ChatGPT to produce a schema-versioned JSON bundle, then import it into Relay. Relay shows the raw artifact, destination paths, missing-data warnings, provenance, confidence, and learner-record diff before any save. `approve & save locally` is explicit; duplicate imports, cancellation, and operation status remain visible. A manual bundle download is always available when MCP or the local bridge is unavailable.

For a real student-owned course folder, start the optional companion with a secret: see [`bridge/README.md`](bridge/README.md). Set `VITE_STUDY_BRIDGE_URL=http://127.0.0.1:4112` for the Relay health check. The bridge writes raw sessions and derived records under `study-context/courses/<COURSE>/`, rejects unsafe paths, keeps Graphify refresh optional, and does not expose unauthenticated write endpoints. Existing syllabus uploads continue to use the current local Qwen parser and dashboard assignment storage.

The companion skills are [`skills/tutor/SKILL.md`](skills/tutor/SKILL.md), which loads bounded context at the beginning of each study session and proposes a cross-course profile refresh every three committed sessions, and [`skills/assignment/SKILL.md`](skills/assignment/SKILL.md), which resolves an assignment from the local context folder and guides it against its prompt and rubric.
