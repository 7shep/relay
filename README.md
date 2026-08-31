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

## Google Calendar setup

The assignments panel can import upcoming Google Calendar events whose titles mention assignment, midterm, exam, quiz, test, project, paper, lab, homework, presentation, or report. Click `connect Google Calendar`, create a Google Cloud Web application OAuth client ID, enable the Google Calendar API, and add the local Vite origin (for example `http://localhost:5173`) to its authorized JavaScript origins. The client ID is stored locally; OAuth access tokens stay in memory and are not persisted.

## Local assistant

The assistant dock targets `qwen2.5:7b` through Ollama at `http://localhost:11434`. It supports text chat and multiple file attachments. Text, Markdown, CSV, and JSON files are included in the request when they are under 200 KB. PDF and office-document extraction is intentionally the next integration step.
