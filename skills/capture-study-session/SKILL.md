---
name: capture-study-session
description: Compile the current study conversation into a source-linked session proposal or honest manual-import bundle for Relay without claiming an uncommitted save.
---

# capture-study-session

Use this skill explicitly at the end of a study conversation, for example: `capture this study session for CS-441`.

ChatGPT remains the study surface. This skill is only a session compiler: it creates a proposal bundle for Relay and must never claim that an Obsidian vault, course note, or learner profile was updated without a committed bridge response.

## Procedure

1. Identify the requested course and session date. Ask for either when missing; course IDs are lowercase slugs such as `cs-441`.
2. Summarize only the active conversation and supplied course context. Do not infer an answer key, score, weakness, or future test topic that the evidence does not support.
3. Separate concepts covered, strengths, struggles, successful repairs, observed learning preferences, recurring mistakes, adaptation results from any re-test, question types, test signals, and unresolved questions.
4. Add exact message or artifact references whenever available. If a reference is unavailable, leave it absent and add a missing-data warning.
5. Give each observation a provenance kind: `user_provided`, `extracted`, `inferred`, `estimated`, or `unresolved`. Include confidence and a short rationale when confidence is meaningful.
6. Show the immutable raw-capture destination, readable Obsidian session-note destination, derived learner-record diff, confidence, and missing-data warnings before proposing a save.
7. If the authenticated Relay bridge is available, call `propose_save_session` with this exact bundle. A proposal is not a write.
8. Only describe the session as saved after Relay returns a committed operation. ChatGPT cannot call `commit_operation` for the MVP.
9. If the bridge is unavailable or the user declines, write/provide an Obsidian-compatible Markdown note plus the same JSON bundle as an import-compatible fallback. Do not claim that the vault or learner profile changed until the user confirms a filesystem export or Relay reports a committed bridge response.

## Obsidian output

The readable note should be saved in the selected vault at `courses/CLASS/sessions/DATE-TOPIC-SESSION.md`, for example `courses/CISC202/sessions/2026-09-02-recursion-session-001.md`. Its frontmatter must include `type: study-session`, `course`, `topic`, `date`, `concepts`, `strengths`, `struggles`, `successful_repairs`, and `open_questions`. Preserve the original conversation separately under `courses/CLASS/sessions/raw/SESSION.txt`. Link the note to its course, concepts, assignment when known, and the root learner notes. A profile refresh is a derived proposal and remains a hypothesis record with evidence, confidence, and a reason to revisit.

The JSON bundle remains accepted for manual import and interoperability at `study-sessions/CLASS/CLASS-session-DATE.json`. Use the date supplied for the session; replace `/` or `\\` with `-` in filenames because path separators are not valid filename characters.

## Output contract

Return valid JSON with no additional top-level fields unless a bridge explicitly accepts them:

```json
{
  "schemaVersion": 1,
  "sessionId": "session-2026-09-02-001",
  "courseId": "cs-441",
  "sessionDate": "2026-09-02",
  "topic": "recursion",
  "assignment": "Lab 1",
  "rawSession": { "format": "chat-export", "content": "..." },
  "conceptsCovered": [],
  "strengthsObserved": [],
  "strugglesObserved": [],
  "successfulRepairs": [],
  "learningPreferencesObserved": [],
  "recurringMistakesObserved": [],
  "adaptationResults": [],
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
