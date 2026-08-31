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
