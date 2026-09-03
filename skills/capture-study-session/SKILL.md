# capture-study-session

Use this skill explicitly at the end of a study conversation, for example: `capture this study session for CS-441`.

ChatGPT remains the study surface. This skill is only a session compiler: it creates a proposal bundle for Relay and must never claim that a course folder, learner record, or Graphify was updated without a committed bridge response.

## Procedure

1. Identify the requested course and session date. Ask for either when missing; course IDs are lowercase slugs such as `cs-441`.
2. Summarize only the active conversation and supplied course context. Do not infer an answer key, score, weakness, or future test topic that the evidence does not support.
3. Separate concepts covered, strengths, struggles, successful repairs, question types, test signals, and unresolved questions.
4. Add exact message or artifact references whenever available. If a reference is unavailable, leave it absent and add a missing-data warning.
5. Give each observation a provenance kind: `user_provided`, `extracted`, `inferred`, `estimated`, or `unresolved`. Include confidence and a short rationale when confidence is meaningful.
6. Show the raw-session destination, derived learner-record diff, confidence, and missing-data warnings before proposing a save.
7. If the authenticated Relay bridge is available, call `propose_save_session` with this exact bundle. A proposal is not a write.
8. Only describe the session as saved after Relay returns a committed operation. ChatGPT cannot call `commit_operation` for the MVP.
9. If the bridge is unavailable or the user declines, write/provide this same bundle as a manual-import JSON package in the repository root's class folder under `study-sessions/`.

## Output file

The JSON file must be saved at `study-sessions/CLASS/CLASS-session-DATE.json`. Create one uppercase class-code folder for every course, for example `study-sessions/CISC202/CISC202-session-2026-09-02.json`. Use the date supplied for the session; replace `/` or `\\` with `-` in the filename because path separators are not valid filename characters. Keep the original date in the JSON field used by the bundle schema; only the filesystem path is normalized.

## Output contract

Return valid JSON with no additional top-level fields unless a bridge explicitly accepts them:

```json
{
  "schemaVersion": 1,
  "sessionId": "session-2026-09-02-001",
  "courseId": "cs-441",
  "sessionDate": "2026-09-02",
  "rawSession": { "format": "chat-export", "content": "..." },
  "conceptsCovered": [],
  "strengthsObserved": [],
  "strugglesObserved": [],
  "successfulRepairs": [],
  "questionTypes": [],
  "testSignals": [],
  "openQuestions": [],
  "evidenceRefs": [],
  "provenance": "inferred",
  "confidence": []
}
```

Use strings for simple observations, or objects when evidence needs detail:

```json
{ "text": "Needed two hints before explaining the null hypothesis.", "sourceRef": "message:14", "provenance": "inferred", "confidence": 0.78, "confidenceRationale": "Observed in one answer and one repair." }
```

An incomplete export is still useful when it is honest. Preserve the raw content, keep unsupported fields empty, and add an unresolved question or warning instead of filling gaps. Never edit skill files, overwrite course material, silently capture every message, or create dashboard tasks.
