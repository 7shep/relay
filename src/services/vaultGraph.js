const DEFAULT_MAX_NODES = 180

const TYPE_ORDER = {
  course: 0,
  concept: 1,
  'study-session': 2,
  assignment: 3,
  assessment: 4,
  'learner-signal': 5,
  'learner-profile': 6,
  material: 7,
  note: 8,
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/\/\.\//g, '/')
}

function stripMarkdownExtension(value) {
  return normalizePath(value).replace(/\.md$/i, '')
}

function splitYamlList(value) {
  const text = String(value || '').trim().replace(/^\[/, '').replace(/\]$/, '')
  if (!text) return []
  const values = []
  let current = ''
  let quote = ''
  for (const character of text) {
    if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote ? '' : character
      current += character
    } else if (character === ',' && !quote) {
      values.push(current.trim())
      current = ''
    } else current += character
  }
  values.push(current.trim())
  return values.filter(Boolean).map(parseYamlValue)
}

function parseYamlValue(value) {
  const text = String(value ?? '').trim()
  if ((text.startsWith('[') && text.endsWith(']'))) return splitYamlList(text)
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1).replace(/\\([\\"'])/g, '$1')
  if (text === 'null' || text === '~') return null
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  return text
}

export function parseMarkdownFrontmatter(content = '') {
  const source = String(content)
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return {}
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const separator = line.indexOf(':')
    if (separator < 1) return null
    return [line.slice(0, separator).trim(), parseYamlValue(line.slice(separator + 1))]
  }).filter(Boolean))
}

export function parseWikilinks(content = '') {
  const links = []
  const pattern = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g
  let match
  while ((match = pattern.exec(String(content)))) {
    const target = normalizePath(match[1]).trim()
    if (target) links.push({ target, label: String(match[2] || '').trim() })
  }
  return links
}

function inferredType(path, frontmatter) {
  if (frontmatter.type) return String(frontmatter.type)
  const normalized = normalizePath(path).toLowerCase()
  if (normalized.includes('/concepts/')) return 'concept'
  if (normalized.includes('/sessions/')) return 'study-session'
  if (normalized.includes('/assignments/')) return 'assignment'
  if (normalized.includes('/learner/signals/')) return 'learner-signal'
  if (normalized.endsWith('/learner/profile.md')) return 'learner-profile'
  if (normalized.endsWith('/learner/learning-preferences.md')) return 'learner-profile'
  if (normalized.endsWith('/learner/recurring-mistakes.md')) return 'learner-profile'
  if (normalized.endsWith('/index.md')) return 'course'
  return 'note'
}

function headingFrom(content) {
  return String(content).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').match(/^#\s+(.+)$/m)?.[1]?.trim() || ''
}

function basename(path) {
  return stripMarkdownExtension(path).split('/').pop() || 'note'
}

function labelFor(path, content, frontmatter, type) {
  if (type === 'concept') return String(frontmatter.topic || headingFrom(content) || basename(path)).trim()
  if (type === 'assignment') return String(frontmatter.assignment || headingFrom(content) || basename(path)).trim()
  if (type === 'study-session') return String(frontmatter.session_id || frontmatter.topic || headingFrom(content) || basename(path)).trim()
  if (type === 'learner-signal') return String(headingFrom(content) || frontmatter.claim_type || basename(path)).trim()
  return String(frontmatter.title || headingFrom(content) || frontmatter.course || basename(path)).trim()
}

function graphIdForPath(path, courseId) {
  const normalized = stripMarkdownExtension(path)
  const coursePrefix = `courses/${String(courseId || '').toUpperCase()}/`.toLowerCase()
  const lower = normalized.toLowerCase()
  if (coursePrefix && lower.startsWith(coursePrefix)) return normalized.slice(coursePrefix.length)
  if (lower.startsWith('learner/')) return normalized
  return normalized
}

function nodeFromNote(note, courseId) {
  const path = normalizePath(note.path)
  const frontmatter = parseMarkdownFrontmatter(note.content)
  const type = inferredType(path, frontmatter)
  const id = graphIdForPath(path, courseId)
  const confidence = frontmatter.confidence
  return {
    id,
    label: labelFor(path, note.content, frontmatter, type),
    type,
    path,
    metadata: {
      course: frontmatter.course || courseId || null,
      topic: frontmatter.topic || '',
      confidence: confidence ?? null,
      evidenceType: frontmatter.evidence_type || frontmatter.evidenceType || frontmatter.claim_type || frontmatter.type || type,
      date: frontmatter.date || null,
      sessionId: frontmatter.session_id || null,
      assignment: frontmatter.assignment || null,
      status: frontmatter.status || null,
    },
    _links: parseWikilinks(note.content),
  }
}

function normalizeRelativePath(path) {
  const pieces = []
  for (const piece of normalizePath(path).split('/')) {
    if (!piece || piece === '.') continue
    if (piece === '..') pieces.pop()
    else pieces.push(piece)
  }
  return pieces.join('/')
}

function targetCandidates(sourceId, target) {
  const clean = stripMarkdownExtension(String(target || '').split('#')[0]).replace(/^\//, '')
  const resolved = normalizeRelativePath(`${sourceId.split('/').slice(0, -1).join('/')}/${clean}`)
  const candidates = [resolved, clean]
  const rootLearner = clean.match(/^(?:\.\.\/)+(.+)$/)?.[1]
  if (rootLearner?.startsWith('learner/')) candidates.push(rootLearner)
  if (resolved.startsWith('../learner/')) candidates.push(resolved.slice(3))
  return [...new Set(candidates)]
}

function resolveLink(sourceId, target, nodesById, nodesByBasename) {
  for (const candidate of targetCandidates(sourceId, target)) {
    if (nodesById.has(candidate)) return candidate
  }
  const base = basename(target).toLowerCase()
  return nodesByBasename.get(base) || ''
}

function matchesTopic(node, topic) {
  const needle = String(topic || '').trim().toLowerCase()
  if (!needle) return true
  const values = [node.id, node.label, node.metadata?.topic, node.metadata?.assignment, node.metadata?.evidenceType]
  return values.some((value) => String(value || '').toLowerCase().includes(needle))
}

function finishGraph(nodes, edges, { courseId = '', topic = '', maxNodes = DEFAULT_MAX_NODES, scope = 'course' } = {}) {
  const uniqueNodes = [...new Map(nodes.filter((node) => node?.id).map((node) => [node.id, node])).values()]
  const uniqueEdges = [...new Map(edges.filter((edge) => edge?.source && edge?.target && edge.source !== edge.target).map((edge) => [`${edge.source}->${edge.target}`, { source: edge.source, target: edge.target }])).values()]
  const selected = new Set(uniqueNodes.filter((node) => matchesTopic(node, topic)).map((node) => node.id))
  if (topic) {
    const neighbors = new Map()
    uniqueEdges.forEach((edge) => {
      if (!neighbors.has(edge.source)) neighbors.set(edge.source, new Set())
      if (!neighbors.has(edge.target)) neighbors.set(edge.target, new Set())
      neighbors.get(edge.source).add(edge.target)
      neighbors.get(edge.target).add(edge.source)
    })
    let frontier = new Set(selected)
    for (let depth = 0; depth < 2; depth += 1) {
      const next = new Set()
      frontier.forEach((id) => (neighbors.get(id) || []).forEach((neighbor) => next.add(neighbor)))
      next.forEach((id) => selected.add(id))
      frontier = next
    }
  }
  const visible = (topic ? uniqueNodes.filter((node) => selected.has(node.id)) : uniqueNodes)
    .sort((a, b) => (TYPE_ORDER[a.type] ?? TYPE_ORDER.note) - (TYPE_ORDER[b.type] ?? TYPE_ORDER.note) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(DEFAULT_MAX_NODES, Number(maxNodes) || DEFAULT_MAX_NODES)))
  const visibleIds = new Set(visible.map((node) => node.id))
  return {
    courseId,
    topic: String(topic || '').trim(),
    scope,
    generatedAt: new Date().toISOString(),
    nodes: visible.map(({ _links, ...node }) => node),
    edges: uniqueEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    stats: { notes: uniqueNodes.length, nodes: visible.length, edges: uniqueEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).length },
  }
}

export function buildVaultGraph(notes = [], options = {}) {
  const normalizedNotes = Array.isArray(notes) ? notes : []
  const rawNodes = normalizedNotes.map((note) => nodeFromNote(note, options.courseId))
  const nodesById = new Map(rawNodes.map((node) => [node.id, node]))
  const nodesByBasename = new Map()
  rawNodes.forEach((node) => {
    const key = basename(node.id).toLowerCase()
    if (!nodesByBasename.has(key)) nodesByBasename.set(key, node.id)
  })
  const edges = rawNodes.flatMap((node) => node._links.map((link) => {
    const target = resolveLink(node.id, link.target, nodesById, nodesByBasename)
    return target ? { source: node.id, target } : null
  }).filter(Boolean))
  return finishGraph(rawNodes, edges, options)
}

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'note'
}

function cacheNode(id, label, type, metadata = {}) {
  return { id, label: String(label || id), type, path: id.endsWith('.md') ? id : `${id}.md`, metadata }
}

export function buildMemoryGraph(memory = {}, courseId = '', topic = '') {
  const course = (memory.courses || []).find((item) => item.id === courseId) || memory.courses?.[0]
  const selectedCourseId = course?.id || courseId || ''
  const nodes = [cacheNode('index', course?.code || selectedCourseId || 'course', 'course', { course: selectedCourseId, topic: course?.name || '' })]
  const edges = []
  const concepts = new Map()
  const addConcept = (value, sourceId) => {
    const label = typeof value === 'string' ? value : value?.name || value?.text
    if (!label) return
    const id = `concepts/${slug(label)}`
    if (!concepts.has(id)) nodes.push(cacheNode(id, label, 'concept', { course: selectedCourseId, topic: label }))
    concepts.set(id, label)
    edges.push({ source: sourceId, target: id })
  }
  ;(memory.assignments || []).filter((item) => item.courseId === selectedCourseId).forEach((item) => {
    const id = `assignments/${slug(item.title || item.id)}`
    nodes.push(cacheNode(id, item.title || item.id, 'assignment', { course: selectedCourseId, assignment: item.title, date: item.dueAt || null }))
    edges.push({ source: 'index', target: id })
  })
  ;(memory.sessions || []).filter((item) => item.courseId === selectedCourseId).forEach((session) => {
    const id = `sessions/${slug(session.id)}`
    nodes.push(cacheNode(id, session.id, 'study-session', { course: selectedCourseId, topic: session.topic || '', date: session.sessionDate || null, sessionId: session.id }))
    edges.push({ source: 'index', target: id })
    ;(session.concepts || []).forEach((concept) => addConcept(concept, id))
    if (session.assignment || session.assignmentId) {
      const assignmentId = `assignments/${slug(session.assignment || session.assignmentId)}`
      if (!nodes.some((node) => node.id === assignmentId)) nodes.push(cacheNode(assignmentId, session.assignment || session.assignmentId, 'assignment', { course: selectedCourseId, assignment: session.assignment || session.assignmentId }))
      edges.push({ source: id, target: assignmentId })
    }
  })
  ;(memory.learnerClaims || []).filter((item) => item.courseId === selectedCourseId && item.status !== 'superseded').forEach((claim) => {
    const id = `learner/signals/${slug(claim.id || claim.text)}`
    nodes.push(cacheNode(id, claim.text || claim.evidence || claim.type, 'learner-signal', { course: selectedCourseId, topic: claim.topic || '', confidence: claim.confidence ?? null, evidenceType: claim.type, status: claim.status || null, sessionId: claim.sessionId || null }))
    if (claim.sessionId) edges.push({ source: `sessions/${slug(claim.sessionId)}`, target: id })
    else edges.push({ source: 'index', target: id })
    if (claim.topic) addConcept(claim.topic, id)
  })
  const profileTypes = [
    ['learner/profile', 'learner profile', 'learner-profile'],
    ['learner/learning-preferences', 'learning preferences', 'learner-profile'],
    ['learner/recurring-mistakes', 'recurring mistakes', 'learner-profile'],
  ]
  profileTypes.forEach(([id, label, type]) => {
    const hasEvidence = id.endsWith('profile') ? (memory.tutorProfile?.hypotheses || []).length : id.includes('preferences') ? (memory.tutorProfile?.learningPreferences || []).length : (memory.tutorProfile?.recurringMistakes || []).length
    if (hasEvidence) {
      nodes.push(cacheNode(id, label, type, { course: selectedCourseId, evidenceType: id.split('/').pop() }))
      ;(memory.learnerClaims || []).filter((claim) => claim.courseId === selectedCourseId && claim.status !== 'superseded' && ((id.includes('preferences') && claim.type === 'learning_preference') || (id.includes('mistakes') && ['recurring_mistake', 'struggle'].includes(claim.type)) || id.endsWith('profile'))).forEach((claim) => edges.push({ source: `learner/signals/${slug(claim.id || claim.text)}`, target: id }))
    }
  })
  return finishGraph(nodes, edges, { courseId: selectedCourseId, topic, scope: 'browser compatibility cache' })
}

export { DEFAULT_MAX_NODES }
