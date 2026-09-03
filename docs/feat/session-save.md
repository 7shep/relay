# How to save a study session

Use the `capture-study-session` skill at the end of a study conversation. It turns the active conversation into a source-linked bundle, shows what it proposes to save, and only treats the session as saved after a committed operation.

## Prerequisites

- Finish or pause a study conversation in ChatGPT.
- Know the course. Use a lowercase course ID such as `cs-441`.
- Know the session date, or be ready to provide it when the skill asks.
- For canonical vault writes, have the authenticated Relay bridge running. Manual export remains available when the bridge is unavailable.

## Save from ChatGPT

1. Invoke the skill explicitly at the end of the conversation:

   ```text
   capture this study session for CS-441
   ```

2. Provide the course ID and session date if the skill asks for either. The bridge accepts lowercase slugs such as `cs-441`; display labels such as `CS-441` are presentation text.

3. Review the summary. It should separate concepts covered, strengths, struggles, successful repairs, learning preferences, recurring mistakes, adaptation results, question types, test signals, and unresolved questions. It must summarize only the active conversation and supplied course context. It must not invent an answer key, score, weakness, or future test topic.

4. Review the save preview before approving anything. The preview must show:

   - The immutable raw-capture destination.
   - The readable Obsidian session-note destination.
   - The proposed learner-record diff.
   - Evidence references, provenance, confidence, and rationale when available.
   - Missing-data warnings.

5. If the bridge is available, allow the skill to call `propose_save_session`. This creates a `proposed` operation only. It does not write course files.

6. Approve the exact proposal in Relay's trusted local approval path. The commit is bound to the operation ID, course, raw-content hash, destination paths, and diff. An approval token is short-lived and single-use.

7. Treat the session as saved only when the bridge returns a committed operation. A proposal, a generated Markdown note, or a downloaded JSON file is not proof that the canonical vault changed.

## Manual fallback

If the bridge is unavailable or you decline the proposal, keep both outputs:

- An Obsidian-compatible Markdown note at `courses/CLASS/sessions/DATE-TOPIC-SESSION.md`.
- The same JSON bundle for import at `study-sessions/CLASS/CLASS-session-DATE.json`.

The original conversation must remain separately available as `courses/CLASS/sessions/raw/SESSION.txt`. When saving on Windows, replace `/` or `\` in the date used for a filename with `-`; keep the original session date inside the JSON and Markdown data.

The manual export is an honest fallback. Confirm the filesystem export or later import before saying that the vault or learner profile was updated.

## Bundle contract

The output is JSON with no extra top-level fields unless a bridge explicitly accepts them. The required shape is versioned:

| Field | Type or value | Requirement |
|---|---|---|
| `schemaVersion` | number | Must be `1` |
| `sessionId` | non-empty string | Stable identifier for this capture |
| `courseId` | lowercase slug | Example: `cs-441` |
| `sessionDate` | string | Use the requested date |
| `topic` | string | Topic covered, if known |
| `assignment` | string | Assignment title, if relevant |
| `rawSession` | object | `format` plus non-empty `content`; preserve the raw export |
| `conceptsCovered` | array | Concepts supported by the conversation |
| `strengthsObserved` | array | Evidence-backed strengths only |
| `strugglesObserved` | array | Observed difficulties, not fixed ability labels |
| `successfulRepairs` | array | Corrections that the learner demonstrated |
| `learningPreferencesObserved` | array | Testable teaching hypotheses |
| `recurringMistakesObserved` | array | Repeated or explicitly observed mistakes |
| `adaptationResults` | array | Results from trying an adjustment or re-test |
| `questionTypes` | array | Question forms observed |
| `testSignals` | array | Supported practice or assessment signals |
| `openQuestions` | array | Unresolved uncertainty |
| `evidenceRefs` | array | Message or artifact references when available |
| `provenance` | string | `user_provided`, `extracted`, `inferred`, `estimated`, or `unresolved` |
| `confidence` | array | Confidence values and rationales when meaningful |

An observation can be a string or an object with `text`, `sourceRef`, `provenance`, `confidence`, and `confidenceRationale`. If evidence is missing, leave the field empty and add a warning or unresolved question.

## What gets written after commit

For course `CS-441` and session `session-001`, a normal committed save can create:

```text
study-context/
├─ courses/CS-441/
│  ├─ index.md
│  ├─ sessions/
│  │  ├─ 2026-09-03-recursion-session-001.md
│  │  └─ raw/session-001.txt
│  ├─ concepts/<topic>.md
│  ├─ assignments/<assignment>.md
│  ├─ learner/signals/session-001-1.md
│  └─ operations/journal.jsonl
└─ learner/
   ├─ profile.md
   ├─ learning-preferences.md
   └─ recurring-mistakes.md
```

Concept, assignment, signal, and profile files are derived from the raw artifact. Every learner claim keeps evidence, provenance, confidence, and a revisit condition. The original raw capture is immutable and is never overwritten by a duplicate import.

After every third committed session, a learner-profile refresh becomes due. It remains a derived, reviewable hypothesis update; it is not an automatic permanent label.

## Verification

Start the bridge with a local-only secret:

```powershell
$env:RELAY_BRIDGE_SECRET = "replace-with-a-long-random-secret"
$env:RELAY_STUDY_ROOT = "C:\Users\alex\Documents\study-context"
npm run bridge
```

In another terminal, verify the read-only health endpoint:

```powershell
(Invoke-WebRequest http://127.0.0.1:4112/ping).Content
```

A ready response identifies `obsidian-markdown` storage and says writes require approval. After a committed save, request the graph from Relay. A direct `GET /vault_graph?courseId=cs-441` call also works when it includes the bridge's `Authorization: Bearer <secret>` header; confirm that the returned note paths include the committed session note.

## Troubleshooting

### The skill produced a bundle but says nothing was saved

That is the correct state for a proposal or manual fallback. Confirm a filesystem export or complete the approval and commit flow before claiming a vault update.

### Validation rejects the bundle

Check `schemaVersion: 1`, a lowercase `courseId`, non-empty `rawSession.content`, and arrays for every observation field. Unknown courses are rejected by the bridge.

### The profile changed after a save

Profile notes refresh on the third committed session. Inspect the proposal diff and the profile evidence before accepting a hypothesis as useful.

### A duplicate save fails

The bridge compares the raw content hash within the course. It keeps the duplicate operation visible and does not overwrite the original artifact.

## Related

- [Obsidian archive and graph reference](obsidian-reference.md)
- [How to use the vault graph](obsidian-graph.md)
- [The capture skill contract](../../skills/capture-study-session/SKILL.md)
