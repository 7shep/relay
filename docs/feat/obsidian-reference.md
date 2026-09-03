# Obsidian archive and graph reference

Relay uses Obsidian-compatible Markdown as the canonical local evidence surface. The local bridge owns the `study-context/` folder. Relay browser storage is a compatibility cache and manual fallback, not a second source of truth.

## Configuration

| Variable | Used by | Default or shape | Effect |
|---|---|---|---|
| `RELAY_STUDY_ROOT` | bridge | `study-context` | Filesystem root for the canonical vault |
| `RELAY_BRIDGE_SECRET` | bridge | required for writes | Secret used to authorize proposal, approval, and commit requests |
| `VITE_STUDY_BRIDGE_URL` | browser | empty | Empty selects manual/cache fallback; configured value points Relay at the local bridge |
| `VITE_STUDY_BRIDGE_SECRET` | browser | empty | Local-only bearer secret sent to authenticated bridge calls; never expose this app through a public interface |

The documented local bridge address is `127.0.0.1:4112`. Keep the bridge bound to localhost and use a reviewed authenticated tunnel before considering any remote access.

## Canonical folder layout

```text
study-context/
├─ courses/<COURSE>/
│  ├─ index.md
│  ├─ sessions/
│  │  ├─ <DATE>-<TOPIC>-<SESSION>.md
│  │  └─ raw/<SESSION>.txt
│  ├─ concepts/<TOPIC>.md
│  ├─ assignments/<ASSIGNMENT>.md
│  ├─ learner/signals/<SESSION>-<N>.md
│  ├─ materials/
│  │  ├─ file-uploaded/<safe filename>
│  │  ├─ extracted/<artifact>.txt
│  │  └─ manifest.json
│  └─ operations/journal.jsonl
└─ learner/
   ├─ profile.md
   ├─ learning-preferences.md
   └─ recurring-mistakes.md
```

Course folder names are uppercase display codes such as `CS-441`. Course IDs used in bridge requests are lowercase slugs such as `cs-441`.

## Session-note frontmatter

The generated session note contains these fields:

```yaml
type: study-session
course: CS-441
course_id: cs-441
topic: recursion
date: 2026-09-03
session_id: session-001
concepts: [base cases]
strengths: []
struggles: []
successful_repairs: []
learning_preferences: []
recurring_mistakes: []
open_questions: []
confidence: []
adaptation_results: []
assignment: ""
provenance: inferred
```

The note links to the course index, concept notes, an assignment when known, the raw capture, and the three root learner notes. Derived profile entries include status, confidence, evidence references, and a revisit condition.

## Bridge endpoints

| Method | Path | Auth | Side effect |
|---|---|---|---|
| `GET` | `/ping` | none | Reports bridge status, protocol version, storage format, and whether writes require approval |
| `GET` | `/course_context?courseId=<slug>&topic=<optional>` | bearer secret | Read-only bounded course evidence for the selected topic |
| `GET` | `/vault_graph?courseId=<slug>&topic=<optional>` | bearer secret | Read-only course Markdown plus root learner notes graph |
| `POST` | `/propose_save_session` | bearer secret | Creates a save proposal; does not write files |
| `POST` | `/propose_ingest_material` | bearer secret | Creates a material proposal; does not write files |
| `POST` | `/approve_operation` | bearer secret | Issues a short-lived token for one exact proposal |
| `POST` | `/commit_operation` | bearer secret | Consumes the matching token and writes the approved operation |

The bridge rejects invalid course slugs and unsafe paths. It rejects symlink or reparse-point escapes, preserves duplicate operations as visible failures, and never overwrites a duplicate raw artifact.

## Graph response

`GET /vault_graph` returns this shape:

```json
{
  "courseId": "cs-441",
  "topic": "recursion",
  "scope": "course",
  "generatedAt": "2026-09-03T18:30:00.000Z",
  "nodes": [
    {
      "id": "concepts/recursion",
      "label": "recursion",
      "type": "concept",
      "path": "courses/CS-441/concepts/recursion.md",
      "metadata": {
        "course": "CS-441",
        "topic": "recursion",
        "confidence": 0.84,
        "evidenceType": "concept",
        "date": null,
        "sessionId": null,
        "assignment": null,
        "status": null
      }
    },
    {
      "id": "sessions/session-001",
      "label": "recursion",
      "type": "study-session",
      "path": "courses/CS-441/sessions/2026-09-03-recursion-session-001.md",
      "metadata": {
        "course": "CS-441",
        "topic": "recursion",
        "confidence": null,
        "evidenceType": "study-session",
        "date": "2026-09-03",
        "sessionId": "session-001",
        "assignment": null,
        "status": null
      }
    }
  ],
  "edges": [{ "source": "sessions/session-001", "target": "concepts/recursion" }],
  "stats": { "notes": 2, "nodes": 2, "edges": 1 }
}
```

`stats.notes` is the count before topic selection and the visible `stats.nodes` and `stats.edges` values are the returned graph counts. The implementation caps visible nodes at 180.

## Node-type inference

The parser uses frontmatter `type` first. If it is missing, it infers the type from the path:

| Path or frontmatter | Type |
|---|---|
| `type: course` or a course `index.md` | `course` |
| `type: concept` or `/concepts/` | `concept` |
| `type: study-session` or `/sessions/` | `study-session` |
| `type: assignment` or `/assignments/` | `assignment` |
| `type: learner-signal` or `/learner/signals/` | `learner-signal` |
| root `learner/profile.md`, `learning-preferences.md`, or `recurring-mistakes.md` | `learner-profile` |
| no match | `note` |

The visual workspace maps concepts to green circles, sessions and assignments to squares, learner signals to red diamonds, and profile notes to amber circles. It uses fixed radii by type; visual size is not a metric.

## Link parsing and topic scope

The graph parser recognizes wikilinks, including display labels and embedded links. It resolves relative targets and matching basenames, then removes unresolved links from `edges`. A heading fragment does not change the target node.

Without a topic, the bridge reads `courses/<COURSE>/` plus only `learner/profile.md`, `learner/learning-preferences.md`, and `learner/recurring-mistakes.md`. With a topic, the graph keeps matching nodes and up to two rounds of neighboring nodes. The Relay details panel also computes a two-link neighborhood around the selected node.

## Browser fallback

When no bridge endpoint is configured or the request fails, Relay uses `relay.study-memory.v1` in browser storage to build a compatibility graph from cached courses, assignments, sessions, learner claims, and profile evidence. The UI labels this `cache preview`. It is useful for navigation and review, but it cannot prove that the canonical Markdown vault contains the same records.

## Related

- [How to save a study session](session-save.md)
- [How to use the vault graph](obsidian-graph.md)
- [Relay study bridge README](../../bridge/README.md)
- [Study-memory bridge design](../designs/chatgpt-study-memory-bridge.md)
