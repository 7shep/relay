# Start

A small local-first personal dashboard MVP.

## Run it

```bash
npm install
npm run dev
```

The first pass is intentionally browser-based and follows the terminal-style dashboard reference. It includes a live clock and greeting, weather, Qwen-planned focus tasks, upcoming assignments, live GitHub pull requests, responsive layout, and reduced-motion support.

## GitHub setup

The GitHub panel asks for your GitHub username the first time it loads. Public repositories work without a token. Add a read-only GitHub Personal Access Token if you want private repositories or a higher API limit. The current browser MVP stores those values in local storage; the Tauri version can move the token into the Windows keychain.

## Assignments

The assignments panel uses local Qwen through Ollama to extract assignments, exams, labs, projects, and due dates from syllabus text or text-based PDFs. Click `add syllabus` and select `.txt`, `.md`, `.csv`, `.json`, `.html`, or `.pdf` files. Extracted assignments are normalized and stored in browser local storage so Qwen can use them when drafting the daily focus list. Scanned PDFs without selectable text need OCR before import.

## Local assistant

The assistant dock sends real streaming chat requests to local Ollama at `http://localhost:11434` using `qwen2.5:7b`. Start Ollama and pull that model before chatting. Each request includes the current focus tasks and extracted assignment queue, and the sidebar cycles through live activity labels while the response is generating. To add focus work, ask the assistant to add or create a task; Qwen fills the task label, project, estimate, due date, description, and timeline before adding it to the list. When every task is complete, the list defaults to an `everything checked off` state; click the done count to reveal completed tasks again.
