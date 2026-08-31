# Start

A small local-first personal dashboard MVP.

## Run it

```bash
npm install
npm run dev
```

The first pass is intentionally browser-based and follows the terminal-style dashboard reference. It includes a live clock and greeting, weather, focus tasks with progress and quick add, upcoming assignments, live GitHub pull requests, responsive layout, and reduced-motion support.

## GitHub setup

The GitHub panel asks for your GitHub username the first time it loads. Public repositories work without a token. Add a read-only GitHub Personal Access Token if you want private repositories or a higher API limit. The current browser MVP stores those values in local storage; the Tauri version can move the token into the Windows keychain.

## Assignments

The assignments panel uses local Qwen through Ollama to extract assignments, exams, labs, projects, and due dates from syllabus text. Click `add syllabus` and select `.txt`, `.md`, `.csv`, `.json`, or `.html` files up to 500 KB each. Extracted assignments are normalized and stored in browser local storage so Qwen can use them when drafting the daily focus list.

## Local assistant

The assistant dock targets `qwen2.5:7b` through Ollama at `http://localhost:11434`. It supports text chat and multiple file attachments. Text, Markdown, CSV, and JSON files are included in the request when they are under 200 KB. PDF and office-document extraction is intentionally the next integration step.
