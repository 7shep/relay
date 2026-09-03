import { beforeEach, describe, expect, it } from 'vitest'
import {
  addOperation,
  approveOperation,
  buildCourseContext,
  cancelOperation,
  commitAssessmentOperation,
  commitMaterialOperation,
  commitOperation,
  createSessionBundle,
  buildTutorProfile,
  createLearnerProfileMarkdown,
  createLearnerSignalMarkdown,
  createSessionMarkdown,
  proposeAssessmentEvidence,
  proposeLearnerMutation,
  proposeMaterialIngest,
  proposeSaveSession,
  readStudyMemory,
  normalizeCourseRoute,
  safeMaterialFilename,
  validateCourseAnswer,
  sessionBundleFilename,
  sessionBundlePath,
  obsidianSessionPath,
  validateSessionBundle,
} from './studyMemoryRuntime.js'

function storage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

function bundle(overrides = {}) {
  return createSessionBundle({
    sessionId: 'session-test-01',
    courseId: 'cs-441',
    sessionDate: '2026-09-02',
    rawSession: { format: 'chat-export', content: 'Student explained the null hypothesis after one hint.' },
    conceptsCovered: [{ name: 'hypothesis testing' }],
    strugglesObserved: [{ text: 'Needed one hint', confidence: 0.72, sourceRef: 'message:14' }],
    evidenceRefs: ['message:14'],
    confidence: [{ value: 0.72, rationale: 'one observed repair' }],
    ...overrides,
  })
}

describe('study memory bridge contract', () => {
  beforeEach(() => { globalThis.localStorage = storage() })

  it('requires a versioned, lowercase, raw-preserving capture bundle', () => {
    expect(validateSessionBundle(bundle())).toMatchObject({ valid: true })
    expect(validateSessionBundle({ ...bundle(), courseId: 'CS-441' }).errors).toContain('courseId must be a lowercase slug such as cs-441')
    expect(validateSessionBundle({ ...bundle(), rawSession: { format: 'chat-export', content: '' } }).valid).toBe(false)
  })

  it('migrates legacy browser graph state without claiming an Obsidian sync', () => {
    const legacy = { ...readStudyMemory(), graph: { status: 'pending' } }
    localStorage.setItem('relay.study-memory.v1', JSON.stringify(legacy))
    const migrated = readStudyMemory()
    expect(migrated.graph).toBeUndefined()
    expect(migrated.vault).toMatchObject({ status: 'not configured' })
  })

  it('does not change canonical memory while a save is only proposed', async () => {
    const memory = readStudyMemory()
    const operation = await proposeSaveSession(memory, bundle())
    const withProposal = addOperation(memory, operation)
    expect(withProposal.sessions).toHaveLength(0)
    expect(withProposal.operations[0]).toMatchObject({ type: 'save_session', status: 'proposed' })
    expect(operation.destinationPaths).toEqual(expect.arrayContaining(['courses/CS-441/sessions/raw/session-test-01.txt', 'courses/CS-441/sessions/2026-09-02-hypothesis-testing-session-test-01.md']))
  })

  it('binds commit to a one-use approval token and preserves the raw artifact', async () => {
    const memory = readStudyMemory()
    const operation = await proposeSaveSession(memory, bundle())
    const proposed = addOperation(memory, operation)
    const approved = approveOperation(proposed, operation.id)
    const committed = commitOperation(approved.memory, operation.id, approved.operation.approvalToken)
    expect(committed.sessions).toHaveLength(1)
    expect(committed.artifacts[0]).toMatchObject({ immutable: true, content: 'Student explained the null hypothesis after one hint.' })
    expect(committed.learnerClaims[0]).toMatchObject({ type: 'struggle', status: 'hypothesis', sourceArtifactId: committed.sessions[0].rawArtifactId })
    expect(() => commitOperation(approved.memory, operation.id, { ...approved.operation.approvalToken, used: true })).toThrow('Approval token')
  })

  it('retains duplicate imports as visible failed operations without overwriting evidence', async () => {
    const memory = readStudyMemory()
    const first = await proposeSaveSession(memory, bundle())
    const firstApproved = approveOperation(addOperation(memory, first), first.id)
    const committed = commitOperation(firstApproved.memory, first.id, firstApproved.operation.approvalToken)
    const second = await proposeSaveSession(committed, bundle({ sessionId: 'session-test-02' }))
    const secondApproved = approveOperation(addOperation(committed, second), second.id)
    const duplicate = commitOperation(secondApproved.memory, second.id, secondApproved.operation.approvalToken)
    expect(duplicate.sessions).toHaveLength(1)
    expect(duplicate.operations.at(-1)).toMatchObject({ status: 'failed', duplicateOf: 'session-test-01' })
  })

  it('cancels proposals and keeps missing assessment fields explicit', () => {
    const memory = readStudyMemory()
    const operation = proposeAssessmentEvidence(memory, { courseId: 'cs-441', assessmentTitle: 'midterm', question: { prompt: 'Explain the result.', concept: 'hypothesis testing' } })
    const proposed = addOperation(memory, operation)
    expect(proposed.operations[0].diff.warnings).toEqual(expect.arrayContaining(['official answer not supplied', 'score not supplied']))
    expect(cancelOperation(proposed, operation.id).operations[0].status).toBe('cancelled')
  })

  it('preserves a zero assessment score and excludes superseded claims from tutor context', () => {
    const memory = readStudyMemory()
    const operation = proposeAssessmentEvidence(memory, { courseId: 'cs-441', assessmentTitle: 'midterm', question: { prompt: 'Show the work.', earned: 0, possible: 8 } })
    expect(operation.question.score).toEqual({ earned: 0, possible: 8 })
    const profile = buildTutorProfile({ ...memory, learnerClaims: [{ type: 'strength', text: 'stale strength', status: 'superseded' }, { type: 'strength', text: 'current strength', status: 'hypothesis' }] })
    expect(profile.strengths).toEqual(['current strength'])
  })

  it('commits immutable course material and assessment evidence through approval', async () => {
    let memory = readStudyMemory()
    const material = await proposeMaterialIngest(memory, { courseId: 'cs-441', name: 'notes.md', originalContent: '# Notes', extractedText: 'Notes' })
    let approved = approveOperation(addOperation(memory, material), material.id)
    memory = commitMaterialOperation(approved.memory, material.id, approved.operation.approvalToken)
    expect(memory.artifacts[0]).toMatchObject({ immutable: true, title: 'notes.md', content: '# Notes' })

    const assessment = proposeAssessmentEvidence(memory, { courseId: 'cs-441', assessmentTitle: 'midterm', question: { prompt: 'Show the work.', earned: 0, possible: 8 } })
    approved = approveOperation(addOperation(memory, assessment), assessment.id)
    memory = commitAssessmentOperation(approved.memory, assessment.id, approved.operation.approvalToken)
    expect(memory.assessments).toHaveLength(1)
    expect(memory.questionEvidence[0].score).toEqual({ earned: 0, possible: 8 })
  })

  it('routes uploaded materials to file-uploaded, preserves source metadata, and links derived assignments', async () => {
    let memory = readStudyMemory()
    const material = await proposeMaterialIngest(memory, { courseId: 'cs-441', name: '..\\syllabus?.pdf', sourceType: 'syllabus', originalContent: 'PDF bytes', extractedText: 'Due date', derivedAssignments: [{ title: 'Lab 1' }], parseStatus: 'parsed' })
    expect(material.destinationPaths[0]).toBe('courses/CS-441/materials/file-uploaded/syllabus_.pdf')
    let approved = approveOperation(addOperation(memory, material), material.id)
    memory = commitMaterialOperation(approved.memory, material.id, approved.operation.approvalToken)
    expect(memory.materialManifest[0]).toMatchObject({ originalFilename: '..\\syllabus?.pdf', relativePath: material.destinationPaths[0], derivedAssignmentMetadata: material.destinationPaths[2] })
    expect(memory.assignments[0]).toMatchObject({ title: 'Lab 1', sourceArtifactId: memory.materialManifest[0].artifactId })
  })

  it('retains duplicate material imports as failed no-overwrite operations', async () => {
    let memory = readStudyMemory()
    const first = await proposeMaterialIngest(memory, { courseId: 'cs-441', name: 'assignment.pdf', originalContent: 'same bytes' })
    let approved = approveOperation(addOperation(memory, first), first.id)
    memory = commitMaterialOperation(approved.memory, first.id, approved.operation.approvalToken)
    const second = await proposeMaterialIngest(memory, { courseId: 'cs-441', name: 'renamed.pdf', originalContent: 'same bytes' })
    approved = approveOperation(addOperation(memory, second), second.id)
    const duplicate = commitMaterialOperation(approved.memory, second.id, approved.operation.approvalToken)
    expect(duplicate.operations.at(-1)).toMatchObject({ status: 'failed', duplicateOf: first.material.artifactId })
    expect(duplicate.artifacts.filter((item) => item.immutable)).toHaveLength(1)
  })

  it('blocks uncertain routes and normalizes unsafe filenames without losing the original name', () => {
    expect(normalizeCourseRoute({ courseId: 'cs-441', confidence: 0.4, evidence: 'weak title similarity' }).needsClassName).toBe(true)
    expect(normalizeCourseRoute({ courseId: 'cs-441', confidence: 0.94, evidence: 'header: CS-441' }).courseId).toBe('cs-441')
    expect(safeMaterialFilename('..\\folder\\syllabus?.pdf')).toBe('syllabus_.pdf')
    expect(validateCourseAnswer('CISC301')).toMatchObject({ valid: true, courseId: 'cisc301' })
    expect(validateCourseAnswer('unknown')).toMatchObject({ valid: false, courseId: '' })
  })

  it('appends reviewed learner-claim revisions and keeps the original superseded', async () => {
    let memory = readStudyMemory()
    const session = await proposeSaveSession(memory, bundle())
    let approved = approveOperation(addOperation(memory, session), session.id)
    memory = commitOperation(approved.memory, session.id, approved.operation.approvalToken)
    const original = memory.learnerClaims[0]
    const mutation = proposeLearnerMutation(memory, { courseId: 'cs-441', claimId: original.id, action: 'revise', updates: { evidence: 'Reviewed: needed one hint once.' } })
    approved = approveOperation(addOperation(memory, mutation), mutation.id)
    memory = commitOperation(approved.memory, mutation.id, approved.operation.approvalToken)
    expect(memory.learnerClaims).toHaveLength(2)
    expect(memory.learnerClaims.find((item) => item.id === original.id)).toMatchObject({ status: 'superseded' })
    expect(buildCourseContext(memory, 'cs-441').activeStruggles[0]).toMatchObject({ evidence: 'Reviewed: needed one hint once.', revisionOf: original.id })
  })

  it('organizes manual exports by class in the root study-sessions directory', () => {
    expect(sessionBundleFilename({ courseCode: 'CISC301', sessionDate: '02/09/26' })).toBe('CISC301-session-02-09-26.json')
    expect(sessionBundlePath({ courseCode: 'CISC301', sessionDate: '02/09/26' })).toBe('study-sessions/CISC301/CISC301-session-02-09-26.json')
  })

  it('refreshes the tutor profile across all courses every third committed session', async () => {
    let memory = readStudyMemory()
    for (let index = 1; index <= 3; index += 1) {
      const operation = await proposeSaveSession(memory, bundle({ sessionId: `session-test-0${index}`, rawSession: { format: 'chat-export', content: `distinct study session ${index}` }, strengthsObserved: [{ text: `strength ${index}` }], strugglesObserved: [{ text: `weakness ${index}` }] }))
      const approved = approveOperation(addOperation(memory, operation), operation.id)
      memory = commitOperation(approved.memory, operation.id, approved.operation.approvalToken)
    }
    expect(memory.skillState.tutor).toMatchObject({ sessionsCommitted: 3, profileVersion: 1 })
    expect(memory.tutorProfile.strengths).toContain('strength 3')
    expect(buildTutorProfile(memory).weaknesses).toContain('weakness 1')
  })

  it('renders an Obsidian session note with frontmatter and evidence links', () => {
    const session = bundle({ topic: 'recursion', assignment: 'Lab 1', conceptsCovered: [{ name: 'base cases' }, { name: 'call stack' }], learningPreferencesObserved: [{ text: 'Examples before formal definitions', confidence: 0.81, sourceRef: 'message:19' }], recurringMistakesObserved: [{ text: 'Forgets the base case', confidence: 0.74, sourceRef: 'message:21' }] })
    const note = createSessionMarkdown(session, { courseCode: 'CISC301' })
    expect(note).toContain('type: study-session')
    expect(note).toContain('course: CISC301')
    expect(note).toContain('concepts: ["base cases", "call stack"]')
    expect(note).toContain('confidence: ["72% — one observed repair"]')
    expect(note).toContain('[[../concepts/base-cases]]')
    expect(note).toContain('[[../assignments/lab-1]]')
    expect(note).toContain('[[../../../learner/recurring-mistakes]]')
    expect(createLearnerSignalMarkdown({ type: 'recurring_mistake', text: 'Forgets the base case', sessionId: 'session-test-01' }, { courseCode: 'CISC301', sessionFilename: '2026-09-02-recursion-session-test-01.md' })).toContain('[[../../sessions/2026-09-02-recursion-session-test-01]]')
    expect(obsidianSessionPath(session, 'CISC301')).toContain('courses/CISC301/sessions/2026-09-02-recursion-session-test-01.md')
  })

  it('writes learner profile entries as revisable hypotheses with evidence', () => {
    const profile = buildTutorProfile({ ...readStudyMemory(), sessions: [{ id: 's1' }], learnerClaims: [{ type: 'learning_preference', text: 'One hint at a time', confidence: 0.86, evidenceRefs: ['artifact-1'], status: 'hypothesis' }] })
    const markdown = createLearnerProfileMarkdown(profile)
    expect(markdown).toContain('status: hypotheses')
    expect(markdown).toContain('### One hint at a time')
    expect(markdown).toContain('Confidence: **86%**')
    expect(markdown).toContain('Evidence: artifact-1')
    expect(markdown).toContain('revisable hypotheses')
  })
})
