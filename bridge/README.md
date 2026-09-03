# Relay study bridge

This is the optional local companion described in `docs/designs/chatgpt-study-memory-bridge.md`. It owns the real `study-context/` folder; Relay's browser storage is only a compatibility cache and manual fallback.

Run it from the repository with a per-install secret:

```powershell
$env:RELAY_BRIDGE_SECRET = "replace-with-a-long-random-secret"
$env:RELAY_STUDY_ROOT = "C:\Users\alex\Documents\study-context"
npm run bridge
```

The companion listens on `127.0.0.1:4112`. `GET /ping` is read-only. Course context is read-only. All proposal, approval, and commit calls require `Authorization: Bearer <secret>`. Proposals never write course files; only an approved, exact-token commit can write an immutable raw session, its derived summary/signals, and the operation journal. Graph refresh is recorded as pending and does not block an evidence save.

The current browser UI still supports manual JSON bundle export/import when a ChatGPT remote MCP tunnel or the bridge is unavailable. Do not expose this process to a public interface without adding an authenticated tunnel and reviewing the path, backup, deletion, and encryption threat model.
