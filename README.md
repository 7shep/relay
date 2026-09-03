# Relay

A local-first personal dashboard and study workspace for planning work, tracking assignments, and building course memory from study sessions.

## Run it

```bash
npm install
npm run dev
```

Relay provides a terminal-style daily dashboard with a live clock and greeting, weather, Qwen-planned focus tasks, upcoming assignments, live GitHub pull requests, responsive layout, and reduced-motion support. Its vault graph workspace reads a bounded Obsidian course scope and lets you trace concepts through sessions, assignments, and learner evidence without mutating the vault.

## GitHub setup

The GitHub panel asks for your GitHub username the first time it loads. Public repositories work without a token. Add a read-only GitHub Personal Access Token if you want private repositories or a higher API limit. The browser app stores those values in local storage; a future Tauri version can move the token into the Windows keychain.

## Assignments

The assignments panel uses local Qwen through Ollama to extract assignments, exams, labs, projects, and due dates from syllabus text or text-based PDFs. Click `add syllabus` and select `.txt`, `.md`, `.csv`, `.json`, `.html`, or `.pdf` files. Assignments remain usable when the bridge is offline. Qwen also returns source-grounded class-routing evidence; unclear files prompt for a class in the assistant instead of being guessed. A routed source becomes an approval-gated archive proposal, and scanned PDFs without selectable text need OCR before import.

## Local assistant

The assistant dock sends real streaming chat requests to local Ollama at `http://localhost:11434` using `qwen2.5:7b`. Start Ollama and pull that model before chatting. Each request includes the current focus tasks and extracted assignment queue, and the sidebar cycles through live activity labels while the response is generating. Qwen knows about the focus taskbar, assignment queue, GitHub pull-request panel, and weather panel. When a message contains concrete work or asks how to plan or organize the day, Qwen answers normally and automatically captures the concrete work as focus tasks. Explicitly asking to add or create a task is also supported. Qwen fills the task label, project, estimate, due date, description, and timeline before adding it to the list. When every task is complete, the list defaults to an `everything checked off` state; click the done count to reveal completed tasks again.

## Obsidian vault graph

The `vault graph` surface is read-only. It requests `GET /vault_graph?courseId=<slug>&topic=<optional topic>` from the local companion and renders Markdown notes as nodes and `[[wikilinks]]` as edges. Scope is bounded to one course plus the derived root learner-profile notes; a topic keeps a two-hop neighborhood so concepts remain connected to sessions, assignments, mistakes, and learner evidence. Select a node to inspect frontmatter such as `course`, `topic`, `confidence`, and evidence type.

For a real student-owned Obsidian vault, start the optional companion with a secret: see [`bridge/README.md`](bridge/README.md). Set `VITE_STUDY_BRIDGE_URL=http://127.0.0.1:4112` for Relay and `VITE_STUDY_BRIDGE_SECRET` to the same local-only secret for authenticated write handoffs. Committed sessions become readable Markdown notes under `courses/<COURSE>/sessions/`, with linked `concepts/`, `assignments/`, and root `learner/` notes. The original capture remains immutable under `sessions/raw/`; the JSON bundle remains an import-compatible fallback under `study-sessions/<CLASS>/`. The bridge rejects unsafe paths, requires approval for writes, and does not expose unauthenticated write endpoints. When the bridge is unavailable, Relay labels its browser-storage rendering as a compatibility-cache preview rather than presenting it as the canonical vault.

The companion skills are [`skills/tutor/SKILL.md`](skills/tutor/SKILL.md), which loads bounded context at the beginning of each study session and proposes a cross-course profile refresh every three committed sessions, and [`skills/assignment/SKILL.md`](skills/assignment/SKILL.md), which resolves an assignment from the local context folder and guides it against its prompt and rubric.
