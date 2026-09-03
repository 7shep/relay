import { useEffect, useMemo, useRef, useState } from 'react'
import AssistantMarkdown from './AssistantMarkdown.jsx'
import Icon from './Icons.jsx'
import { createHandoff, createRun, createSignal, getProviderHealth, readAgentWorkspace, writeAgentWorkspace } from '../services/academicRuntime.js'
import { createLunaProvider } from '../services/lunaProvider.js'

const skillModes = {
  assignment: {
    label: 'Assignment',
    eyebrow: 'assignment skill',
    icon: 'A',
    description: 'Work from the prompt, rubric, and your draft.',
    greeting: 'I can help you understand the prompt, plan the work, and review your draft against the rubric.',
    prompts: ['Review my draft against the rubric', 'Help me make this research question testable', 'What should I revise first?'],
  },
  tutor: {
    label: 'Tutor',
    eyebrow: 'tutor skill',
    icon: '✦',
    description: 'Learn the concept with hints and small checks.',
    greeting: 'I’ll teach from your course context, ask questions first, and keep track of what becomes clear.',
    prompts: ['Quiz me on evaluation design', 'Give me a hint, not the answer', 'Explain this like I’m seeing it for the first time'],
  },
}

const initialMessages = {
  assignment: [
    { id: 'assignment-welcome', role: 'assistant', content: 'Hey Alex. I’m your Assignment agent for **CS-441 Project proposal**.\n\nI have the prompt, four rubric criteria, and your rough draft in context. What should we work on first?', meta: 'context loaded · 3 source artifacts' },
  ],
  tutor: [
    { id: 'tutor-welcome', role: 'assistant', content: 'Hey Alex. I’m your Tutor for **evaluation design**.\n\nWe can work through the idea with a few questions, hints, and a short check at the end. I won’t treat one uncertain answer as a permanent label.', meta: 'context loaded · learner memory available' },
  ],
}

function formatDate(value) {
  if (!value) return 'date not set'
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function localReply(skill, prompt, assignment) {
  const lower = prompt.toLowerCase()
  if (skill === 'tutor') {
    if (lower.includes('hint')) return 'Start with the simplest comparison you could make. What would you use as a reference point before trusting the accuracy from either model?'
    if (lower.includes('quiz') || lower.includes('test')) return 'Quick check: your study compares two models. What does a baseline tell you, and why does that matter before you interpret the accuracy number? Answer in your own words.'
    return `Let’s make this concrete using **${assignment?.title || 'your assignment'}**. I’ll ask one question at a time, then give you the smallest hint that helps you move forward.`
  }
  if (lower.includes('revise') || lower.includes('first')) return 'Start with the method and evaluation criterion. Name a baseline, explain why accuracy answers your question, and add one validity risk with a mitigation. Those changes close the two largest gaps in the current draft.'
  if (lower.includes('research question') || lower.includes('testable')) return 'Narrow the question to a defined population, a comparison, and a measurable outcome. For example: “On [population], does [model A] outperform [baseline] on [metric] under [split]?”'
  return `I’m looking at **${assignment?.title || 'your assignment'}** with the supplied rubric. I can map each claim to evidence, suggest a plan, or review the draft without overwriting it.`
}

export default function AcademicWorkspace({ assignments = [], onBack }) {
  const seededWorkspace = useMemo(() => readAgentWorkspace(assignments), [assignments])
  const [workspace, setWorkspace] = useState(seededWorkspace)
  const [activeCourseId, setActiveCourseId] = useState(seededWorkspace.courses[0]?.id)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(seededWorkspace.assignments[0]?.id)
  const [skill, setSkill] = useState('assignment')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [notice, setNotice] = useState('')
  const [showSources, setShowSources] = useState(true)
  const scrollRef = useRef(null)
  const provider = useMemo(() => createLunaProvider(), [])
  const providerHealth = getProviderHealth()

  useEffect(() => writeAgentWorkspace(workspace), [workspace])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, skill, isStreaming])

  const course = workspace.courses.find((item) => item.id === activeCourseId) || workspace.courses[0]
  const courseAssignments = workspace.assignments.filter((item) => item.courseId === course?.id)
  const assignment = workspace.assignments.find((item) => item.id === selectedAssignmentId) || courseAssignments[0] || workspace.assignments[0]
  const assignmentArtifacts = workspace.artifacts.filter((item) => item.assignmentId === assignment?.id)
  const mode = skillModes[skill]
  const currentMessages = messages[skill]
  const latestHandoff = workspace.handoffs[workspace.handoffs.length - 1]
  const recentRuns = workspace.runs.slice(-4).reverse()
  const readyCriteria = assignment?.rubric.filter((criterion) => criterion.assessment === 'ready').length || 0

  function selectCourse(id) {
    setActiveCourseId(id)
    const nextAssignment = workspace.assignments.find((item) => item.courseId === id)
    setSelectedAssignmentId(nextAssignment?.id)
  }

  function selectAssignment(id) {
    setSelectedAssignmentId(id)
    setNotice('assignment context attached to this chat')
  }

  function appendRun(run) {
    setWorkspace((current) => ({ ...current, runs: [...current.runs, run] }))
  }

  async function send(value, requestedSkill = skill) {
    const prompt = value.trim()
    if (!prompt || isStreaming) return
    const chatSkill = requestedSkill
    const chatMode = skillModes[chatSkill]
    const assistantId = `${chatSkill}-${Date.now()}`
    const startedAt = new Date().toISOString()
    setDraft('')
    setIsStreaming(true)
    setMessages((current) => ({ ...current, [chatSkill]: [...current[chatSkill], { id: `user-${assistantId}`, role: 'user', content: prompt }, { id: assistantId, role: 'assistant', content: '', phase: 'thinking', meta: 'thinking · using shared course context' }] }))

    let reply = ''
    let providerLabel = providerHealth.endpointConfigured ? 'Codex bridge' : 'local preview · Codex bridge pending'
    try {
      if (providerHealth.endpointConfigured) {
        const result = await provider.run({ agent: chatSkill, context: { assignment, artifacts: assignmentArtifacts, learnerProfile: workspace.learnerProfile, prompt }, signal: new AbortController().signal })
        reply = typeof result?.summary === 'string' && result.summary.trim() ? result.summary : localReply(chatSkill, prompt, assignment)
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 420))
        reply = localReply(chatSkill, prompt, assignment)
      }
      const run = createRun({ agent: chatSkill, label: chatSkill === 'tutor' ? 'chat response' : 'assignment response', inputs: assignmentArtifacts.map((item) => item.id), reason: `User used the ${chatMode.label} skill in the school chat.`, provider: providerLabel })
      run.startedAt = startedAt
      run.summary = reply
      appendRun(run)
      setMessages((current) => ({ ...current, [chatSkill]: current[chatSkill].map((message) => message.id === assistantId ? { ...message, content: reply, phase: 'done', meta: `${providerLabel} · ${formatTime(run.completedAt)}` } : message) }))
    } catch (error) {
      const run = createRun({ agent: chatSkill, label: 'chat error', inputs: assignmentArtifacts.map((item) => item.id), reason: 'The school chat could not complete the request.', provider: 'Codex bridge' })
      run.status = 'failed'
      run.error = error.message
      appendRun(run)
      setMessages((current) => ({ ...current, [chatSkill]: current[chatSkill].map((message) => message.id === assistantId ? { ...message, content: `I couldn’t complete that request.\n\n${error.message}`, phase: 'error', meta: 'run failed · nothing was changed' } : message) }))
    } finally {
      setIsStreaming(false)
    }
  }

  function saveDraftArtifact() {
    if (!assignment) return
    const artifact = { id: `artifact-draft-${Date.now()}`, type: 'draft', title: 'Saved working draft', source: 'user edited', createdAt: new Date().toISOString(), assignmentId: assignment.id, content: assignment.draft }
    setWorkspace((current) => ({ ...current, artifacts: [...current.artifacts, artifact] }))
    setNotice('draft saved as an artifact · the chat can use it next')
  }

  function reviewDraft() {
    setSkill('assignment')
    send('Review my draft against the rubric', 'assignment')
  }

  function tutorCheck() {
    setSkill('tutor')
    send('Quiz me on evaluation design', 'tutor')
  }

  function recordTutorSignal(successful) {
    if (!assignment) return
    const signal = createSignal({ type: successful ? 'successful repair' : 'observed uncertainty', concept: 'evaluation design', courseId: course.id, evidence: successful ? 'User explained the need for a baseline and metric rationale.' : 'User requested a hint before explaining the evaluation choice.', confidence: successful ? 0.84 : 0.66, sourceArtifactId: 'artifact-draft' })
    setWorkspace((current) => ({ ...current, signals: [...current.signals, signal], learnerProfile: { ...current.learnerProfile, corrections: successful ? [...current.learnerProfile.corrections, { concept: 'evaluation design', note: 'Baseline and metric rationale explained successfully.', signalId: signal.id }] : current.learnerProfile.corrections } }))
    setNotice(successful ? 'successful repair recorded · learner memory updated' : 'hint usage recorded · uncertainty retained')
  }

  function createTutorHandoff() {
    if (!assignment) return
    const handoff = createHandoff({ source: 'assignment', target: 'tutor', reason: 'The current draft still needs practice with evaluation design.', inputArtifacts: assignmentArtifacts.map((item) => item.id), requiresApproval: false })
    setWorkspace((current) => ({ ...current, handoffs: [...current.handoffs, handoff] }))
    setSkill('tutor')
    setNotice('Tutor skill opened with the assignment context attached')
  }

  return <div className="academic-app">
    <header className="academic-topbar">
      <div className="academic-brand"><span className="accent-text">relay</span><span className="slash">/</span><strong>school</strong></div>
      <div className="academic-topbar-meta"><span className={`provider-dot ${providerHealth.endpointConfigured ? 'ready' : ''}`} /><span>CODEX</span><span className="provider-state">{providerHealth.endpointConfigured ? 'bridge ready' : 'local preview'}</span><button type="button" className="workspace-back" onClick={onBack}>← dashboard</button></div>
    </header>

    <div className="academic-layout chat-layout">
      <aside className="workspace-rail">
        <div className="rail-heading"><span>school agent</span><button type="button" className="new-chat-button" onClick={() => setMessages(initialMessages)} aria-label="Start a new chat">＋ new</button></div>
        <nav className="workspace-nav" aria-label="School workspace navigation">
          <button type="button" className="active"><span className="nav-mark">▱</span>chat <small>⌘1</small></button>
        </nav>
        <div className="rail-section-label">courses</div>
        <div className="course-list">{workspace.courses.map((item) => <button key={item.id} type="button" className={`course-rail-item ${item.id === course?.id ? 'active' : ''}`} onClick={() => selectCourse(item.id)}><i className={`course-dot ${item.color}`} /><span><strong>{item.code}</strong><small>{item.name}</small></span><em>{item.assignments.length}</em></button>)}</div>
        <div className="rail-section-label">assignments</div>
        <div className="assignment-rail-list">{courseAssignments.length ? courseAssignments.map((item) => <button key={item.id} type="button" className={item.id === assignment?.id ? 'active' : ''} onClick={() => selectAssignment(item.id)}><span className="assignment-rail-mark">↳</span><span><strong>{item.title}</strong><small>due {formatDate(item.dueAt)}</small></span></button>) : <p className="rail-empty">No assignments in this course.</p>}</div>
        <div className="rail-section-label recent-label">recent chats</div>
        <div className="rail-runs">{recentRuns.map((run) => <button type="button" key={run.id} onClick={() => setSkill(run.agent === 'tutor' ? 'tutor' : 'assignment')}><span className={`run-agent ${run.agent}`}>{run.agent === 'tutor' ? '✦' : 'A'}</span><span><strong>{run.agent === 'tutor' ? 'evaluation design' : 'project proposal'}</strong><small>{run.label} · {formatTime(run.completedAt)}</small></span></button>)}</div>
        <div className="rail-footer"><span>agent runtime</span><strong>Codex · private</strong><small>course context stays local</small></div>
      </aside>

      <main className="school-chat-main">
        <header className="chat-page-header"><div><div className="workspace-breadcrumb"><span className="accent-text">{course?.code || 'school'}</span><span>/</span><span>school agent</span></div><h1>What are we working on?</h1><p>One chat for assignments and learning, with your course context already attached.</p></div><div className="chat-header-context"><span className="context-dot" />{assignment?.title || 'no assignment selected'}<button type="button" onClick={() => setShowSources((value) => !value)}>{showSources ? 'hide context' : 'show context'}</button></div></header>

        <div className="skill-switcher" role="tablist" aria-label="Choose an academic skill">
          {Object.entries(skillModes).map(([id, item]) => <button key={id} type="button" role="tab" aria-selected={skill === id} className={skill === id ? 'active' : ''} onClick={() => setSkill(id)}><span className={`skill-icon ${id}`}>{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}
        </div>

        {notice && <div className="workspace-notice" role="status"><span>✓</span>{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}

        <section className="chat-surface" aria-label={`${mode.label} chat`}>
          <div ref={scrollRef} className="school-chat-messages" aria-live="polite" aria-busy={isStreaming}>
            <div className="chat-date-marker"><span>today</span><i /><span>{mode.eyebrow}</span></div>
            {currentMessages.map((message) => message.role === 'user' ? <div className="school-user-message" key={message.id}>{message.content}</div> : <div className={`school-assistant-message ${message.phase === 'error' ? 'error' : ''}`} key={message.id}><div className="message-agent"><span className={`agent-avatar ${skill}`}>{mode.icon}</span><strong>{mode.label} skill</strong><small>{message.meta}</small></div>{message.content ? <AssistantMarkdown text={message.content} /> : <div className="chat-typing"><i /><i /><i /></div>}</div>)}
            {!isStreaming && <div className="chat-suggestions"><span>try asking</span>{mode.prompts.map((prompt) => <button type="button" key={prompt} onClick={() => send(prompt)}><Icon name="chevronRight" size={11} />{prompt}</button>)}</div>}
          </div>
          <form className="school-chat-composer" onSubmit={(event) => { event.preventDefault(); send(draft) }}>
            <div className="composer-context"><span className="composer-prompt">›</span><span>{mode.label} skill</span><i /> <strong>{assignment?.title || 'no assignment'}</strong></div>
            <div className="composer-row"><label className="visually-hidden" htmlFor="school-chat-input">Message the school agent</label><textarea id="school-chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(draft) } }} placeholder={skill === 'tutor' ? 'Ask for a hint, explanation, or practice check...' : 'Ask about the prompt, plan, or draft...'} rows="1" /><button type="submit" className="composer-send" disabled={!draft.trim() || isStreaming} aria-label="Send message"><Icon name="send" size={14} /></button></div>
            <p className="composer-hint">enter to send <span>·</span> shift+enter for a new line <span>·</span> the agent will never overwrite your draft</p>
          </form>
        </section>
      </main>

      {showSources && <aside className="chat-context-pane"><div className="context-pane-header"><div><span className="workspace-kicker">shared context</span><h2>In this chat</h2></div><span className="context-live"><i /> synced</span></div>{assignment ? <><section className="context-assignment"><span className="context-label">active assignment</span><h3>{assignment.title}</h3><p>{course?.code} · due {formatDate(assignment.dueAt)}</p><div className="context-progress"><span><b>{readyCriteria}</b>/{assignment.rubric.length} criteria ready</span><i><em style={{ width: `${assignment.rubric.length ? (readyCriteria / assignment.rubric.length) * 100 : 0}%` }} /></i></div><button type="button" className="context-action" onClick={reviewDraft}>review draft <Icon name="arrowUpRight" size={11} /></button></section><section className="context-section"><div className="context-section-head"><span className="context-label">sources</span><strong>{assignmentArtifacts.length}</strong></div>{assignmentArtifacts.slice(-4).map((artifact) => <div className="context-source" key={artifact.id}><span>↳</span><div><strong>{artifact.title}</strong><small>{artifact.type} · {artifact.source}</small></div></div>)}<button type="button" className="text-action" onClick={saveDraftArtifact}>＋ save current draft as source</button></section><section className="context-section learner-memory"><div className="context-section-head"><span className="context-label">learner memory</span><span className="memory-state">{workspace.signals.length} signals</span></div><p>{workspace.learnerProfile.patterns[0] || 'No active learning pattern recorded.'}</p><button type="button" className="text-action" onClick={tutorCheck}>practice with Tutor →</button></section><section className="context-footer"><span>agent handoff</span><strong>{latestHandoff ? `${latestHandoff.source} → ${latestHandoff.target}` : 'none yet'}</strong><small>{latestHandoff?.reason || 'Ask the Assignment skill to bring Tutor into the loop.'}</small><button type="button" className="outline-action" onClick={createTutorHandoff}>open Tutor with context</button></section></> : <div className="workspace-empty"><span>∅</span><p>Select or import an assignment to attach course context.</p></div>}</aside>}
    </div>
  </div>
}
