# Relay study bridge

This is the optional local companion described in `docs/designs/chatgpt-study-memory-bridge.md`. It owns the real `study-context/` folder; Relay's browser storage is only a compatibility cache and manual fallback.

Run it from the repository with a per-install secret:

```powershell
$env:RELAY_BRIDGE_SECRET = "replace-with-a-long-random-secret"
$env:RELAY_STUDY_ROOT = "C:\Users\alex\Documents\study-context"
npm run bridge
```

For Relay's browser-side authenticated material handoff, expose the same secret to the local dev process as `VITE_STUDY_BRIDGE_SECRET`; never commit it or place it in browser storage.

The companion listens on `127.0.0.1:4112`. `GET /ping` is read-only. Course context is read-only. All proposal, approval, and commit calls require `Authorization: Bearer <secret>`. Proposals never write course files; only an approved, exact-token commit can write an immutable raw session or material, derived records, a manifest entry, and the operation journal. Uploaded files land at `courses/<COURSE>/materials/file-uploaded/<safe filename>`; original filename metadata and a SHA-256 byte hash remain in `materials/manifest.json`.

Material requests accept original UTF-8 or base64 bytes. The default material upload limit is 25 MB and the JSON request limit is 36 MB. Configure `RELAY_BRIDGE_MAX_UPLOAD_MB` and `RELAY_BRIDGE_MAX_BODY_MB` for a different reviewed limit. Oversized or malformed payloads fail before a file is stored. Assignment PDFs that cannot be forwarded from ChatGPT use Relay's `handoff assignment PDF` popup, which asks for and confirms the course code before showing the approval proposal.

The current browser UI still supports manual JSON bundle export/import when a ChatGPT remote MCP tunnel or the bridge is unavailable. Do not expose this process to a public interface without adding an authenticated tunnel and reviewing the path, backup, deletion, and encryption threat model.
