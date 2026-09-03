# assignment

Invoke this skill when the learner names an assignment, for example: `help me with the CISC301 lab report`. Relay remains the local context/archive surface; ChatGPT remains the place where the learner works through the assignment.

## Procedure

1. Resolve the named assignment against the selected course's local context folder, using its manifest/assignment ID and not a title-only guess. If there are multiple matches, ask which one.
2. Load the assignment prompt, rubric, draft, syllabus/material sources, and any relevant learner context. Tell the learner which sources are attached and which are missing.
3. Restate the task and rubric in plain language. Break it into questions or checkpoints and work through them one at a time.
4. Help the learner reach a 100%-quality answer: provide direct explanations, examples, answer outlines, draft wording, and a model answer when useful. Tie each recommendation to the prompt or rubric so the learner can understand and verify it.
5. Ask for the learner's own answer when a checkpoint tests understanding, then correct it precisely. Distinguish a suggested answer from the learner's submitted work.
6. Before the learner finishes, run a rubric coverage check: requirements met, evidence present, reasoning sound, terminology accurate, format satisfied, and unresolved gaps.
7. Save nothing silently. A draft save, learner signal, session capture, or derived update must be separately proposed and explicitly approved. Never submit work, impersonate the learner, overwrite a draft, or create a dashboard task.

If the assignment is not in the local context folder, say so and ask the learner to import the prompt or material. Do not invent missing instructions, answer keys, scores, citations, or grading guarantees. If the work is graded, give the learner enough reasoning to own and verify the answer rather than presenting unsupported certainty.
