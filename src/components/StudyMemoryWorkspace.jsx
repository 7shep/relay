import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addOperation,
  approveOperation,
  buildCourseContext,
  cancelOperation,
  courseFromRoute,
  commitAssessmentOperation,
  commitMaterialOperation,
  commitOperation,
  createSessionBundle,
  downloadJson,
  getStudyBridgeHealth,
  getStudyCourseContext,
  pingStudyBridge,
  proposeStudyMaterial,
  proposeStudySession,
  approveStudyOperation,
  commitStudyOperation,
  proposeAssessmentEvidence,
  proposeLearnerMutation,
  proposeMaterialIngest,
  proposeSaveSession,
  readStudyMemory,
  saveJsonToStudySessions,
  saveObsidianSessionToVault,
  saveMaterialToStudyContext,
  validateSessionBundle,
  writeStudyMemory,
} from '../services/studyMemoryRuntime.js'
import { readSyllabusFile } from '../services/syllabus.js'

const emptyQuestion = { assessmentTitle: '', number: '', prompt: '', studentAnswer: '', officialAnswer: '', correction: '', concept: '', questionType: 'application', earned: '', possible: '', sourceRef: '' }

function formatDate(value) {
  if (!value) return 'date not set'
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function labelFor(value) {
  return String(value || '').replace(/_/g, ' ')
}

export default function StudyMemoryWorkspace({ assignments = [], incomingMaterials = [], onBack }) {
  const initial = useMemo(() => readStudyMemory(assignments), [assignments])
  const [memory, setMemory] = useState(initial)
  const [courseId, setCourseId] = useState(initial.courses[0]?.id || '')
  const [view, setView] = useState('overview')
  const [proposal, setProposal] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [bridge, setBridge] = useState(getStudyBridgeHealth)
  const [isBusy, setIsBusy] = useState(false)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [question, setQuestion] = useState(emptyQuestion)
  const [showAssignmentImport, setShowAssignmentImport] = useState(false)
  const [assignmentCode, setAssignmentCode] = useState('')
  const [assignmentFile, setAssignmentFile] = useState(null)
  const sessionInputRef = useRef(null)
  const materialInputRef = useRef(null)
  const assignmentInputRef = useRef(null)
  const consumedMaterialsRef = useRef(new Set())

  useEffect(() => writeStudyMemory(memory), [memory])

  const course = memory.courses.find((item) => item.id === courseId) || memory.courses[0]
  const sessions = memory.sessions.filter((item) => item.courseId === course?.id).slice().reverse()
  const artifacts = memory.artifacts.filter((item) => item.courseId === course?.id)
  const claims = memory.learnerClaims.filter((item) => item.courseId === course?.id && item.status !== 'superseded')
  const questions = memory.questionEvidence.filter((item) => item.courseId === course?.id)
  const operations = memory.operations.filter((item) => item.courseId === course?.id).slice().reverse()
  const context = buildCourseContext(memory, course?.id)
  const pendingOperations = operations.filter((item) => ['proposed', 'approved', 'failed'].includes(item.status))

  useEffect(() => {
    const unconsumed = incomingMaterials.filter((item) => item?.name && !consumedMaterialsRef.current.has(`${item.name}:${item.sourceHash || item.byteLength || ''}`))
    if (!unconsumed.length) return
    let cancelled = false
    ;(async () => {
      let working = memory
      let lastOperation = null
      for (const source of unconsumed) {
        const key = `${source.name}:${source.sourceHash || source.byteLength || ''}`
        consumedMaterialsRef.current.add(key)
        const routed = courseFromRoute(working, { courseId: source.courseId, courseLabel: source.courseLabel, confidence: 1, evidence: source.routeEvidence || source.sourceRouteEvidence || `user-confirmed class for ${source.name}` })
        if (source.sourceHash && working.operations.some((item) => item.type === 'ingest_course_material' && item.courseId === routed.route.courseId && item.contentHash === source.sourceHash && item.status !== 'cancelled')) continue
        const operation = await proposeMaterialIngest(routed.memory, { courseId: routed.route.courseId, name: source.name, sourceType: source.sourceType || 'syllabus', originalContent: source.originalContent, originalBytesBase64: source.originalBytesBase64, byteLength: source.byteLength, extractedText: source.text || '', derivedAssignments: source.derivedAssignments || [], parseStatus: source.parseStatus || 'parsed', sourceHash: source.sourceHash || '' })
        working = addOperation(routed.memory, operation)
        lastOperation = operation
      }
      if (!cancelled) {
        setMemory(working)
        if (lastOperation) {
          setCourseId(lastOperation.courseId)
          setProposal(lastOperation)
          setView('operations')
          showNotice('archive proposal ready · review the exact destination before approval')
        }
      }
    })().catch((intakeError) => { if (!cancelled) showError(intakeError.message) })
    return () => { cancelled = true }
  }, [incomingMaterials])

  function showNotice(message) {
    setError('')
    setNotice(message)
  }

  function showError(message) {
    setNotice('')
    setError(message)
  }

  async function importSession(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setIsBusy(true); setError('')
    try {
      const text = await file.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = null }
      const candidate = parsed?.bundle || parsed
      const bundle = candidate?.schemaVersion ? candidate : createSessionBundle({ courseId: course.id, sessionId: file.name.replace(/\.[^.]+$/, ''), rawSession: { format: 'chat-export', content: text }, openQuestions: ['Summary fields were not supplied; review this raw export before saving.'], provenance: 'user_provided' })
      const validation = validateSessionBundle(bundle)
      if (!validation.valid) throw new Error(validation.errors.join('; '))
      const operation = await proposeSaveSession(memory, bundle, bundle.courseId || course.id)
      setMemory((current) => addOperation(current, operation))
      setProposal(operation)
      showNotice('proposal ready · no course files have changed')
    } catch (importError) {
      showError(importError.message)
    } finally { setIsBusy(false) }
  }

  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
    return `data:application/octet-stream;base64,${btoa(binary)}`
  }

  async function importMaterial(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setIsBusy(true); setError('')
    try {
      const extracted = await readSyllabusFile(file)
      const originalContent = /\.pdf$/i.test(file.name) ? toBase64(await file.arrayBuffer()) : await file.text()
      const operation = await proposeMaterialIngest(memory, { courseId: course.id, name: file.name, sourceType: 'course material', originalContent, originalBytesBase64: extracted.originalBytesBase64, byteLength: extracted.byteLength, extractedText: extracted.text })
      setMemory((current) => addOperation(current, operation))
      setProposal(operation)
      showNotice('material proposal ready · original bytes will remain immutable')
    } catch (importError) { showError(importError.message) } finally { setIsBusy(false) }
  }

  async function exportBundle() {
    if (!proposal?.bundle) return
    try {
      const result = await saveJsonToStudySessions(proposal.bundle, proposal.bundle)
      showNotice(`${result.path} ${result.mode === 'filesystem' ? 'saved' : 'downloaded'} · nothing was committed`)
    } catch (exportError) { showError(exportError.message) }
  }

  async function approveAndCommit() {
    if (!proposal) return
    try {
      const approved = approveOperation(memory, proposal.id)
      let committed = approved.memory
      if (proposal.type === 'save_session') {
        const locallyCommitted = commitOperation(committed, proposal.id, approved.operation.approvalToken)
        if (bridge.endpoint) {
          const remoteProposal = await proposeStudySession({ endpoint: bridge.endpoint, secret: import.meta.env.VITE_STUDY_BRIDGE_SECRET || '', operation: approved.operation })
          const remoteApproved = await approveStudyOperation({ endpoint: bridge.endpoint, secret: import.meta.env.VITE_STUDY_BRIDGE_SECRET || '', operationId: remoteProposal.id })
          const remoteCommitted = await commitStudyOperation({ endpoint: bridge.endpoint, secret: import.meta.env.VITE_STUDY_BRIDGE_SECRET || '', operationId: remoteProposal.id, approvalToken: remoteApproved.approvalToken })
          if (remoteCommitted.status !== 'committed') throw new Error(remoteCommitted.reason || 'Obsidian bridge did not commit the session')
          committed = { ...locallyCommitted, vault: { ...locallyCommitted.vault, status: 'synced', lastSyncAt: new Date().toISOString(), error: '' } }
        } else {
          const saved = await saveObsidianSessionToVault(proposal.bundle, locallyCommitted)
          committed = { ...locallyCommitted, vault: { ...locallyCommitted.vault, status: saved.mode === 'filesystem' ? 'synced' : 'manual download', lastSyncAt: new Date().toISOString(), error: '' } }
        }
      }
      if (proposal.type === 'ingest_course_material') {
        if (bridge.endpoint) {
          const remoteProposal = await proposeStudyMaterial({ endpoint: bridge.endpoint, secret: import.meta.env.VITE_STUDY_BRIDGE_SECRET || '', operation: approved.operation })
          const remoteApproved = await approveStudyOperation({ endpoint: bridge.endpoint, secret: import.meta.env.VITE_STUDY_BRIDGE_SECRET || '', operationId: remoteProposal.id })
          const remoteCommitted = await commitStudyOperation({ endpoint: bridge.endpoint, secret: import.meta.env.VITE_STUDY_BRIDGE_SECRET || '', operationId: remoteProposal.id, approvalToken: remoteApproved.approvalToken })
          if (remoteCommitted.status !== 'committed') throw new Error(remoteCommitted.reason || 'Bridge did not commit the material')
        } else {
          await saveMaterialToStudyContext(approved.operation)
        }
        committed = commitMaterialOperation(committed, proposal.id, approved.operation.approvalToken)
      }
      if (proposal.type === 'record_assessment_evidence') committed = commitAssessmentOperation(committed, proposal.id, approved.operation.approvalToken)
      if (proposal.type === 'propose_learner_update') committed = commitOperation(committed, proposal.id, approved.operation.approvalToken)
      setMemory(committed)
      setProposal(null)
      const operationResult = committed.operations.find((item) => item.id === proposal.id)
      if (operationResult?.status === 'failed') showNotice('duplicate retained · no files were overwritten')
      else if (proposal.type === 'ingest_course_material') showNotice(bridge.endpoint ? 'archive committed · manifest updated' : 'manual archive committed · manifest updated')
      else if (proposal.type === 'save_session') showNotice(bridge.endpoint ? 'committed · Obsidian session note synced' : 'committed · Obsidian session note exported')
      else showNotice('committed · learner hypothesis revision recorded')
    } catch (commitError) { showError(commitError.message) }
  }

  function cancelProposal() {
    if (!proposal) return
    try { setMemory(cancelOperation(memory, proposal.id)); setProposal(null); showNotice('proposal cancelled · no course files changed') } catch (cancelError) { showError(cancelError.message) }
  }

  async function checkBridge() {
    setIsBusy(true); setError('')
    try { const secret = import.meta.env.VITE_STUDY_BRIDGE_SECRET || ''; const health = await pingStudyBridge({ endpoint: bridge.endpoint, secret }); await getStudyCourseContext({ endpoint: bridge.endpoint, courseId: course.id, secret }); setBridge({ ...health, contextStatus: 'ready' }); showNotice('bridge ping + course context succeeded · read-only connection verified') } catch (bridgeError) { setBridge({ ...bridge, status: 'offline', message: bridgeError.message }); showError(`${bridgeError.message} · manual export/import remains available`) } finally { setIsBusy(false) }
  }

  function queueClaimChange(claim, action, updates = {}) {
    try {
      const operation = proposeLearnerMutation(memory, { courseId: course.id, claimId: claim.id, action, updates })
      setMemory((current) => addOperation(current, operation)); setProposal(operation); showNotice('learner-record proposal ready · review before approval')
    } catch (claimError) { showError(claimError.message) }
  }

  function addQuestion(event) {
    event.preventDefault()
    try {
      const operation = proposeAssessmentEvidence(memory, { courseId: course.id, assessmentTitle: question.assessmentTitle, question })
      setMemory((current) => addOperation(current, operation)); setProposal(operation); setShowQuestionForm(false); setQuestion(emptyQuestion); showNotice('assessment evidence proposal ready · missing fields stay explicit')
    } catch (questionError) { showError(questionError.message) }
  }

  function openAssignmentImport() {
    setAssignmentCode(course?.code || '')
    setAssignmentFile(null)
    setShowAssignmentImport(true)
  }

  async function chooseAssignmentFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!/\.pdf$/i.test(file.name)) { showError('Assignment handoff accepts the original PDF only.'); return }
    setAssignmentFile(file)
    return
    /* legacy proposal path intentionally disabled; confirmation owns proposal creation
      setMemory((current) => addOperation(routed.memory, operation)); setProposal(operation); setShowAssignmentImport(false); setView('operations'); showNotice('assignment PDF proposal ready · Relay approval is still required')
    */
  }

  async function confirmAssignmentFile() {
    if (!assignmentFile) return
    setIsBusy(true); setError('')
    try {
      const code = assignmentCode.trim()
      const routed = courseFromRoute(memory, { courseId: code, courseLabel: code, confidence: 1, evidence: 'user-confirmed class for assignment PDF' })
      if (routed.route.needsClassName || code.length < 2) throw new Error('Enter a valid course code or display name before importing the PDF.')
      const extracted = await readSyllabusFile(assignmentFile)
      const operation = await proposeMaterialIngest(routed.memory, { courseId: routed.route.courseId, name: assignmentFile.name, sourceType: 'assignment', originalBytesBase64: extracted.originalBytesBase64, byteLength: extracted.byteLength, extractedText: extracted.text, assignmentId: assignments.find((item) => item.courseId === routed.route.courseId)?.id || null, parseStatus: 'parsed' })
      setMemory((current) => addOperation(routed.memory, operation)); setProposal(operation); setShowAssignmentImport(false); setAssignmentFile(null); setView('operations'); showNotice('assignment PDF proposal ready · Relay approval is still required')
    } catch (importError) { showError(importError.message) } finally { setIsBusy(false) }
  }

  return <div className="memory-app">
    <header className="memory-topbar">
      <div className="memory-brand"><span>relay</span><i>/</i><strong>study memory</strong></div>
      <div className="memory-topbar-actions"><span className={`memory-status-dot ${bridge.status === 'ready' ? 'ready' : ''}`} /><span>{bridge.status}</span><button type="button" className="memory-ghost-button" onClick={checkBridge} disabled={isBusy}>ping bridge</button><button type="button" className="memory-back" onClick={onBack}>← dashboard</button></div>
    </header>
    <div className="memory-shell">
      <aside className="memory-rail">
        <div className="memory-rail-title"><span>local archive</span><small>file-first</small></div>
        <div className="memory-root"><span>root</span><strong>{memory.rootName}/</strong><small>canonical · browser cache is compatibility only</small></div>
        <div className="memory-rail-label">courses</div>
        <div className="memory-courses">{memory.courses.map((item) => <button key={item.id} type="button" className={item.id === course?.id ? 'active' : ''} onClick={() => setCourseId(item.id)}><i className={`memory-course-dot ${item.color}`} /><span><strong>{item.code}</strong><small>{item.name}</small></span></button>)}</div>
        <div className="memory-rail-label">capture</div>
        <button type="button" className="memory-rail-action" onClick={openAssignmentImport}>+ handoff assignment PDF</button>
        <button type="button" className="memory-rail-action" onClick={() => sessionInputRef.current?.click()}>＋ import study session</button>
        <button type="button" className="memory-rail-action" onClick={() => materialInputRef.current?.click()}>＋ add course material</button>
        <div className="memory-rail-label memory-rail-spacer">review</div>
        {['overview', 'sessions', 'evidence', 'operations'].map((item) => <button key={item} type="button" className={`memory-view-link ${view === item ? 'active' : ''}`} onClick={() => setView(item)}><span>{item === 'overview' ? '◈' : item === 'sessions' ? '◌' : item === 'evidence' ? '◇' : '↻'}</span>{item}<small>{item === 'sessions' ? sessions.length : item === 'evidence' ? claims.length + questions.length : item === 'operations' ? operations.length : ''}</small></button>)}
        <div className="memory-rail-footer"><strong>privacy default</strong><span>course files stay on this machine</span><small>no automatic ChatGPT capture</small></div>
      </aside>
      <main className="memory-main">
        <header className="memory-page-header"><div><div className="memory-breadcrumb"><span>{course?.code}</span><i>/</i><span>local course archive</span></div><h1>Memory that compounds.</h1><p>Bring the evidence out of a ChatGPT study session, review what it claims, and decide what becomes part of your course record.</p></div><div className="memory-course-chip"><span className="memory-course-dot green" /><strong>{course?.code}</strong><small>{course?.name}</small></div></header>
        {(notice || error) && <div className={`memory-notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><span>{error ? '!' : '✓'}</span><p>{error || notice}</p><button type="button" onClick={() => { setNotice(''); setError('') }} aria-label="Dismiss message">×</button></div>}
        {view === 'overview' && <Overview course={course} sessions={sessions} artifacts={artifacts} claims={claims} questions={questions} vault={memory.vault} pendingOperations={pendingOperations} onImport={() => sessionInputRef.current?.click()} onViewEvidence={() => setView('evidence')} />}
        {view === 'sessions' && <SessionList sessions={sessions} artifacts={artifacts} onImport={() => sessionInputRef.current?.click()} />}
        {view === 'evidence' && <EvidenceList claims={claims} questions={questions} onCorrect={(claim) => queueClaimChange(claim, 'revise', { evidence: `${claim.evidence} (reviewed by student)` })} onDelete={(claim) => queueClaimChange(claim, 'delete')} onAddQuestion={() => setShowQuestionForm(true)} />}
        {view === 'operations' && <OperationList operations={operations} onReview={(item) => setProposal(item)} />}
        {showQuestionForm && <QuestionForm value={question} onChange={setQuestion} onSubmit={addQuestion} onCancel={() => setShowQuestionForm(false)} />}
      </main>
      <aside className="memory-context-pane">
        <section className="memory-context-head"><span className="memory-eyebrow">selected course</span><h2>{course?.code}</h2><p>{course?.name} · {course?.term}</p></section>
        <section className="memory-stats"><div><strong>{sessions.length}</strong><span>sessions</span></div><div><strong>{artifacts.length}</strong><span>artifacts</span></div><div><strong>{claims.length}</strong><span>claims</span></div></section>
        <section className="memory-context-section"><div className="memory-section-heading"><span>bounded context</span><small>read only</small></div><p className="memory-context-copy">{context.strengths.length ? `${context.strengths.length} strength${context.strengths.length === 1 ? '' : 's'} · ` : ''}{context.activeStruggles.length} active struggle{context.activeStruggles.length === 1 ? '' : 's'} · {context.recentRepairs.length} repair{context.recentRepairs.length === 1 ? '' : 's'}</p><button type="button" className="memory-text-button" onClick={() => downloadJson(`${course.id}-context.json`, context)}>download context JSON →</button></section>
        <section className="memory-context-section"><div className="memory-section-heading"><span>Obsidian vault</span><small>Markdown</small></div><div className="memory-tree"><span>courses/{course?.code}/</span><span>├─ concepts/</span><span>├─ assignments/</span><span>├─ sessions/*.md</span><span>└─ learner/signals/*.md</span><span>learner/</span><span>├─ profile.md</span><span>├─ learning-preferences.md</span><span>└─ recurring-mistakes.md</span></div></section>
        <section className="memory-context-section"><div className="memory-section-heading"><span>tutor profile</span><small>cross-course</small></div><p className="memory-context-copy">{memory.skillState?.tutor?.sessionsCommitted || 0} committed session{memory.skillState?.tutor?.sessionsCommitted === 1 ? '' : 's'} observed · refresh in {3 - ((memory.skillState?.tutor?.sessionsCommitted || 0) % 3) || 3}</p><small>Strengths, weaknesses, and improvements refresh every three commits.</small></section>
        <section className="memory-context-footer"><span>Obsidian sync</span><strong>{memory.vault?.status || 'not configured'}</strong><small>Markdown is readable in Obsidian. Tutor hypotheses keep evidence, confidence, and a reason to revisit.</small></section>
      </aside>
    </div>
    <input ref={sessionInputRef} className="visually-hidden" type="file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" onChange={importSession} />
    <input ref={materialInputRef} className="visually-hidden" type="file" accept=".txt,.md,.csv,.json,.html,.htm,.pdf,text/plain,text/markdown,text/csv,application/json,text/html,application/pdf" onChange={importMaterial} />
    <input ref={assignmentInputRef} className="visually-hidden" type="file" accept=".pdf,application/pdf" onChange={chooseAssignmentFile} />
    {showAssignmentImport && <AssignmentImportModalV2 code={assignmentCode} filename={assignmentFile?.name || ''} onCodeChange={setAssignmentCode} onChoose={() => assignmentInputRef.current?.click()} onConfirm={confirmAssignmentFile} onCancel={() => setShowAssignmentImport(false)} />}
    {proposal && <ProposalModal operation={proposal} onApprove={approveAndCommit} onExport={exportBundle} onCancel={cancelProposal} />}
  </div>
}

function Overview({ course, sessions, artifacts, claims, questions, vault, pendingOperations, onImport, onViewEvidence }) {
  const latest = sessions[0]
  return <div className="memory-overview"><div className="memory-hero"><div><span className="memory-eyebrow">capture-study-session</span><h2>Save what mattered.</h2><p>ChatGPT stays your study surface. Relay keeps the original export, proposes learner evidence, and writes a readable Obsidian note only after approval.</p><button type="button" className="memory-primary-button" onClick={onImport}>import a session export <span>↗</span></button></div><div className="memory-hero-mark"><span>01</span><i>session</i><strong>→</strong><i>evidence</i></div></div><div className="memory-card-grid"><section className="memory-card"><div className="memory-card-heading"><span>learner evidence</span><strong>{claims.length}</strong></div><h3>{claims.length ? 'Claims remain hypotheses until you review them.' : 'No learner claims yet.'}</h3><p>Every strength, struggle, repair, and question pattern keeps its source artifact, confidence, and a reason to revisit.</p><button type="button" className="memory-text-button" onClick={onViewEvidence}>inspect evidence →</button></section><section className="memory-card"><div className="memory-card-heading"><span>past-test questions</span><strong>{questions.length}</strong></div><h3>{questions.length ? 'Questions are queryable, not opaque PDFs.' : 'Make one question first-class.'}</h3><p>Keep the assessment, attempt, and question separate. Missing answers, scores, and page references stay missing.</p><button type="button" className="memory-text-button" onClick={onViewEvidence}>add question evidence →</button></section><section className="memory-card"><div className="memory-card-heading"><span>Obsidian vault</span><strong className={vault?.status === 'synced' ? '' : 'amber'}>{vault?.status || 'not configured'}</strong></div><h3>Readable evidence, stable Tutor.</h3><p>Session notes live beside concepts and assignments. The learner profile evolves as evidence accumulates.</p><span className="memory-inline-note">Markdown sync is {vault?.status || 'not configured'}.</span></section></div><section className="memory-timeline"><div className="memory-section-heading"><span>archive activity</span><small>{pendingOperations.length} needs review</small></div>{latest ? <div className="memory-activity-row"><span className="memory-activity-mark">◌</span><div><strong>{latest.id}</strong><p>session captured · {formatDate(latest.sessionDate)} · {latest.evidence.length} evidence records proposed</p></div><small>{artifacts.length} artifacts in course</small></div> : <div className="memory-empty-row"><strong>Your first session belongs here.</strong><span>Import a strict JSON bundle from capture-study-session, then approve its Obsidian note.</span></div>}</section></div>
}

function SessionList({ sessions, artifacts, onImport }) {
  return <div className="memory-list-view"><div className="memory-view-header"><div><span className="memory-eyebrow">raw evidence + Markdown notes</span><h2>Study sessions</h2><p>The raw ChatGPT export is immutable. The Obsidian note is derived, readable, and rebuildable.</p></div><button type="button" className="memory-primary-button compact" onClick={onImport}>＋ import session</button></div>{sessions.length ? <div className="memory-session-list">{sessions.map((session) => <article className="memory-session-row" key={session.id}><div className="memory-session-date"><strong>{formatDate(session.sessionDate)}</strong><small>{session.id}</small></div><div><h3>{session.concepts?.length ? session.concepts.map((item) => item.name || item).join(', ') : 'Concepts not supplied'}</h3><p>{session.evidence?.length || 0} evidence records · {session.unresolvedQuestions?.length || 0} unresolved questions · {session.proposedNextPractice?.length || 0} next practices</p></div><span className="memory-provenance">{session.provenance}</span></article>)}</div> : <div className="memory-empty-panel"><strong>No captured sessions.</strong><span>Use the capture skill in ChatGPT, then approve its Obsidian note.</span></div>}<div className="memory-inline-note">{artifacts.length} local artifact{artifacts.length === 1 ? '' : 's'} · raw files never overwrite each other</div></div>
}

function EvidenceList({ claims, questions, onCorrect, onDelete, onAddQuestion }) {
  return <div className="memory-list-view"><div className="memory-view-header"><div><span className="memory-eyebrow">source-linked learner record</span><h2>Evidence, not labels.</h2><p>Derived claims are editable, reviewable, and never erase the original session.</p></div><button type="button" className="memory-primary-button compact" onClick={onAddQuestion}>＋ past-test question</button></div><div className="memory-evidence-grid"><section><div className="memory-section-heading"><span>learner claims</span><small>{claims.length} active</small></div>{claims.length ? claims.map((claim) => <article className="memory-claim" key={claim.id}><div className="memory-claim-top"><span className={`memory-claim-type ${claim.type}`}>{labelFor(claim.type)}</span><span>{Math.round((claim.confidence || 0) * 100)}% confidence</span></div><p>{claim.evidence || claim.text}</p><small>{claim.provenance} · {claim.observationCount} observation · source {claim.sourceArtifactId}</small><div className="memory-claim-actions"><button type="button" onClick={() => onCorrect(claim)}>mark reviewed</button><button type="button" onClick={() => onDelete(claim)}>delete derived claim</button></div></article>) : <div className="memory-empty-panel compact-empty"><span>No claims until a session is approved.</span></div>}</section><section><div className="memory-section-heading"><span>question evidence</span><small>{questions.length} recorded</small></div>{questions.length ? questions.map((item) => <article className="memory-question" key={item.questionEvidenceId}><div><span>question {item.number}</span><strong>{item.prompt}</strong></div><small>{item.concepts?.map((concept) => concept.name).join(', ') || 'concept not mapped'} · {item.questionTypes?.join(', ') || 'type not supplied'}</small><p>{item.correction || 'No correction supplied.'}</p></article>) : <div className="memory-empty-panel compact-empty"><span>Past tests can be added one question at a time.</span></div>}</section></div></div>
}

function OperationList({ operations, onReview }) {
  return <div className="memory-list-view"><div className="memory-view-header"><div><span className="memory-eyebrow">durable operation boundary</span><h2>Operations</h2><p>Every proposal, approval, failure, duplicate, and cancellation is visible.</p></div></div><div className="memory-operation-list">{operations.length ? operations.map((item) => <article className="memory-operation" key={item.id}><div><span className={`memory-operation-state ${item.status}`}>{item.status}</span><strong>{labelFor(item.type)}</strong><small>{formatTime(item.createdAt)} · {item.courseId}</small></div><p>{item.reason || item.diff?.rawArtifact || item.idempotencyKey}</p>{item.status === 'proposed' && <button type="button" className="memory-text-button" onClick={() => onReview(item)}>review proposal →</button>}</article>) : <div className="memory-empty-panel"><strong>No operations yet.</strong><span>Proposals will appear here before any local write.</span></div>}</div></div>
}

function QuestionForm({ value, onChange, onSubmit, onCancel }) {
  const update = (key) => (event) => onChange({ ...value, [key]: event.target.value })
  return <form className="memory-question-form" onSubmit={onSubmit}><div className="memory-section-heading"><span>new question evidence</span><button type="button" onClick={onCancel}>×</button></div><div className="memory-form-grid"><label>assessment<input value={value.assessmentTitle} onChange={update('assessmentTitle')} placeholder="midterm" /></label><label>number<input value={value.number} onChange={update('number')} placeholder="3b" /></label><label className="wide">prompt<textarea required value={value.prompt} onChange={update('prompt')} /></label><label className="wide">student answer<textarea value={value.studentAnswer} onChange={update('studentAnswer')} /></label><label className="wide">correction<textarea value={value.correction} onChange={update('correction')} /></label><label>concept<input value={value.concept} onChange={update('concept')} placeholder="hypothesis testing" /></label><label>question type<select value={value.questionType} onChange={update('questionType')}><option>application</option><option>calculation</option><option>proof</option><option>compare/contrast</option><option>interpretation</option></select></label><label>earned<input value={value.earned} onChange={update('earned')} placeholder="4" /></label><label>possible<input value={value.possible} onChange={update('possible')} placeholder="8" /></label><label>source ref<input value={value.sourceRef} onChange={update('sourceRef')} placeholder="page:2" /></label></div><div className="memory-form-actions"><button type="button" onClick={onCancel}>cancel</button><button type="submit" className="memory-primary-button compact">propose question</button></div></form>
}

function ProposalModal({ operation, onApprove, onExport, onCancel }) {
  const claims = operation.diff?.learnerClaims || []
  return <div className="memory-modal-backdrop" role="presentation"><section className="memory-proposal" role="dialog" aria-modal="true" aria-labelledby="proposal-title"><div className="memory-proposal-header"><div><span className="memory-eyebrow">{labelFor(operation.type)}</span><h2 id="proposal-title">Review before saving.</h2></div><button type="button" onClick={onCancel} aria-label="Close proposal">×</button></div><div className="memory-proposal-warning"><strong>Nothing has changed yet.</strong><span>Approval creates a short-lived token bound to this exact course, content hash, destinations, and diff.</span></div><div className="memory-proposal-grid"><div><span className="memory-field-label">course</span><strong>{operation.courseId}</strong></div><div><span className="memory-field-label">content hash</span><code>{operation.contentHash || 'derived record'}</code></div><div className="wide"><span className="memory-field-label">destinations</span><ul>{operation.destinationPaths?.map((path) => <li key={path}>{path}</li>)}</ul></div><div className="wide"><span className="memory-field-label">learner-record diff</span>{claims.length ? <ul>{claims.map((claim, index) => <li key={`${claim.type}-${index}`}><span className="memory-claim-type">{labelFor(claim.type)}</span> {claim.text || claim.evidence} <small>· {claim.provenance} · {Math.round((claim.confidence || 0) * 100)}%</small></li>)}</ul> : <p className="memory-muted">No learner claims proposed.</p>}</div>{operation.diff?.profileRefresh && <div className="wide memory-proposal-warning"><strong>learner profile refresh is due</strong><span>This approved session will refresh the derived Obsidian profile, learning-preferences, and recurring-mistakes notes from the accumulated evidence.</span></div>}{operation.diff?.warnings?.length > 0 && <div className="wide memory-warning-list"><span className="memory-field-label">missing or uncertain data</span><ul>{operation.diff.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}</div><div className="memory-proposal-footer">{operation.bundle && <button type="button" className="memory-ghost-button" onClick={onExport}>download manual bundle</button>}<span>raw export stays immutable</span><div><button type="button" onClick={onCancel}>cancel</button><button type="button" className="memory-primary-button" onClick={onApprove}>approve &amp; save locally</button></div></div></section></div>
}

/* Legacy modal removed; the V2 modal below is the only assignment import surface.
function AssignmentImportModalLegacy({ code, filename, onCodeChange, onChoose, onConfirm, onCancel }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])
  return <div className="memory-modal-backdrop" role="presentation"><section className="memory-proposal memory-assignment-import" role="dialog" aria-modal="true" aria-labelledby="assignment-import-title"><div className="memory-proposal-header"><div><span className="memory-eyebrow">assignment skill handoff</span><h2 id="assignment-import-title">Bring the original PDF.</h2></div><button type="button" onClick={onCancel} aria-label="Close assignment import">×</button></div><div className="memory-proposal-grid"><div className="wide"><p className="memory-muted">ChatGPT cannot write to Windows directly. Select the same original assignment PDF here, confirm its course code, and Relay will propose the course-scoped archive destination before any bytes are written.</p></div><label className="wide memory-upload-label">course code or display name<input autoFocus required value={code} onChange={(event) => onCodeChange(event.target.value)} placeholder="CISC301" /></label><div className="wide"><span className="memory-field-label">destination</span><code>study-context/courses/{code.trim() || '<COURSE>'}/materials/file-uploaded/&lt;original filename&gt;</code></div></div><div className="memory-proposal-footer"><span>original filename and bytes are preserved</span><div><button type="button" onClick={onCancel}>cancel</button><button type="button" className="memory-primary-button" onClick={onChoose} disabled={!code.trim()}>choose original PDF</button></div></div></section></div>
}
*/

function AssignmentImportModalV2({ code, filename, onCodeChange, onChoose, onConfirm, onCancel }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])
  return <div className="memory-modal-backdrop" role="presentation"><section className="memory-proposal memory-assignment-import" role="dialog" aria-modal="true" aria-labelledby="assignment-import-title"><div className="memory-proposal-header"><div><span className="memory-eyebrow">assignment skill handoff</span><h2 id="assignment-import-title">Bring the original PDF.</h2></div><button type="button" onClick={onCancel} aria-label="Close assignment import">close</button></div><div className="memory-proposal-grid"><div className="wide"><p className="memory-muted">ChatGPT cannot write to Windows directly. Select the same original assignment PDF here, confirm its course code, and Relay will propose the course-scoped archive destination before any bytes are written.</p></div><div className="wide"><span className="memory-field-label">original filename</span><strong>{filename || 'not selected yet'}</strong></div><label className="wide memory-upload-label">course code or display name<input autoFocus required value={code} onChange={(event) => onCodeChange(event.target.value)} placeholder="CISC301" /></label><div className="wide"><span className="memory-field-label">destination</span><code>study-context/courses/{code.trim() || '<COURSE>'}/materials/file-uploaded/{filename || '<original filename>'}</code></div></div><div className="memory-proposal-footer"><span>original filename and bytes are preserved</span><div><button type="button" onClick={onCancel}>cancel</button><button type="button" onClick={onChoose}>select original PDF</button><button type="button" className="memory-primary-button" onClick={onConfirm} disabled={!code.trim() || !filename}>confirm &amp; propose</button></div></div></section></div>
}
