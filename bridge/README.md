# Relay study bridge

This is the optional local companion described in `docs/designs/chatgpt-study-memory-bridge.md`. It owns the real `study-context/` Obsidian vault; Relay's browser storage is only a compatibility cache and manual fallback.

Run it from the repository with a per-install secret:

```powershell
$env:RELAY_BRIDGE_SECRET = "replace-with-a-long-random-secret"
$env:RELAY_STUDY_ROOT = "C:\Users\alex\Documents\study-context"
npm run bridge
```

For Relay's browser-side authenticated material handoff, expose the same secret to the local dev process as `VITE_STUDY_BRIDGE_SECRET`; never commit it or place it in browser storage.

The companion listens on `127.0.0.1:4112`. `GET /ping`, `GET /course_context`, and `GET /vault_graph` are read-only. The graph endpoint requires a lowercase `courseId`, optionally accepts `topic`, scans only that course plus the three root learner-profile notes, and returns `nodes`, `edges`, `scope`, and `stats`; it never writes or mutates Markdown. All proposal, approval, and commit calls require `Authorization: Bearer <secret>`. Proposals never write course files; only an approved, exact-token commit can write an immutable raw session, a readable Markdown session note, linked concept/assignment notes, learner-signal notes, or material, plus the operation journal. Uploaded files land at `courses/<COURSE>/materials/file-uploaded/<safe filename>`; original filename metadata and a SHA-256 byte hash remain in `materials/manifest.json`.

Material requests accept original UTF-8 or base64 bytes. The default material upload limit is 25 MB and the JSON request limit is 36 MB. Configure `RELAY_BRIDGE_MAX_UPLOAD_MB` and `RELAY_BRIDGE_MAX_BODY_MB` for a different reviewed limit. Oversized or malformed payloads fail before a file is stored. Assignment PDFs that cannot be forwarded from ChatGPT use Relay's `handoff assignment PDF` popup, which asks for and confirms the course code before showing the approval proposal.

The ChatGPT capture, proposal, and commit runtime remains available to the companion skills and browser compatibility layer; the visible Relay workspace is now a read-only graph. Profile notes are derived hypotheses and refresh after the configured evidence interval; they include evidence, confidence, and a revisit condition. Do not expose this process to a public interface without adding an authenticated tunnel and reviewing the path, backup, deletion, and encryption threat model.
