const STUDY_MEMORY_KEY = 'relay.study-memory.v1'
export const STUDY_MEMORY_SCHEMA_VERSION = 1
export const OPERATION_STATES = ['proposed', 'approved', 'writing', 'committed', 'failed', 'cancelled']
export const MATERIAL_UPLOAD_DIRECTORY = 'materials/file-uploaded'

const nowIso = () => new Date().toISOString()

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function normalizeCourseId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function slug(value) {
  return normalizeCourseId(value)
}

export function safeMaterialFilename(value) {
  const original = String(value || '').normalize('NFKC').split(/[\\/]/).pop().trim()
  const cleaned = original
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+$/, '')
    .slice(0, 180)
    .trim()
  return cleaned || 'uploaded-material'
}

export function normalizeCourseRoute(value = {}) {
  const courseId = normalizeCourseId(value.courseId || value.course || value.code)
  const courseLabel = String(value.courseLabel || value.courseName || value.label || '').trim()
  const confidence = Number(value.confidence)
  const hasConfidence = Number.isFinite(confidence)
  const evidence = String(value.evidence || '').trim()
  const needsClassName = value.needsClassName === true || !courseId || !hasConfidence || confidence < 0.7 || !evidence
  return {
    courseId: needsClassName ? '' : courseId,
    courseLabel,
    confidence: hasConfidence ? Math.max(0, Math.min(1, confidence)) : null,
    evidence,
    needsClassName,
  }
}

export function validateCourseAnswer(value) {
  const label = String(value || '').trim()
  const courseId = normalizeCourseId(label)
  const invalid = !courseId || courseId.length < 2 || ['class', 'course', 'unknown', 'school'].includes(courseId)
  return { valid: !invalid, courseId: invalid ? '' : courseId, courseLabel: label }
}

export function courseFromRoute(memory, route) {
  const normalized = normalizeCourseRoute(route)
  if (normalized.needsClassName) return { memory, course: null, route: normalized }
  const existing = memory.courses.find((item) => item.id === normalized.courseId)
  if (existing) return { memory, course: existing, route: normalized }
  const label = normalized.courseLabel || normalized.courseId.toUpperCase()
  const created = { id: normalized.courseId, code: label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase() || normalized.courseId.toUpperCase(), name: normalized.courseLabel || 'Imported course', term: '', color: 'green' }
  return { memory: { ...memory, courses: [...memory.courses, created] }, course: created, route: normalized }
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fallbackHash(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function decodeBase64(value) {
  const encoded = String(value || '').replace(/^data:[^;]+;base64,/, '')
  if (typeof atob === 'function') {
    const binary = atob(encoded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  }
  return encoded
}

export async function contentHash(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value instanceof Uint8Array ? value : null
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes || new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  if (!bytes) return fallbackHash(text)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return fallbackHash(binary)
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value).sort())
}

const seedMemory = {
  version: 1,
  rootName: 'study-context',
  courses: [{ id: 'cs-441', code: 'CS-441', name: 'Applied Machine Learning', term: 'fall 2026', color: 'green' }],
  assignments: [],
  artifacts: [],
  materialManifest: [],
  sessions: [],
  assessments: [],
  questionEvidence: [],
  learnerClaims: [],
  operations: [],
  graph: { status: 'not requested', lastRefreshAt: null, error: '', courseId: 'cs-441' },
  skillState: { tutor: { sessionsCommitted: 0, lastUpdatedAt: null, profileVersion: 0 } },
  tutorProfile: { strengths: [], weaknesses: [], improvements: [], basedOnSessionCount: 0, updatedAt: null },
}

function validMemory(value) {
  return value && value.version === 1 && Array.isArray(value.courses) && Array.isArray(value.assignments) && Array.isArray(value.artifacts) && Array.isArray(value.sessions) && Array.isArray(value.assessments) && Array.isArray(value.questionEvidence) && Array.isArray(value.learnerClaims) && Array.isArray(value.operations) && value.graph
}

export function readStudyMemory(existingAssignments = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(STUDY_MEMORY_KEY))
    if (validMemory(saved)) return { ...saved, materialManifest: saved.materialManifest || [], skillState: saved.skillState || clone(seedMemory.skillState), tutorProfile: saved.tutorProfile || clone(seedMemory.tutorProfile) }
  } catch {
    // A browser storage failure should never block manual capture.
  }
  const memory = clone(seedMemory)
  memory.assignments = existingAssignments.slice(0, 12).map((item, index) => ({
    id: `dashboard-${item.id || index}`,
    courseId: 'cs-441',
    title: item.title,
    kind: item.kind || 'assignment',
    dueAt: item.dueAt || '',
    source: item.source || 'dashboard syllabus cache',
  }))
  return memory
}

export function writeStudyMemory(value) {
  try {
    localStorage.setItem(STUDY_MEMORY_KEY, JSON.stringify(value))
  } catch {
    // The active session remains usable without persistent browser storage.
  }
}

export function createSessionBundle(input = {}) {
  const courseId = slug(input.courseId)
  return {
    schemaVersion: STUDY_MEMORY_SCHEMA_VERSION,
    sessionId: String(input.sessionId || id('session')),
    courseId,
    sessionDate: input.sessionDate || new Date().toISOString().slice(0, 10),
    rawSession: { format: input.rawSession?.format || 'chat-export', content: String(input.rawSession?.content || '') },
    conceptsCovered: Array.isArray(input.conceptsCovered) ? input.conceptsCovered : [],
    strengthsObserved: Array.isArray(input.strengthsObserved) ? input.strengthsObserved : [],
    strugglesObserved: Array.isArray(input.strugglesObserved) ? input.strugglesObserved : [],
    successfulRepairs: Array.isArray(input.successfulRepairs) ? input.successfulRepairs : [],
    questionTypes: Array.isArray(input.questionTypes) ? input.questionTypes : [],
    testSignals: Array.isArray(input.testSignals) ? input.testSignals : [],
    openQuestions: Array.isArray(input.openQuestions) ? input.openQuestions : [],
    evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs : [],
    provenance: input.provenance || 'inferred',
    confidence: Array.isArray(input.confidence) ? input.confidence : [],
  }
}

export function validateSessionBundle(value) {
  const errors = []
  if (!value || value.schemaVersion !== STUDY_MEMORY_SCHEMA_VERSION) errors.push(`schemaVersion must be ${STUDY_MEMORY_SCHEMA_VERSION}`)
  if (!value?.sessionId) errors.push('sessionId is required')
  if (!value?.courseId || slug(value.courseId) !== value.courseId) errors.push('courseId must be a lowercase slug such as cs-441')
  if (!value?.rawSession || typeof value.rawSession.content !== 'string' || !value.rawSession.content.trim()) errors.push('rawSession.content is required and must be preserved')
  ;['conceptsCovered', 'strengthsObserved', 'strugglesObserved', 'successfulRepairs', 'questionTypes', 'testSignals', 'openQuestions', 'evidenceRefs', 'confidence'].forEach((key) => {
    if (!Array.isArray(value?.[key])) errors.push(`${key} must be an array`)
  })
  const warnings = []
  if (!value?.sessionDate) warnings.push('session date is missing')
  if (!value?.evidenceRefs?.length) warnings.push('no precise message or artifact references were supplied')
  if (!value?.confidence?.length) warnings.push('no confidence rationale was supplied')
  return { valid: errors.length === 0, errors, warnings }
}

function claimDiff(bundle) {
  const entries = [
    ['strength', bundle.strengthsObserved],
    ['struggle', bundle.strugglesObserved],
    ['repair', bundle.successfulRepairs],
    ['question_pattern', bundle.questionTypes],
    ['test_signal', bundle.testSignals],
  ]
  return entries.flatMap(([type, values]) => values.map((value) => {
    const item = value && typeof value === 'object' ? value : { text: value }
    return { type, text: typeof value === 'string' ? value : item.text || item.name || JSON.stringify(value), provenance: item.provenance || bundle.provenance, confidence: Number(item.confidence ?? bundle.confidence?.[0]?.value ?? 0.5), sourceRef: item.sourceRef || bundle.evidenceRefs?.[0] || `session:${bundle.sessionId}` }
  }))
}

function pathsFor(course, sessionId, claimCount) {
  const root = `courses/${course.code}`
  return [
    `${root}/sessions/raw/${sessionId}.json`,
    `${root}/sessions/summaries/${sessionId}.json`,
    ...Array.from({ length: claimCount }, (_, index) => `${root}/learner/signals/${sessionId}-${index + 1}.json`),
    `${root}/operations/journal.jsonl`,
  ]
}

export async function proposeSaveSession(memory, bundle, courseId = bundle.courseId) {
  const normalized = createSessionBundle({ ...bundle, courseId })
  const validation = validateSessionBundle(normalized)
  if (!validation.valid) throw new Error(validation.errors.join('; '))
  const course = memory.courses.find((item) => item.id === normalized.courseId)
  if (!course) throw new Error(`Unknown course: ${normalized.courseId}`)
  const rawContent = JSON.stringify(normalized.rawSession)
  const hash = await contentHash(rawContent)
  const claims = claimDiff(normalized)
  const operation = {
    id: id('operation'),
    type: 'save_session',
    status: 'proposed',
    courseId: normalized.courseId,
    createdAt: nowIso(),
    sessionId: normalized.sessionId,
    contentHash: hash,
    destinationPaths: pathsFor(course, normalized.sessionId, claims.length),
    diff: { rawArtifact: `${course.code}/sessions/raw/${normalized.sessionId}.json`, summary: `${course.code}/sessions/summaries/${normalized.sessionId}.json`, learnerClaims: claims, warnings: validation.warnings },
    bundle: normalized,
    idempotencyKey: `${normalized.courseId}:${hash}`,
  }
  return operation
}

function tokenFor(operation) {
  return {
    value: id('approval'),
    operationId: operation.id,
    operationType: operation.type,
    courseId: operation.courseId,
    contentHash: operation.contentHash,
    destinationPaths: clone(operation.destinationPaths),
    diff: clone(operation.diff),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    used: false,
  }
}

export function approveOperation(memory, operationId) {
  const operation = memory.operations.find((item) => item.id === operationId)
  if (!operation || operation.status !== 'proposed') throw new Error('Only a proposed operation can be approved')
  const next = clone(memory)
  const target = next.operations.find((item) => item.id === operationId)
  target.status = 'approved'
  target.approvedAt = nowIso()
  target.approvalToken = tokenFor(target)
  return { memory: next, operation: target }
}

function tokenMatches(operation, token) {
  return token && token.value === operation.approvalToken?.value && !token.used && new Date(token.expiresAt).getTime() > Date.now() && token.operationId === operation.id && token.operationType === operation.type && token.courseId === operation.courseId && token.contentHash === operation.contentHash && stable(token.destinationPaths) === stable(operation.destinationPaths) && stable(token.diff) === stable(operation.diff)
}

function distinctTexts(values) {
  return [...new Set(values.map((item) => String(item?.evidence || item?.text || item?.name || '').trim()).filter(Boolean))].slice(0, 8)
}

export function buildTutorProfile(memory) {
  const activeClaims = memory.learnerClaims.filter((item) => item.status !== 'superseded')
  return {
    strengths: distinctTexts(activeClaims.filter((item) => item.type === 'strength')),
    weaknesses: distinctTexts(activeClaims.filter((item) => item.type === 'struggle')),
    improvements: distinctTexts(activeClaims.filter((item) => item.type === 'repair')),
    basedOnSessionCount: memory.sessions.length,
    updatedAt: nowIso(),
  }
}

export function commitOperation(memory, operationId, token) {
  const operation = memory.operations.find((item) => item.id === operationId)
  if (!operation || operation.status !== 'approved') throw new Error('Operation must be approved before commit')
  if (!tokenMatches(operation, token)) throw new Error('Approval token is missing, expired, reused, or does not match this proposal')
  const next = clone(memory)
  const target = next.operations.find((item) => item.id === operationId)
  target.status = 'writing'
  target.startedAt = nowIso()
  target.approvalToken.used = true
  if (target.type === 'propose_learner_update') {
    const claim = next.learnerClaims.find((item) => item.id === target.claimMutation.claimId)
    if (!claim) throw new Error('Learner claim no longer exists')
    claim.status = 'superseded'
    if (target.claimMutation.action !== 'delete') {
      const revision = { ...claim, ...target.claimMutation.updates, id: id('claim-revision'), status: target.claimMutation.updates.status || 'confirmed_by_user', revisionOf: claim.id, revisedAt: nowIso(), evidenceRefs: [...new Set([...(claim.evidenceRefs || []), claim.sourceArtifactId].filter(Boolean))] }
      next.learnerClaims.push(revision)
      target.result = { claimId: revision.id, supersedes: claim.id, action: target.claimMutation.action }
    } else {
      target.result = { claimId: claim.id, action: target.claimMutation.action }
    }
    target.status = 'committed'
    target.completedAt = nowIso()
    return next
  }
  if (target.type === 'save_session') {
  const bundle = target.bundle
  const duplicate = next.sessions.find((item) => item.rawArtifactHash === target.contentHash && item.courseId === target.courseId)
  if (duplicate) {
    target.status = 'failed'
    target.reason = 'duplicate artifact retained; no files were overwritten'
    target.duplicateOf = duplicate.id
    return next
  }
  const artifactId = id('artifact')
  const session = { id: bundle.sessionId, courseId: bundle.courseId, rawArtifactId: artifactId, rawArtifactHash: target.contentHash, sessionDate: bundle.sessionDate, concepts: bundle.conceptsCovered, evidence: claimDiff(bundle), unresolvedQuestions: bundle.openQuestions, proposedNextPractice: bundle.testSignals, createdAt: nowIso(), provenance: bundle.provenance }
  next.artifacts.push({ id: artifactId, type: 'session-raw', title: `${bundle.sessionId} raw chat export`, source: 'ChatGPT capture skill', courseId: bundle.courseId, path: target.destinationPaths[0], content: bundle.rawSession.content, immutable: true, contentHash: target.contentHash, createdAt: nowIso() })
  next.artifacts.push({ id: `${artifactId}-summary`, type: 'session-summary', title: `${bundle.sessionId} evidence summary`, source: 'capture-study-session', courseId: bundle.courseId, path: target.destinationPaths[1], content: JSON.stringify(bundle, null, 2), derivedFrom: [artifactId], createdAt: nowIso() })
  next.sessions.push(session)
  claimDiff(bundle).forEach((claim, index) => next.learnerClaims.push({ id: `${bundle.sessionId}-claim-${index + 1}`, courseId: bundle.courseId, ...claim, sourceArtifactId: artifactId, status: 'hypothesis', observationCount: 1, lastObservedAt: nowIso(), evidenceRefs: [artifactId, claim.sourceRef], transformVersion: 'capture-study-session.v1' }))
  next.skillState = next.skillState || clone(seedMemory.skillState)
  next.skillState.tutor = { ...(next.skillState.tutor || {}), sessionsCommitted: next.sessions.length }
  if (next.sessions.length > 0 && next.sessions.length % 3 === 0) {
    next.tutorProfile = buildTutorProfile(next)
    next.skillState.tutor.lastUpdatedAt = next.tutorProfile.updatedAt
    next.skillState.tutor.profileVersion = (next.skillState.tutor.profileVersion || 0) + 1
  }
  target.status = 'committed'
  target.completedAt = nowIso()
  target.result = { rawArtifactId: artifactId, graphRefresh: 'pending' }
  next.graph = { ...next.graph, status: 'pending', courseId: bundle.courseId, lastRefreshAt: null, error: '' }
  return next
  }
  throw new Error(`Unsupported operation type: ${target.type}`)
}

export function cancelOperation(memory, operationId) {
  const next = clone(memory)
  const operation = next.operations.find((item) => item.id === operationId)
  if (!operation || !['proposed', 'approved'].includes(operation.status)) throw new Error('Only an uncommitted proposal can be cancelled')
  operation.status = 'cancelled'
  operation.cancelledAt = nowIso()
  return next
}

export function addOperation(memory, operation) {
  return { ...memory, operations: [...memory.operations, operation] }
}

export async function proposeMaterialIngest(memory, { courseId, name, sourceType = 'course material', originalContent, originalBytesBase64 = '', byteLength = null, extractedText = '', assignmentId = null, derivedAssignments = [], parseStatus = 'parsed', sourceHash = '' }) {
  const normalizedCourseId = normalizeCourseId(courseId)
  const course = memory.courses.find((item) => item.id === normalizedCourseId)
  if (!course) throw new Error(`Unknown course: ${normalizedCourseId}`)
  if (!name || (originalContent == null && !originalBytesBase64)) throw new Error('A material filename and original content are required')
  const hash = sourceHash || await contentHash(originalBytesBase64 ? decodeBase64(originalBytesBase64) : originalContent)
  const artifactId = id('artifact')
  const safeName = safeMaterialFilename(name)
  const root = `courses/${course.code}`
  const materialPath = `${root}/${MATERIAL_UPLOAD_DIRECTORY}/${safeName}`
  const extractedPath = `${root}/materials/extracted/${artifactId}.txt`
  const assignmentPath = `${root}/assignments/derived/${artifactId}.json`
  return {
    id: id('operation'),
    type: 'ingest_course_material',
    status: 'proposed',
    courseId: normalizedCourseId,
    createdAt: nowIso(),
    contentHash: hash,
    idempotencyKey: `${normalizedCourseId}:${hash}`,
    destinationPaths: [materialPath, extractedPath, assignmentPath, `${root}/materials/manifest.json`, `${root}/operations/journal.jsonl`],
    diff: { rawArtifact: materialPath, extractedArtifact: extractedPath, assignmentMetadata: assignmentPath, learnerClaims: [], warnings: parseStatus === 'parsed' ? [] : [`parse status: ${parseStatus}`] },
    material: { artifactId, name: safeName, originalName: String(name), sourceType, originalContent: originalContent == null ? '' : originalContent, originalBytesBase64, byteLength, extractedText, assignmentId, derivedAssignments, parseStatus },
  }
}

export function commitMaterialOperation(memory, operationId, token) {
  const operation = memory.operations.find((item) => item.id === operationId)
  if (!operation || operation.type !== 'ingest_course_material' || operation.status !== 'approved') throw new Error('Material operation must be approved before commit')
  if (!tokenMatches(operation, token)) throw new Error('Approval token is missing, expired, reused, or does not match this proposal')
  const next = clone(memory)
  const target = next.operations.find((item) => item.id === operationId)
  target.status = 'writing'
  target.startedAt = nowIso()
  target.approvalToken.used = true
  const material = target.material
  const duplicate = next.artifacts.find((item) => item.contentHash === target.contentHash && item.courseId === target.courseId && item.immutable)
  if (duplicate) {
    target.status = 'failed'
    target.reason = 'duplicate artifact retained; no files were overwritten'
    target.duplicateOf = duplicate.id
    target.completedAt = nowIso()
    return next
  }
  const importedAt = nowIso()
  const rawArtifact = { id: material.artifactId, type: sourceTypeLabel(material.sourceType), title: material.name, originalName: material.originalName || material.name, source: material.sourceType, courseId: target.courseId, path: target.destinationPaths[0], content: material.originalContent, originalBytesBase64: material.originalBytesBase64 || '', byteLength: material.byteLength, extractedText: material.extractedText, immutable: true, contentHash: target.contentHash, byteHash: target.contentHash, parseStatus: material.parseStatus || 'parsed', importedAt, createdAt: importedAt }
  next.artifacts.push(rawArtifact)
  next.artifacts.push({ id: `${material.artifactId}-extracted`, type: 'extracted-text', title: `${material.name} extracted text`, courseId: target.courseId, path: target.destinationPaths[1], content: material.extractedText || '', immutable: false, derivedFrom: [material.artifactId], sourceArtifactId: material.artifactId, contentHash: material.extractedText ? fallbackHash(material.extractedText) : null, createdAt: importedAt })
  next.artifacts.push({ id: `${material.artifactId}-assignments`, type: 'assignment-metadata', title: `${material.name} assignment metadata`, courseId: target.courseId, path: target.destinationPaths[2], content: JSON.stringify(material.derivedAssignments || []), immutable: false, derivedFrom: [material.artifactId], sourceArtifactId: material.artifactId, assignmentId: material.assignmentId || null, createdAt: importedAt })
  next.materialManifest = [...(next.materialManifest || []), { artifactId: material.artifactId, courseId: target.courseId, sourceType: material.sourceType, originalFilename: material.originalName || material.name, filename: material.name, relativePath: target.destinationPaths[0], byteHash: target.contentHash, importTime: importedAt, parseStatus: material.parseStatus || 'parsed', derivedExtractedText: target.destinationPaths[1], derivedAssignmentMetadata: target.destinationPaths[2], assignmentId: material.assignmentId || null }]
  const derivedAssignments = Array.isArray(material.derivedAssignments) ? material.derivedAssignments : []
  next.assignments = [...(next.assignments || []), ...derivedAssignments.map((assignment, index) => ({ ...assignment, id: assignment.id || `${material.artifactId}-assignment-${index + 1}`, courseId: target.courseId, sourceArtifactId: material.artifactId, sourceHash: target.contentHash }))]
  target.result = { artifactId: material.artifactId, manifestPath: target.destinationPaths[3] }
  target.status = 'committed'
  target.completedAt = nowIso()
  return next
}

function sourceTypeLabel(value) {
  return String(value || 'course material').toLowerCase().replace(/\s+/g, '-')
}

export function proposeAssessmentEvidence(memory, { courseId, assessmentTitle, assessmentId = id('assessment'), question }) {
  const course = memory.courses.find((item) => item.id === courseId)
  if (!course) throw new Error(`Unknown course: ${courseId}`)
  if (!question?.prompt?.trim()) throw new Error('A question prompt is required')
  const evidenceId = id('question')
  const root = `courses/${course.code}`
  const hasScore = question.earned !== '' && question.earned != null || question.possible !== '' && question.possible != null
  const record = { questionEvidenceId: evidenceId, attemptId: question.attemptId || id('attempt'), assessmentId, number: question.number || 'unlabeled', prompt: question.prompt.trim(), studentAnswer: question.studentAnswer || '', officialAnswer: question.officialAnswer || null, correction: question.correction || '', score: hasScore ? { earned: question.earned ?? null, possible: question.possible ?? null } : null, concepts: question.concept ? [{ name: question.concept, confidence: question.conceptConfidence ?? null }] : [], questionTypes: question.questionType ? [question.questionType] : [], sourceRef: question.sourceRef || null }
  return {
    id: id('operation'), type: 'record_assessment_evidence', status: 'proposed', courseId, createdAt: nowIso(), contentHash: null, idempotencyKey: `${courseId}:${evidenceId}`, destinationPaths: [`${root}/assessments/past-tests/${assessmentId}.json`, `${root}/assessments/question-records/${evidenceId}.json`, `${root}/operations/journal.jsonl`], diff: { rawArtifact: `${assessmentTitle || 'past test'} / question ${record.number}`, extractedArtifact: `${evidenceId}.json`, learnerClaims: [], warnings: [!record.officialAnswer && 'official answer not supplied', !record.score && 'score not supplied', !record.sourceRef && 'source page/reference not supplied'].filter(Boolean) }, assessment: { assessmentId, title: assessmentTitle || 'untitled past test', sourceArtifactId: question.sourceArtifactId || null }, question: record,
  }
}

export function proposeLearnerMutation(memory, { courseId, claimId, action, updates = {} }) {
  const claim = memory.learnerClaims.find((item) => item.id === claimId && item.courseId === courseId)
  if (!claim) throw new Error('Learner claim not found')
  const operation = { id: id('operation'), type: 'propose_learner_update', status: 'proposed', courseId, createdAt: nowIso(), contentHash: claim.id, idempotencyKey: `${courseId}:${claim.id}:${action}:${Date.now()}`, destinationPaths: [`courses/${memory.courses.find((item) => item.id === courseId).code}/learner/signals/${claim.id}.json`], diff: { rawArtifact: 'none', extractedArtifact: claim.id, learnerClaims: [{ ...claim, ...updates, status: action === 'delete' ? 'superseded' : 'confirmed_by_user' }], warnings: ['original derived claim remains preserved; this creates a revision or tombstone'] }, claimMutation: { claimId, action, updates } }
  return operation
}

export function commitAssessmentOperation(memory, operationId, token) {
  const operation = memory.operations.find((item) => item.id === operationId)
  if (!operation || operation.type !== 'record_assessment_evidence' || operation.status !== 'approved') throw new Error('Assessment operation must be approved before commit')
  if (!tokenMatches(operation, token)) throw new Error('Approval token is missing, expired, reused, or does not match this proposal')
  const next = clone(memory)
  const target = next.operations.find((item) => item.id === operationId)
  target.status = 'committed'; target.approvalToken.used = true; target.completedAt = nowIso()
  if (!next.assessments.some((item) => item.assessmentId === target.assessment.assessmentId)) next.assessments.push({ ...target.assessment, courseId: target.courseId, version: 1 })
  next.questionEvidence.push({ ...target.question, courseId: target.courseId, version: 1 })
  target.result = { questionEvidenceId: target.question.questionEvidenceId }
  return next
}

export function buildCourseContext(memory, courseId) {
  const sessions = memory.sessions.filter((item) => item.courseId === courseId).slice(-3).reverse()
  const claims = memory.learnerClaims.filter((item) => item.courseId === courseId)
  return {
    courseId,
    strengths: claims.filter((item) => item.type === 'strength' && item.status !== 'superseded'),
    activeStruggles: claims.filter((item) => item.type === 'struggle' && item.status !== 'superseded'),
    recentRepairs: claims.filter((item) => item.type === 'repair' && item.status !== 'superseded').slice(-5).reverse(),
    suggestedPractice: sessions.flatMap((item) => item.proposedNextPractice || []).slice(0, 5),
    sourceSessionIds: sessions.map((item) => item.id),
  }
}

export function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function sessionBundleClass(bundle) {
  return String(bundle?.courseCode || bundle?.courseId || 'CLASS').replace(/[^a-z0-9]+/gi, '').toUpperCase() || 'CLASS'
}

export function sessionBundleFilename(bundle) {
  const course = sessionBundleClass(bundle)
  const date = String(bundle?.sessionDate || 'DATE').trim().replace(/[\\/]/g, '-').replace(/[^a-z0-9-]/gi, '')
  return `${course}-session-${date || 'DATE'}.json`
}

export function sessionBundlePath(bundle) {
  return `study-sessions/${sessionBundleClass(bundle)}/${sessionBundleFilename(bundle)}`
}

export async function saveJsonToStudySessions(bundle, value) {
  const filename = sessionBundleFilename(bundle)
  const path = sessionBundlePath(bundle)
  if (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') {
    const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
    const sessionDirectory = await rootHandle.getDirectoryHandle('study-sessions', { create: true })
    const classDirectory = await sessionDirectory.getDirectoryHandle(sessionBundleClass(bundle), { create: true })
    const fileHandle = await classDirectory.getFileHandle(filename, { create: true })
    const serialized = JSON.stringify(value, null, 2)
    const existing = await fileHandle.getFile()
    if (existing.size > 0 && (await existing.text()) !== serialized) throw new Error(`${filename} already exists; no file was overwritten`)
    const writable = await fileHandle.createWritable()
    await writable.write(serialized)
    await writable.close()
    return { mode: 'filesystem', path }
  }
  downloadJson(filename, value)
  return { mode: 'download', path }
}

export async function saveMaterialToStudyContext(operation) {
  if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') throw new Error('No authenticated bridge is available. Use a Chromium browser with directory access for manual archive import.')
  const material = operation?.material
  if (!material?.originalBytesBase64) throw new Error('The original material bytes are missing; no file was written')
  const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
  const courses = await rootHandle.getDirectoryHandle('courses', { create: true })
  const courseDirectory = await courses.getDirectoryHandle(operation.courseId.toUpperCase(), { create: true })
  const materials = await courseDirectory.getDirectoryHandle('materials', { create: true })
  const uploaded = await materials.getDirectoryHandle(MATERIAL_UPLOAD_DIRECTORY.split('/')[1], { create: true })
  const filename = safeMaterialFilename(material.originalName || material.name)
  const bytes = decodeBase64(material.originalBytesBase64)
  const manifestHandle = await materials.getFileHandle('manifest.json', { create: true })
  let manifest = []
  try { manifest = JSON.parse(await (await manifestHandle.getFile()).text()) } catch { /* new manifest */ }
  if (!Array.isArray(manifest)) manifest = []
  if (manifest.some((item) => item.byteHash === operation.contentHash)) throw new Error('duplicate artifact retained; no files were overwritten')
  let fileHandle
  let existed = false
  try { fileHandle = await uploaded.getFileHandle(filename); existed = true } catch { fileHandle = await uploaded.getFileHandle(filename, { create: true }) }
  if (existed) throw new Error(`${filename} already exists; no file was overwritten`)
  const writable = await fileHandle.createWritable()
  await writable.write(bytes)
  await writable.close()
  const extractedDirectory = await materials.getDirectoryHandle('extracted', { create: true })
  const extractedHandle = await extractedDirectory.getFileHandle(`${material.artifactId}.txt`, { create: true })
  const extractedWritable = await extractedHandle.createWritable()
  await extractedWritable.write(material.extractedText || '')
  await extractedWritable.close()
  const assignmentsDirectory = await courseDirectory.getDirectoryHandle('assignments', { create: true })
  const derivedDirectory = await assignmentsDirectory.getDirectoryHandle('derived', { create: true })
  const assignmentHandle = await derivedDirectory.getFileHandle(`${material.artifactId}.json`, { create: true })
  const assignmentWritable = await assignmentHandle.createWritable()
  await assignmentWritable.write(JSON.stringify({ schemaVersion: 1, artifactId: material.artifactId, sourceArtifactId: material.artifactId, assignments: material.derivedAssignments || [], assignmentId: material.assignmentId || null }, null, 2))
  await assignmentWritable.close()
  manifest.push({ artifactId: material.artifactId, courseId: operation.courseId, sourceType: material.sourceType, originalFilename: material.originalName || material.name, relativePath: `courses/${operation.courseId.toUpperCase()}/${MATERIAL_UPLOAD_DIRECTORY}/${filename}`, byteHash: operation.contentHash, importTime: nowIso(), parseStatus: material.parseStatus || 'parsed', derivedExtractedText: `courses/${operation.courseId.toUpperCase()}/materials/extracted/${material.artifactId}.txt`, derivedAssignmentMetadata: `courses/${operation.courseId.toUpperCase()}/assignments/derived/${material.artifactId}.json`, assignmentId: material.assignmentId || null })
  const manifestWritable = await manifestHandle.createWritable()
  await manifestWritable.write(JSON.stringify(manifest, null, 2))
  await manifestWritable.close()
  return { mode: 'filesystem', path: `study-context/courses/${operation.courseId.toUpperCase()}/${MATERIAL_UPLOAD_DIRECTORY}/${filename}` }
}

export async function pingStudyBridge({ endpoint, secret = '', signal } = {}) {
  if (!endpoint) return { status: 'manual fallback', endpointConfigured: false, message: 'No local bridge configured; manual export/import is ready.' }
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/ping`, { headers: secret ? { Authorization: `Bearer ${secret}` } : {}, signal })
  if (!response.ok) throw new Error(`Bridge ping failed (${response.status})`)
  return { ...(await response.json()), status: 'ready', endpointConfigured: true }
}

export async function getStudyCourseContext({ endpoint, courseId, secret = '', signal } = {}) {
  if (!endpoint) return buildCourseContext(readStudyMemory(), courseId)
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/course_context?courseId=${encodeURIComponent(courseId)}`, { headers: secret ? { Authorization: `Bearer ${secret}` } : {}, signal })
  if (!response.ok) throw new Error(`Bridge context request failed (${response.status})`)
  return response.json()
}

async function bridgeJson({ endpoint, path, secret = '', method = 'GET', body: payload, signal, idempotencyKey = '' } = {}) {
  if (!endpoint) throw new Error('No study bridge configured')
  const headers = { 'Content-Type': 'application/json' }
  if (secret) headers.Authorization = `Bearer ${secret}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey
  const response = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, { method, headers, body: payload == null ? undefined : JSON.stringify(payload), signal })
  let result = {}
  try { result = await response.json() } catch { /* error below remains useful */ }
  if (!response.ok) throw new Error(result.error || `Bridge request failed (${response.status})`)
  return result
}

export async function proposeStudyMaterial({ endpoint, secret = '', operation, signal } = {}) {
  const material = operation?.material || {}
  return bridgeJson({ endpoint, secret, signal, method: 'POST', path: '/propose_ingest_material', idempotencyKey: operation?.idempotencyKey, body: {
    courseId: operation.courseId,
    material: { sourceType: material.sourceType, originalName: material.originalName || material.name, filename: material.name, originalContent: material.originalBytesBase64 ? { encoding: 'base64', data: material.originalBytesBase64 } : { encoding: 'utf8', data: material.originalContent || '' }, byteLength: material.byteLength, extractedText: material.extractedText || '', assignmentId: material.assignmentId || null, derivedAssignments: material.derivedAssignments || [], parseStatus: material.parseStatus || 'parsed' },
    diff: operation.diff,
  } })
}

export async function approveStudyOperation({ endpoint, secret = '', operationId, signal } = {}) {
  return bridgeJson({ endpoint, secret, signal, method: 'POST', path: '/approve_operation', body: { operationId } })
}

export async function commitStudyOperation({ endpoint, secret = '', operationId, approvalToken, signal } = {}) {
  return bridgeJson({ endpoint, secret, signal, method: 'POST', path: '/commit_operation', body: { operationId, approvalToken } })
}

export function getStudyBridgeHealth() {
  const endpoint = import.meta.env.VITE_STUDY_BRIDGE_URL || ''
  return { endpoint, endpointConfigured: Boolean(endpoint), status: endpoint ? 'not checked' : 'manual fallback' }
}

export { STUDY_MEMORY_KEY }
