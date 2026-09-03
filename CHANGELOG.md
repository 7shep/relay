# Changelog

## 0.3.0 - 2026-09-03

### Added

- Upload course materials and assignment PDFs into class-scoped local archives while preserving original filenames and immutable bytes.
- Route syllabus files independently by class, ask for missing class names in the assistant, and keep archive proposals reviewable before writes.

### Changed

- Keep extracted text, derived assignment metadata, manifests, and archive operation states linked to their source files.
- Enforce authenticated, approval-bound bridge writes with upload limits, duplicate detection, safe course paths, and a manual browser-based fallback.
- Replace the optional graph refresh surface with an Obsidian-compatible Markdown vault containing linked session, concept, assignment, signal, and learner-profile notes.
- Record learning preferences, recurring mistakes, adaptation checks, evidence links, confidence, and revisit conditions as hypotheses rather than permanent labels.

## 0.2.0 - 2026-09-02

### Added

- Capture ChatGPT study sessions as reviewable, schema-versioned bundles in the local study-memory workspace.
- Export session bundles to the root `study-sessions/` directory using course, session, and date filenames.
- Review and approve immutable session artifacts, learner evidence, assessment question records, corrections, deletions, and visible operation states.
- Add Tutor and Assignment skills for bounded course context, cross-course learner-profile refreshes, and rubric-aware assignment guidance.
- Add an optional authenticated local study bridge with safe course paths, read-only context access, and approval-bound writes.
- Keep Graphify optional and derive its refresh state from the canonical study-session evidence archive.
