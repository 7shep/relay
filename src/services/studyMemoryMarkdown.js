function stringValue(value) {
  return String(value ?? '').trim()
}

function observationText(value) {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return stringValue(value)
  return stringValue(value.text || value.evidence || value.name || value.title || JSON.stringify(value))
}

function observationValues(values = []) {
  return (Array.isArray(values) ? values : []).map(observationText).filter(Boolean)
}

function confidenceText(value) {
  if (!value || typeof value !== 'object' || value.value == null) return observationText(value)
  const percentage = Number.isFinite(Number(value.value)) ? `${Math.round(Number(value.value) * 100)}%` : String(value.value)
  return value.rationale ? `${percentage} — ${value.rationale}` : percentage
}

function safeSegment(value, fallback = 'note') {
  const normalized = stringValue(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function courseFolder(value) {
  return stringValue(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toUpperCase() || 'COURSE'
}

function yamlScalar(value) {
  const text = stringValue(value)
  return /^[a-z0-9_.-]+$/i.test(text) ? text : JSON.stringify(text)
}

function yamlArray(values) {
  const items = observationValues(values)
  return items.length ? `[${items.map(yamlScalar).join(', ')}]` : '[]'
}

function displayCourse(bundle, courseCode) {
  return stringValue(courseCode || bundle?.courseCode || bundle?.courseId).replace(/[^a-z0-9-]+/gi, '').toUpperCase() || 'COURSE'
}

export function obsidianCourseFolder(courseCode) {
  return courseFolder(courseCode)
}

export function obsidianSessionFilename(bundle) {
  const date = stringValue(bundle?.sessionDate || 'date').replace(/[\\/]/g, '-').replace(/[^a-z0-9-]/gi, '') || 'date'
  const topic = safeSegment(bundle?.topic || bundle?.conceptsCovered?.[0]?.name, 'study-session')
  const session = safeSegment(bundle?.sessionId, 'session')
  return `${date}-${topic}-${session}.md`
}

export function obsidianSessionPath(bundle, courseCode) {
  return `courses/${obsidianCourseFolder(displayCourse(bundle, courseCode))}/sessions/${obsidianSessionFilename(bundle)}`
}

export function obsidianRawSessionPath(bundle, courseCode) {
  return `courses/${obsidianCourseFolder(displayCourse(bundle, courseCode))}/sessions/raw/${safeSegment(bundle?.sessionId, 'session')}.txt`
}

export function obsidianConceptPath(courseCode, topic) {
  return `courses/${obsidianCourseFolder(courseCode)}/concepts/${safeSegment(topic)}.md`
}

export function obsidianAssignmentPath(courseCode, assignment) {
  return `courses/${obsidianCourseFolder(courseCode)}/assignments/${safeSegment(assignment)}.md`
}

export function obsidianSignalPath(courseCode, sessionId, index) {
  return `courses/${obsidianCourseFolder(courseCode)}/learner/signals/${safeSegment(sessionId, 'session')}-${index + 1}.md`
}

export function createCourseMarkdown(courseCode, courseName = '') {
  const course = obsidianCourseFolder(courseCode)
  return ['---', 'type: course', `course: ${yamlScalar(course)}`, '---', '', `# ${course}`, '', courseName ? `${courseName}.` : 'Course hub for sessions, concepts, assignments, and linked learner evidence.', '', '## Study sessions', '', '_Notes appear here as they are captured._', ''].join('\n')
}

export function createConceptMarkdown(courseCode, topic, sessionFilename) {
  const course = obsidianCourseFolder(courseCode)
  const label = stringValue(topic) || 'Unspecified concept'
  return ['---', 'type: concept', `course: ${yamlScalar(course)}`, `topic: ${yamlScalar(label)}`, '---', '', `# ${label}`, '', `Course: ${relativeLink('../index')} — ${course}`, '', '## Evidence', '', sessionFilename ? `- ${relativeLink(`../sessions/${sessionFilename.replace(/\.md$/i, '')}`)} — captured study session` : '_No linked sessions yet._', ''].join('\n')
}

export function createAssignmentMarkdown(courseCode, assignment, sessionFilename) {
  const course = obsidianCourseFolder(courseCode)
  const label = stringValue(assignment) || 'Unspecified assignment'
  return ['---', 'type: assignment', `course: ${yamlScalar(course)}`, `assignment: ${yamlScalar(label)}`, '---', '', `# ${label}`, '', `Course: ${relativeLink('../index')} — ${course}`, '', '## Linked sessions', '', sessionFilename ? `- ${relativeLink(`../sessions/${sessionFilename.replace(/\.md$/i, '')}`)}` : '_No linked sessions yet._', ''].join('\n')
}

function relativeLink(path) {
  return `[[${path.replace(/\.md$/i, '')}]]`
}

function claimDetails(value) {
  if (!value || typeof value !== 'object') return ''
  const details = []
  if (value.sourceRef) details.push(`source: ${value.sourceRef}`)
  if (value.confidence != null && Number.isFinite(Number(value.confidence))) details.push(`confidence: ${Math.round(Number(value.confidence) * 100)}%`)
  if (value.confidenceRationale || value.rationale) details.push(`why: ${value.confidenceRationale || value.rationale}`)
  if (value.revisitWhen) details.push(`revisit: ${value.revisitWhen}`)
  return details.length ? ` — ${details.join('; ')}` : ''
}

function observationSection(title, values) {
  const items = Array.isArray(values) ? values : []
  if (!items.length) return `## ${title}\n\n_Not supplied._\n`
  return `## ${title}\n\n${items.map((item) => `- ${observationText(item)}${claimDetails(item)}`).join('\n')}\n`
}

export function createSessionMarkdown(bundle = {}, { courseCode } = {}) {
  const course = displayCourse(bundle, courseCode)
  const concepts = observationValues(bundle.conceptsCovered)
  const strengths = observationValues(bundle.strengthsObserved)
  const struggles = observationValues(bundle.strugglesObserved)
  const repairs = observationValues(bundle.successfulRepairs)
  const preferences = observationValues(bundle.learningPreferencesObserved)
  const mistakes = observationValues(bundle.recurringMistakesObserved)
  const adaptationResults = observationValues(bundle.adaptationResults)
  const questions = observationValues(bundle.openQuestions)
  const topic = stringValue(bundle.topic || concepts[0] || 'unspecified')
  const assignment = stringValue(bundle.assignment || bundle.assignmentId)
  const conceptLinks = concepts.map((concept) => `- ${relativeLink(`../concepts/${safeSegment(concept)}`)} — ${concept}`).join('\n')
  const assignmentLink = assignment ? `- Assignment: ${relativeLink(`../assignments/${safeSegment(assignment)}`)} — ${assignment}\n` : ''
  const rawLink = relativeLink(`raw/${safeSegment(bundle.sessionId, 'session')}.txt`)

  return [
    '---',
    'type: study-session',
    `course: ${yamlScalar(course)}`,
    `course_id: ${yamlScalar(bundle.courseId)}`,
    `topic: ${yamlScalar(topic)}`,
    `date: ${yamlScalar(bundle.sessionDate || '')}`,
    `session_id: ${yamlScalar(bundle.sessionId)}`,
    `concepts: ${yamlArray(concepts)}`,
    `strengths: ${yamlArray(strengths)}`,
    `struggles: ${yamlArray(struggles)}`,
    `successful_repairs: ${yamlArray(repairs)}`,
    `learning_preferences: ${yamlArray(preferences)}`,
    `recurring_mistakes: ${yamlArray(mistakes)}`,
    `open_questions: ${yamlArray(questions)}`,
    `confidence: ${yamlArray((bundle.confidence || []).map(confidenceText))}`,
    `adaptation_results: ${yamlArray(adaptationResults)}`,
    `assignment: ${yamlScalar(assignment)}`,
    `provenance: ${yamlScalar(bundle.provenance || 'inferred')}`,
    '---',
    '',
    `# ${topic} · ${bundle.sessionDate || 'undated'}`,
    '',
    '## Links',
    `- Course: ${relativeLink('../index')} — ${course}`,
    conceptLinks || '- Concepts: _not supplied._',
    assignmentLink.trim() || '- Assignment: _not supplied._',
    `- Raw capture: ${rawLink}`,
    `- Learner profile: ${relativeLink('../../learner/profile')}`,
    `- Learning preferences: ${relativeLink('../../learner/learning-preferences')}`,
    `- Recurring mistakes: ${relativeLink('../../learner/recurring-mistakes')}`,
    '',
    '## Session summary',
    '',
    `Captured from **${bundle.rawSession?.format || 'study'}**. The raw capture is preserved separately and this note is a derived, reviewable interpretation.`,
    '',
    observationSection('Concepts covered', bundle.conceptsCovered),
    observationSection('Strengths observed', bundle.strengthsObserved),
    observationSection('Struggles observed', bundle.strugglesObserved),
    observationSection('Successful repairs', bundle.successfulRepairs),
    observationSection('Learning preferences observed', bundle.learningPreferencesObserved),
    observationSection('Recurring mistakes observed', bundle.recurringMistakesObserved),
    observationSection('Adaptation check', bundle.adaptationResults),
    observationSection('Open questions', bundle.openQuestions),
    '## Evidence boundary',
    '',
    `Provenance: **${bundle.provenance || 'inferred'}**. Confidence notes are hypotheses to revisit, not permanent learner labels.`,
    bundle.confidence?.length ? `\n${bundle.confidence.map((item) => `- ${confidenceText(item)}${claimDetails(item)}`).join('\n')}` : '- No confidence rationale supplied.',
    '',
  ].join('\n').replace(/\n{3,}/g, '\n\n')
}

function profileHypotheses(profile = {}) {
  if (Array.isArray(profile.hypotheses) && profile.hypotheses.length) return profile.hypotheses
  const groups = [
    ['strength', profile.strengths],
    ['struggle', profile.weaknesses],
    ['repair', profile.improvements],
    ['learning_preference', profile.learningPreferences],
    ['recurring_mistake', profile.recurringMistakes],
  ]
  return groups.flatMap(([type, values]) => observationValues(values).map((text) => ({ type, text, confidence: null, evidenceRefs: [], revisitWhen: 'Revisit with a new session.' })))
}

function profileDocument(profile, title, type, filter) {
  const hypotheses = profileHypotheses(profile).filter((item) => filter(item))
  const body = hypotheses.length ? hypotheses.map((item) => [
    `### ${item.text}`,
    '',
    `- Status: **${item.status || 'hypothesis'}**`,
    `- Confidence: **${item.confidence == null ? 'not supplied' : `${Math.round(Number(item.confidence) * 100)}%`}**`,
    `- Evidence: ${item.evidenceRefs?.length ? item.evidenceRefs.join(', ') : '_not linked in this refresh._'}`,
    `- Revisit when: ${item.revisitWhen || 'new evidence changes the pattern.'}`,
    '',
  ].join('\n')).join('\n') : '_No evidence-backed hypotheses recorded yet._\n'
  return [
    '---',
    `type: ${type}`,
    'status: hypotheses',
    `based_on_sessions: ${profile.basedOnSessionCount || 0}`,
    `updated: ${profile.updatedAt || ''}`,
    '---',
    '',
    `# ${title}`,
    '',
    '> These observations are revisable hypotheses. They describe what has helped or hindered in recorded sessions; they do not permanently label the learner.',
    '',
    body,
  ].join('\n')
}

export function createLearnerProfileMarkdown(profile = {}) {
  return profileDocument(profile, 'Learner profile', 'learner-profile', () => true)
}

export function createLearningPreferencesMarkdown(profile = {}) {
  return profileDocument(profile, 'Learning preferences', 'learning-preferences', (item) => item.type === 'learning_preference')
}

export function createRecurringMistakesMarkdown(profile = {}) {
  return profileDocument(profile, 'Recurring mistakes', 'recurring-mistakes', (item) => item.type === 'recurring_mistake' || item.type === 'struggle')
}

export function createLearnerSignalMarkdown(claim = {}, { courseCode } = {}) {
  return [
    '---',
    'type: learner-signal',
    `course: ${yamlScalar(courseFolder(courseCode))}`,
    `session_id: ${yamlScalar(claim.sessionId)}`,
    `topic: ${yamlScalar(claim.topic || '')}`,
    `claim_type: ${yamlScalar(claim.type)}`,
    `status: ${yamlScalar(claim.status || 'hypothesis')}`,
    `confidence: ${claim.confidence == null ? 'null' : Number(claim.confidence)}`,
    `source_ref: ${yamlScalar(claim.sourceRef || '')}`,
    '---',
    '',
    `# ${claim.type || 'Learner signal'} · ${observationText(claim)}`,
    '',
    `**Hypothesis:** ${observationText(claim)}`,
    '',
    `**Evidence:** ${claim.sourceRef || 'not supplied'}`,
    '',
    `**Revisit when:** ${claim.revisitWhen || 'new evidence changes the pattern.'}`,
    '',
  ].join('\n')
}
