const AGENT_WORKSPACE_KEY = 'relay.academic.workspace.v1'

const seedWorkspace = {
  version: 1,
  courses: [
    {
      id: 'course-cs441',
      code: 'CS-441',
      name: 'Applied Machine Learning',
      term: 'fall 2026',
      color: 'green',
      materials: ['lecture-07.md', 'reading-bias-variance.pdf', 'lab-notes.md'],
      assignments: ['assignment-cs441-proposal'],
    },
    {
      id: 'course-psy201',
      code: 'PSY-201',
      name: 'Cognitive Psychology',
      term: 'fall 2026',
      color: 'amber',
      materials: ['chapter-05-notes.md'],
      assignments: [],
    },
  ],
  assignments: [
    {
      id: 'assignment-cs441-proposal',
      courseId: 'course-cs441',
      title: 'Project proposal',
      kind: 'research proposal',
      dueAt: '2026-09-12',
      stage: 'draft review',
      prompt: 'Propose a small machine-learning study. State a testable question, describe the data and evaluation method, and identify one risk to validity.',
      draft: 'I want to compare two models on a dataset and see which one performs better. I will train both models and use accuracy to evaluate them.',
      rubric: [
        { id: 'criterion-question', label: 'Research question', weight: 25, evidence: 'A focused, testable question with a measurable outcome.', assessment: 'partial', note: 'The comparison is clear, but the outcome and population are still broad.' },
        { id: 'criterion-method', label: 'Method and evaluation', weight: 35, evidence: 'Data source, split, baseline, and evaluation metric are justified.', assessment: 'weak', note: 'Add a baseline and explain why accuracy answers the question.' },
        { id: 'criterion-validity', label: 'Validity risk', weight: 20, evidence: 'One concrete threat and a mitigation tied to the proposed study.', assessment: 'missing', note: 'No risk or mitigation is currently named.' },
        { id: 'criterion-clarity', label: 'Clarity and scope', weight: 20, evidence: 'A feasible proposal with precise terminology and boundaries.', assessment: 'partial', note: 'The scope is promising; specify the dataset before committing.' },
      ],
    },
  ],
  artifacts: [
    { id: 'artifact-prompt', type: 'assignment prompt', title: 'Project proposal prompt', source: 'user provided', createdAt: '2026-09-02T16:40:00.000Z', assignmentId: 'assignment-cs441-proposal', content: 'Propose a small machine-learning study. State a testable question, describe the data and evaluation method, and identify one risk to validity.' },
    { id: 'artifact-rubric', type: 'rubric', title: 'Proposal rubric', source: 'user provided', createdAt: '2026-09-02T16:41:00.000Z', assignmentId: 'assignment-cs441-proposal', content: 'Four criteria: research question, method and evaluation, validity risk, clarity and scope.' },
    { id: 'artifact-draft', type: 'draft', title: 'Rough proposal draft', source: 'user provided', createdAt: '2026-09-02T16:42:00.000Z', assignmentId: 'assignment-cs441-proposal', content: 'I want to compare two models on a dataset and see which one performs better. I will train both models and use accuracy to evaluate them.' },
  ],
  runs: [
    { id: 'run-seed-review', agent: 'assignment', label: 'criterion map prepared', status: 'completed', provider: 'workspace fixture', startedAt: '2026-09-02T16:43:00.000Z', completedAt: '2026-09-02T16:43:02.000Z', inputs: ['artifact-prompt', 'artifact-rubric', 'artifact-draft'], outputs: ['artifact-rubric-map'], reason: 'Initial workspace context was assembled for review.', summary: 'Mapped 4 supplied rubric criteria to observable evidence.' },
  ],
  handoffs: [],
  signals: [
    { id: 'signal-seed', type: 'recurring gap', concept: 'evaluation design', courseId: 'course-cs441', evidence: 'Draft names accuracy without a baseline or metric rationale.', confidence: 0.72, sourceArtifactId: 'artifact-draft', createdAt: '2026-09-02T16:43:02.000Z' },
  ],
  learnerProfile: {
    strengths: ['explains the high-level model comparison clearly'],
    weakConcepts: [{ concept: 'evaluation design', confidence: 0.72, evidence: ['signal-seed'] }],
    patterns: ['moves to model choice before defining the measurable outcome'],
    corrections: [],
  },
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function validWorkspace(value) {
  return value && Array.isArray(value.courses) && Array.isArray(value.assignments) && Array.isArray(value.artifacts) && Array.isArray(value.runs) && Array.isArray(value.handoffs) && Array.isArray(value.signals) && value.learnerProfile
}

export function readAgentWorkspace(existingAssignments = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(AGENT_WORKSPACE_KEY))
    if (validWorkspace(saved)) return saved
  } catch {
    // Fall through to the local fixture when browser storage is unavailable.
  }
  const workspace = clone(seedWorkspace)
  existingAssignments.slice(0, 8).forEach((item, index) => {
    const id = `imported-${item.id || index}`
    if (workspace.assignments.some((assignment) => assignment.title.toLowerCase() === String(item.title).toLowerCase())) return
    workspace.assignments.push({
      id,
      courseId: 'course-cs441',
      title: item.title,
      kind: item.kind || 'assignment',
      dueAt: item.dueAt || '',
      stage: 'intake',
      prompt: '',
      draft: '',
      rubric: [],
    })
    workspace.courses[0].assignments.push(id)
  })
  return workspace
}

export function writeAgentWorkspace(value) {
  try {
    localStorage.setItem(AGENT_WORKSPACE_KEY, JSON.stringify(value))
  } catch {
    // The active session remains usable when browser storage is unavailable.
  }
}

export function createRun({ agent, label, inputs, reason, provider = 'local preview' }) {
  const now = new Date().toISOString()
  return { id: `run-${Date.now()}`, agent, label, status: 'completed', provider, startedAt: now, completedAt: now, inputs, outputs: [], reason, summary: '' }
}

export function createHandoff({ source, target, reason, inputArtifacts, outputArtifacts = [], requiresApproval = false }) {
  return { id: `handoff-${Date.now()}`, source, target, reason, inputArtifacts, outputArtifacts, status: requiresApproval ? 'awaiting approval' : 'completed', requiresApproval, createdAt: new Date().toISOString() }
}

export function createSignal({ type, concept, courseId, evidence, confidence, sourceArtifactId }) {
  return { id: `signal-${Date.now()}`, type, concept, courseId, evidence, confidence, sourceArtifactId, createdAt: new Date().toISOString() }
}

export function getProviderHealth() {
  return {
    provider: 'Luna 5.6',
    status: import.meta.env.VITE_LUNA_BRIDGE_URL ? 'ready' : 'not configured',
    endpointConfigured: Boolean(import.meta.env.VITE_LUNA_BRIDGE_URL),
  }
}
