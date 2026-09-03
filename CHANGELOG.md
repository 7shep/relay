# Changelog

## 0.2.0 - 2026-09-02

### Added

- Capture ChatGPT study sessions as reviewable, schema-versioned bundles in the local study-memory workspace.
- Export session bundles to the root `study-sessions/` directory using course, session, and date filenames.
- Review and approve immutable session artifacts, learner evidence, assessment question records, corrections, deletions, and visible operation states.
- Add Tutor and Assignment skills for bounded course context, cross-course learner-profile refreshes, and rubric-aware assignment guidance.
- Add an optional authenticated local study bridge with safe course paths, read-only context access, and approval-bound writes.
- Keep Graphify optional and derive its refresh state from the canonical study-session evidence archive.
