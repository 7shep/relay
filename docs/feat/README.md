# Relay feature documentation

These docs describe the study-session save flow and the Obsidian-backed visualization in Relay.

## Start here

- [How to save a study session](session-save.md) explains the `capture-study-session` skill, proposal review, approval, commit, and the manual fallback.
- [How to use the vault graph](obsidian-graph.md) explains the live bridge, cache preview, filters, node shapes, selection, and bounded scope.
- [Obsidian archive and graph reference](obsidian-reference.md) lists the canonical folder layout, Markdown frontmatter, bridge endpoints, graph response, and node types.

## The data flow

```text
ChatGPT conversation
        |
        v
capture-study-session -> schema-versioned bundle
        |
        v
propose_save_session -> review exact destinations and learner diff
        |
        v
user approval -> commit_operation
        |
        v
canonical study-context/ Obsidian Markdown vault
        |
        v
GET /vault_graph -> read-only Relay vault graph
```

The capture skill creates a proposal or manual bundle. It must not claim that the vault changed until a committed bridge response or confirmed filesystem export exists. Relay's graph reads the canonical vault when the bridge is configured; otherwise it labels the result as a browser compatibility-cache preview.

## Important boundaries

- ChatGPT is the study surface and the source of the conversation evidence.
- The local bridge owns the canonical `study-context/` Obsidian-compatible vault.
- Raw captures are immutable. Session notes, learner signals, and profile notes are derived and reviewable.
- The graph workspace is read-only. Refreshing, filtering, and selecting nodes do not write Markdown.
