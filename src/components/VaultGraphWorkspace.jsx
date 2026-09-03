import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildMemoryGraph } from '../services/vaultGraph.js'
import { getStudyBridgeHealth, getVaultGraph, normalizeCourseId, readStudyMemory } from '../services/studyMemoryRuntime.js'

const TYPE_LABELS = {
  course: 'course',
  concept: 'concept',
  'study-session': 'study session',
  assignment: 'assignment',
  assessment: 'assessment',
  'learner-signal': 'learner evidence',
  'learner-profile': 'learner profile',
  material: 'material',
  note: 'note',
}

const TYPE_ORDER = ['concept', 'study-session', 'assignment', 'assessment', 'learner-signal', 'learner-profile', 'material', 'note', 'course']

function typeLabel(type) {
  return TYPE_LABELS[type] || type || 'note'
}

function displayLabel(value, length = 26) {
  const text = String(value || '')
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

function formatConfidence(value) {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) return value.join(', ')
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 1 ? `${Math.round(number * 100)}%` : String(value)
}

function layoutGraph(nodes) {
  const width = 760
  const height = 480
  const center = { x: width / 2, y: height / 2 }
  const course = nodes.find((node) => node.type === 'course')
  const peripheral = nodes.filter((node) => node.id !== course?.id)
  const positions = new Map()
  if (course) positions.set(course.id, { ...center })
  if (!peripheral.length) return positions

  const ringSize = 10
  const ringCount = Math.ceil(peripheral.length / ringSize)
  peripheral.forEach((node, index) => {
    const ring = Math.floor(index / ringSize)
    const start = ring * ringSize
    const count = Math.min(ringSize, peripheral.length - start)
    const angle = ((index - start) / count) * Math.PI * 2 - Math.PI / 2 + (ring % 2 ? 0.18 : -0.08)
    const radius = ringCount === 1 ? 158 : 104 + (ring / (ringCount - 1)) * 112
    positions.set(node.id, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius })
  })
  return positions
}

function nodeRadius(node) {
  if (node.type === 'course') return 18
  if (node.type === 'concept') return 12
  if (node.type === 'learner-profile') return 13
  return 9
}

function isEvidenceType(type) {
  return type === 'learner-signal' || type === 'learner-profile'
}

function GraphNode({ node, position, active, connected, onSelect }) {
  const radius = nodeRadius(node)
  const fillClass = `graph-node-mark graph-node-${node.type.replace(/[^a-z0-9]+/gi, '-')}`
  function select() { onSelect(node.id) }
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      select()
    }
  }
  return <g className={`graph-node ${active ? 'active' : ''} ${connected ? 'connected' : ''}`} role="button" aria-pressed={active} aria-label={`${node.label}, ${typeLabel(node.type)}`} tabIndex={0} transform={`translate(${position.x} ${position.y})`} onClick={select} onKeyDown={handleKeyDown}>
    <title>{`${node.label} · ${typeLabel(node.type)}${node.path ? ` · ${node.path}` : ''}`}</title>
    {node.type === 'learner-signal' ? <polygon className={fillClass} points={`0,-${radius} ${radius},0 0,${radius} -${radius},0`} /> : node.type === 'study-session' || node.type === 'assignment' || node.type === 'assessment' || node.type === 'material' ? <rect className={fillClass} x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx="2" /> : <circle className={fillClass} r={radius} />}
    {(active || node.type === 'course' || node.type === 'concept' || isEvidenceType(node.type)) && <text className="graph-node-label" y={radius + 15}>{displayLabel(node.label)}</text>}
  </g>
}

function metadataRows(node) {
  const metadata = node?.metadata || {}
  return [
    ['course', metadata.course],
    ['topic', metadata.topic],
    ['evidence', metadata.evidenceType],
    ['confidence', formatConfidence(metadata.confidence)],
    ['date', metadata.date],
    ['status', metadata.status],
  ].filter(([, value]) => value != null && value !== '')
}

function GraphDetails({ node, relatedNodes, onSelect }) {
  if (!node) return <aside className="graph-details"><div className="graph-detail-empty"><span>+</span><strong>Select a note.</strong><p>Click a concept, session, assignment, or learner signal to trace its evidence.</p></div></aside>
  const groups = TYPE_ORDER.map((type) => ({ type, nodes: relatedNodes.filter((item) => item.type === type) })).filter((group) => group.nodes.length)
  return <aside className="graph-details" aria-live="polite">
    <div className="graph-detail-header"><div><span className="graph-kicker">selected note</span><h2>{node.label}</h2></div><span className={`graph-type-badge graph-type-${node.type.replace(/[^a-z0-9]+/gi, '-')}`}>{typeLabel(node.type)}</span></div>
    {node.path && <code className="graph-detail-path">{node.path}</code>}
    {metadataRows(node).length > 0 && <dl className="graph-metadata">{metadataRows(node).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    <section className="graph-related"><div className="graph-section-heading"><span>connected evidence</span><small>within 2 links</small></div>{groups.length ? groups.map((group) => <div className="graph-related-group" key={group.type}><span className="graph-related-label">{typeLabel(group.type)}</span>{group.nodes.slice(0, 12).map((item) => <button type="button" key={item.id} onClick={() => onSelect(item.id)}><i className={`graph-mini-mark graph-node-${item.type.replace(/[^a-z0-9]+/gi, '-')}`} /><span>{item.label}</span><small>{item.metadata?.topic || item.metadata?.evidenceType || ''}</small></button>)}</div>) : <p className="graph-muted">No linked notes were found in this bounded scope.</p>}</section>
  </aside>
}

export default function VaultGraphWorkspace({ assignments = [], archivePending = 0, onBack }) {
  const initialMemory = useMemo(() => readStudyMemory(assignments), [assignments])
  const courses = initialMemory.courses?.length ? initialMemory.courses : [{ id: 'course', code: 'COURSE', name: 'Selected course' }]
  const [courseId, setCourseId] = useState(courses[0].id)
  const [topicInput, setTopicInput] = useState('')
  const [topic, setTopic] = useState('')
  const [graph, setGraph] = useState(() => buildMemoryGraph(initialMemory, courses[0].id))
  const [selectedId, setSelectedId] = useState('')
  const [status, setStatus] = useState('loading')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [bridge, setBridge] = useState(getStudyBridgeHealth)

  const loadGraph = useCallback(async (signal) => {
    setStatus('loading')
    setError('')
    try {
      const result = await getVaultGraph({ endpoint: bridge.endpoint, courseId, topic, secret: import.meta.env.VITE_STUDY_BRIDGE_SECRET || '', signal, memory: initialMemory })
      if (signal.aborted) return
      setGraph(result)
      setStatus(bridge.endpoint ? 'ready' : 'fallback')
      if (bridge.endpoint) setBridge((current) => ({ ...current, status: 'ready' }))
      if (!result.nodes?.length) setNotice(topic ? `No notes match “${topic}” in this course scope.` : 'No Markdown notes were found in this course scope yet.')
      else setNotice('')
    } catch (loadError) {
      if (signal.aborted) return
      setGraph(buildMemoryGraph(initialMemory, courseId, topic))
      setStatus('fallback')
      setBridge((current) => ({ ...current, status: 'offline' }))
      setNotice('Bridge unavailable · showing the browser compatibility cache. Obsidian remains the source of truth.')
      setError(loadError.message)
    }
  }, [bridge.endpoint, courseId, initialMemory, topic])

  useEffect(() => {
    const controller = new AbortController()
    loadGraph(controller.signal)
    return () => controller.abort()
  }, [loadGraph])

  useEffect(() => {
    if (graph.nodes.some((node) => node.id === selectedId)) return
    setSelectedId(graph.nodes.find((node) => node.type === 'concept')?.id || graph.nodes[0]?.id || '')
  }, [graph, selectedId])

  const positions = useMemo(() => layoutGraph(graph.nodes || []), [graph.nodes])
  const nodesById = useMemo(() => new Map((graph.nodes || []).map((node) => [node.id, node])), [graph.nodes])
  const selectedNode = nodesById.get(selectedId)
  const relatedNodes = useMemo(() => {
    if (!selectedId) return []
    const adjacency = new Map()
    ;(graph.edges || []).forEach((edge) => {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set())
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set())
      adjacency.get(edge.source).add(edge.target)
      adjacency.get(edge.target).add(edge.source)
    })
    const found = new Set()
    let frontier = new Set([selectedId])
    for (let depth = 0; depth < 2; depth += 1) {
      const next = new Set()
      frontier.forEach((id) => (adjacency.get(id) || []).forEach((neighbor) => { if (neighbor !== selectedId) { found.add(neighbor); next.add(neighbor) } }))
      frontier = next
    }
    return [...found].map((id) => nodesById.get(id)).filter(Boolean).sort((a, b) => (TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)) || a.label.localeCompare(b.label))
  }, [graph.edges, nodesById, selectedId])
  const connectedIds = useMemo(() => new Set(relatedNodes.map((node) => node.id)), [relatedNodes])
  const currentCourse = courses.find((course) => course.id === courseId) || courses[0]

  function applyTopic(event) {
    event.preventDefault()
    setTopic(topicInput.trim())
    setSelectedId('')
  }

  function clearTopic() {
    setTopicInput('')
    setTopic('')
    setSelectedId('')
  }

  function changeCourse(event) {
    setCourseId(normalizeCourseId(event.target.value))
    setSelectedId('')
  }

  function refresh() {
    const controller = new AbortController()
    loadGraph(controller.signal)
  }

  return <div className="graph-app">
    <header className="graph-topbar">
      <div className="graph-brand"><span>relay</span><i>/</i><strong>vault graph</strong></div>
      <div className="graph-topbar-actions"><span className={`graph-status-dot ${status === 'ready' ? 'ready' : status === 'fallback' ? 'fallback' : ''}`} /><span>{status === 'ready' ? 'obsidian live' : status === 'fallback' ? 'cache preview' : 'reading vault'}</span><button type="button" className="graph-ghost-button" onClick={refresh} disabled={status === 'loading'}>refresh graph</button><button type="button" className="graph-back" onClick={onBack}>← dashboard</button></div>
    </header>
    <div className="graph-shell">
      <aside className="graph-rail">
        <div className="graph-rail-heading"><span>bounded scope</span><small>read-only</small></div>
        <div className="graph-scope-note"><strong>{currentCourse?.code || courseId}</strong><span>{currentCourse?.name || 'course archive'}</span><small>Markdown notes + [[wikilinks]]</small></div>
        <label className="graph-control">course<select value={courseId} onChange={changeCourse}>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}{!courses.some((course) => course.id === courseId) && <option value={courseId}>{courseId}</option>}</select></label>
        <form className="graph-topic-form" onSubmit={applyTopic}><label className="graph-control">topic<input value={topicInput} onChange={(event) => setTopicInput(event.target.value)} placeholder="recursion" /></label><button type="submit" className="graph-primary-button">focus scope</button></form>
        {topic && <button type="button" className="graph-clear-button" onClick={clearTopic}>show entire course ↗</button>}
        <div className="graph-rail-label">node types</div>
        <div className="graph-legend"><LegendItem type="concept" label="concept" /><LegendItem type="study-session" label="study session" /><LegendItem type="assignment" label="assignment" /><LegendItem type="learner-signal" label="learner evidence" /><LegendItem type="learner-profile" label="profile note" /></div>
        <div className="graph-rail-footer"><strong>Obsidian is canonical</strong><span>{bridge.endpoint ? 'The bridge reads the selected vault scope.' : 'Configure the local bridge to read Markdown directly.'}</span>{archivePending > 0 && <small>{archivePending} source{archivePending === 1 ? '' : 's'} waiting in the dashboard archive queue.</small>}</div>
      </aside>
      <main className="graph-main">
        <header className="graph-page-header"><div><div className="graph-breadcrumb"><span>{currentCourse?.code || courseId}</span><i>/</i><span>{topic ? `topic · ${topic}` : 'course graph'}</span></div><h1>See the evidence connect.</h1><p>Trace concepts through study sessions, assignments, mistakes, and learner-profile notes while the vault stays the source of truth.</p></div><div className="graph-counts"><strong>{graph.nodes?.length || 0}</strong><span>notes</span><i>·</i><strong>{graph.edges?.length || 0}</strong><span>links</span></div></header>
        {(notice || error) && <div className={`graph-notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><span>{error ? '!' : '·'}</span><p>{notice}{error ? ` ${error}` : ''}</p><button type="button" onClick={() => { setNotice(''); setError('') }} aria-label="Dismiss message">×</button></div>}
        <div className="graph-content">
          <section className="graph-visual-section" aria-labelledby="graph-visual-title"><div className="graph-section-heading"><div><span className="graph-kicker">{topic ? 'topic neighborhood' : 'course neighborhood'}</span><h2 id="graph-visual-title">{status === 'loading' ? 'Reading Markdown…' : graph.nodes?.length ? 'Linked notes' : 'No notes in scope'}</h2></div><small>{graph.scope || 'course'}</small></div>{graph.nodes?.length ? <svg className="vault-graph" viewBox="0 0 760 480" role="group" aria-labelledby="graph-title graph-description"><title id="graph-title">{currentCourse?.code || courseId} Obsidian vault graph</title><desc id="graph-description">{graph.nodes.length} notes connected by {graph.edges.length} wikilinks. Select a node to inspect its metadata and nearby evidence.</desc><g className="graph-edges">{graph.edges.map((edge) => { const source = positions.get(edge.source); const target = positions.get(edge.target); if (!source || !target) return null; const active = edge.source === selectedId || edge.target === selectedId; return <line key={`${edge.source}-${edge.target}`} className={active ? 'active' : ''} x1={source.x} y1={source.y} x2={target.x} y2={target.y} /> })}</g><g className="graph-nodes">{graph.nodes.map((node) => { const position = positions.get(node.id); return position ? <GraphNode key={node.id} node={node} position={position} active={node.id === selectedId} connected={connectedIds.has(node.id)} onSelect={setSelectedId} /> : null })}</g></svg> : <div className="graph-empty"><span>∅</span><strong>{topic ? 'No matching notes.' : 'The course folder is quiet.'}</strong><p>{topic ? 'Try a broader topic or show the whole course.' : 'Commit a Markdown note through the bridge, then refresh this graph.'}</p></div>}<div className="graph-visual-footer"><span>scope: {topic ? `course + “${topic}” + 2-hop context` : 'selected course + learner profile'}</span><span>generated {graph.generatedAt ? new Date(graph.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'locally'}</span></div></section>
          <GraphDetails node={selectedNode} relatedNodes={relatedNodes} onSelect={setSelectedId} />
        </div>
      </main>
    </div>
  </div>
}

function LegendItem({ type, label }) {
  return <div className="graph-legend-item"><i className={`graph-mini-mark graph-node-${type.replace(/[^a-z0-9]+/gi, '-')}`} /><span>{label}</span></div>
}
