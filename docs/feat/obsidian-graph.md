# How to use the vault graph visualization

Relay's `vault graph` is a read-only SVG view of one course's Obsidian-compatible Markdown archive. It shows how sessions, concepts, assignments, learner evidence, and profile notes are connected by `[[wikilinks]]`.

This is not native Obsidian Graph view. The layout, node sizes, colors, and filters described here are implemented by `VaultGraphWorkspace` and `vaultGraph.js`.

## Open the graph

1. Start the local bridge when you want canonical vault data:

   ```powershell
   $env:RELAY_BRIDGE_SECRET = "replace-with-a-long-random-secret"
   $env:RELAY_STUDY_ROOT = "C:\Users\alex\Documents\study-context"
   npm run bridge
   ```

2. Start Relay with `VITE_STUDY_BRIDGE_URL=http://127.0.0.1:4112` and the same local-only secret in `VITE_STUDY_BRIDGE_SECRET`, then run:

   ```powershell
   npm run dev
   ```

3. Open Relay and select `vault graph` from the dashboard. Choose a course, optionally enter a topic, and select `focus scope`.

4. Select a node. The details panel shows its path, metadata, and connected evidence within two links. Use `refresh graph` after a committed vault write.

The graph itself never writes Markdown. A refresh only requests the current scope again.

## Understand the status label

| Status | Meaning | What to trust |
|---|---|---|
| `obsidian live` | The configured bridge returned the graph successfully | The selected vault scope |
| `cache preview` | No bridge is configured or the bridge request failed | A compatibility preview from Relay browser memory; Obsidian remains canonical |
| `reading vault` | The request is still loading | Wait for the graph or an error state |

When the bridge is unavailable, Relay displays a notice that it is showing the browser compatibility cache. Do not treat that preview as proof that a Markdown file exists in the vault.

## Read nodes and links

| Visual mark | Node type | Meaning in Relay |
|---|---|---|
| Large green circle at the center | `course` | The selected course hub |
| Green circle | `concept` | A concept note or topic |
| Blue square | `study-session` | A committed session note |
| Amber square | `assignment` or `assessment` | An assignment or assessment record |
| Red diamond | `learner-signal` | Derived learner evidence such as a strength, struggle, repair, or mistake |
| Amber circle | `learner-profile` | A root profile, learning-preference, or recurring-mistake note |
| Muted circle or other mark | `note`, `material`, or another type | A file returned by the graph that is outside the main legend |
| Thin line | edge | A resolved `[[wikilink]]` between two returned nodes |

Node size is a fixed visual encoding for type. A larger circle does not mean more links, higher confidence, or greater importance. The layout places the course at the center and other nodes in deterministic rings. Distance and position do not represent time, mastery, or semantic similarity.

Labels are intentionally selective. Course, concept, evidence, profile, and the selected node show labels; some session and assignment labels appear only after selection. An unlabeled mark is still a node.

When a node is selected, it receives a bright outline and connected nodes stay emphasized. Unrelated nodes fade. This is a selection aid, not a change to the underlying graph.

## Understand the scope

Without a topic, the graph contains the selected course's Markdown files plus the three root learner notes:

```text
selected course
├─ course/index
├─ concepts
├─ sessions and raw-linked records
├─ assignments and assessments
└─ learner signals

root learner notes
├─ learner/profile.md
├─ learner/learning-preferences.md
└─ learner/recurring-mistakes.md
```

With a topic, Relay first matches the topic against node IDs, labels, topic metadata, assignment metadata, and evidence type. It then keeps the matching nodes and expands the result by up to two graph hops. The footer calls this `course + “topic” + 2-hop context`.

The graph has a maximum of 180 visible nodes. The count at the top is the number of returned nodes and resolved edges in the visible scope, not a count of every file on disk.

## Interpret the details panel

Selecting a node can show:

- `course`: the course ID from frontmatter or the request.
- `topic`: the concept or topic metadata.
- `evidence`: the node's evidence type, claim type, or frontmatter type.
- `confidence`: a numeric confidence rendered as a percentage when it is between 0 and 1.
- `date`: a session or record date.
- `status`: for example, a hypothesis or superseded state.
- `path`: the canonical relative Markdown path.

The `connected evidence` list is computed from the selected node's adjacency and includes nodes within two links. It is grouped by type and capped at 12 items per group. It is a nearby-evidence view, not a complete export of every transitive relationship.

## Empty and surprising graphs

- `No Markdown notes were found in this course scope yet.` means the bridge returned no course/root learner Markdown nodes.
- `No notes match “topic”.` means the topic filter found no matching node.
- `Bridge unavailable · showing the browser compatibility cache.` means the graph is not canonical live vault data.
- A course with notes but no lines has Markdown nodes without resolved `[[wikilinks]]` inside the returned scope.
- A link to a missing note does not become an edge until the target note exists in the returned scope.
- A note outside the selected course is excluded, except for the three root learner profile notes.
- A profile note may be absent from the graph when it has no evidence-backed entries in the browser compatibility cache.

The graph parser reads `[[target]]`, `[[target|label]]`, and embedded `![[target]]` links. It resolves relative paths and matching basenames. It does not infer relationships from similar words in prose.

## A useful reading workflow

1. Start without a topic and confirm the course hub and main node types are present.
2. Enter one concept or assignment name and focus the scope.
3. Select the matching concept or session.
4. Read its path and metadata before interpreting the connected evidence.
5. Follow one nearby session or learner signal at a time.
6. Open the source Markdown when you need the full evidence; the graph is an index, not the full record.

## Related

- [Obsidian archive and graph reference](obsidian-reference.md)
- [How to save a study session](session-save.md)
- [Relay study bridge setup](../../bridge/README.md)
