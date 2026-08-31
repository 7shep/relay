import { useEffect, useRef, useState } from 'react'
import { SIDEBAR_CHAT_SYSTEM_PROMPT } from '../constants/prompts.js'
import { streamQwenChat } from '../services/qwen.js'
import AssistantMarkdown from './AssistantMarkdown.jsx'

const suggestedPrompts = [
  'Plan my afternoon around whatâ€™s due',
  'Which PR should I unblock first?',
  'Summarize my week',
]

const CHAT_ACTIVITY_LABELS = ['Thinking', 'Combobulating', 'Checking the dashboard', 'Writing']

function isTaskPrompt(prompt) {
  const mentionsTask = /\b(tasks?|todo|to-do|focus item|focus list)\b/i.test(prompt)
  const requestsCreation = /\b(add|create|capture|make)\b/i.test(prompt) || /\b(turn|convert)\b[\s\S]*\binto\b/i.test(prompt)
  return mentionsTask && requestsCreation
}

export default function ChatBar({ tasks, assignments, onCreateTasks }) {
  const [isOpen, setIsOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const scrollRef = useRef(null)
  const chatControllerRef = useRef(null)
  const activityTimerRef = useRef(null)

  useEffect(() => () => {
    chatControllerRef.current?.abort()
    if (activityTimerRef.current) window.clearInterval(activityTimerRef.current)
  }, [])

  useEffect(() => {
    if (isOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isOpen])

  function reset() {
    chatControllerRef.current?.abort()
    if (activityTimerRef.current) window.clearInterval(activityTimerRef.current)
    setMessages([])
    setIsStreaming(false)
    setThinkingOpen(false)
  }

  async function send(value) {
    const prompt = value.trim()
    if (!prompt || isStreaming) return
    const assistantId = Date.now()
    const context = `Dashboard context:\nFocus tasks:\n${JSON.stringify(tasks)}\n\nAssignment queue:\n${JSON.stringify(assignments)}`
    const history = messages.filter((message) => message.role === 'user' || (message.role === 'assistant' && message.content)).slice(-8).map((message) => ({ role: message.role, content: message.content }))
    setMessages((current) => [...current, { role: 'user', content: prompt }, { id: assistantId, role: 'assistant', content: '', thinking: '', phase: 'thinking', activity: CHAT_ACTIVITY_LABELS[0] }])
    setDraft('')
    setThinkingOpen(true)
    setIsStreaming(true)
    const controller = new AbortController()
    chatControllerRef.current = controller
    let activityIndex = 0
    activityTimerRef.current = window.setInterval(() => {
      activityIndex = (activityIndex + 1) % CHAT_ACTIVITY_LABELS.length
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, activity: CHAT_ACTIVITY_LABELS[activityIndex] } : message))
    }, 1400)
    try {
      if (isTaskPrompt(prompt)) {
        const draftedTasks = await onCreateTasks(prompt)
        if (!controller.signal.aborted) {
          const summary = draftedTasks.length
            ? `Added ${draftedTasks.length} focus task${draftedTasks.length === 1 ? '' : 's'} through Qwen.\n\n${draftedTasks.map((task, index) => `${index + 1}. **${task.label}** - ${task.project}, ${task.estimate}${task.due ? `, due ${task.due}` : ''}`).join('\n')}`
            : 'Qwen could not turn that request into a concrete focus task.'
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, phase: 'done', content: summary, thoughtSeconds: Math.max(1, Math.round((Date.now() - assistantId) / 1000)) } : message))
        }
      } else {
        await streamQwenChat([
          { role: 'system', content: SIDEBAR_CHAT_SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: `${prompt}\n\n${context}` },
        ], ({ content, thinking }) => {
          if (!content && !thinking) return
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, phase: content ? 'answering' : message.phase, content: `${message.content}${content}`, thinking: `${message.thinking}${thinking}` } : message))
        }, controller.signal)
        if (!controller.signal.aborted) setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, phase: 'done', thoughtSeconds: Math.max(1, Math.round((Date.now() - assistantId) / 1000)) } : message))
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, phase: 'error', activity: 'Qwen unavailable', content: `I couldnâ€™t reach local Qwen. Start Ollama and make sure qwen2.5:7b is installed.\n\n${error.message}` } : message))
    } finally {
      if (activityTimerRef.current) window.clearInterval(activityTimerRef.current)
      activityTimerRef.current = null
      if (chatControllerRef.current === controller) chatControllerRef.current = null
      setIsStreaming(false)
      setThinkingOpen(false)
    }
  }

  function stop() {
    chatControllerRef.current?.abort()
    if (activityTimerRef.current) window.clearInterval(activityTimerRef.current)
    activityTimerRef.current = null
    setIsStreaming(false)
    setThinkingOpen(false)
    setMessages((current) => current.map((message) => message.phase === 'thinking' || message.phase === 'answering' ? { ...message, phase: 'done', activity: 'Stopped' } : message))
  }

  function submit(event) {
    event.preventDefault()
    send(draft)
  }

  return <aside className={`assistant-dock ${isOpen ? 'is-open' : 'is-collapsed'}`} aria-label="Assistant sidebar">
    {isOpen ? <>
      <header className="assistant-header">
        <h2><span className="assistant-spark" aria-hidden="true">âœ£</span><span>~/assistant</span><span className="assistant-model">qwen-2.5-7b</span></h2>
        <div className="assistant-actions">
          <button type="button" className="assistant-icon-button" onClick={reset} aria-label="New conversation" title="New conversation">â†»</button>
          <button type="button" className="assistant-icon-button" onClick={() => setIsOpen(false)} aria-label="Collapse assistant" title="Collapse assistant">â‡¥</button>
        </div>
      </header>
      <div ref={scrollRef} className="assistant-messages" aria-live="polite" aria-busy={isStreaming}>
        {!messages.length ? <div className="assistant-empty-state">
          <p><span className="accent-text">assistant</span> connected to this dashboard.</p>
          <p>It can see your focus list, assignment queue, open pull requests, and todayâ€™s forecast. Ask it to triage, plan, or explain anything on screen.</p>
          <div className="assistant-prompts">{suggestedPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => send(prompt)}><span aria-hidden="true">&gt;</span>{prompt}</button>)}</div>
        </div> : messages.map((message, index) => message.role === 'user' ? <div className="assistant-user-message" key={`${message.role}-${index}`}>{message.content}</div> : <div className="assistant-response" key={message.id}>
          <button type="button" className="assistant-thinking-toggle" onClick={() => setThinkingOpen((value) => !value)} aria-expanded={thinkingOpen}><span aria-hidden="true">â€º</span>{message.phase === 'done' ? `Thought for ${message.thoughtSeconds || 1}s` : message.activity || 'Thinking'}</button>
          {thinkingOpen && message.thinking ? <p className="assistant-thinking-copy">{message.thinking}</p> : null}
          {message.content ? <AssistantMarkdown text={message.content} /> : null}
        </div>)}
      </div>
      <form className="assistant-form" onSubmit={submit}>
        <span className="assistant-prompt-mark" aria-hidden="true">&gt;</span>
        <label className="visually-hidden" htmlFor="assistant-input">Ask the assistant</label>
        <input id="assistant-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="ask about your day..." />
        {isStreaming ? <button type="button" className="assistant-send" onClick={stop} aria-label="Stop generating">â– </button> : <button type="submit" className="assistant-send" disabled={!draft.trim()} aria-label="Send message">â†¥</button>}
      </form>
      <p className="assistant-hint">enter to send Â· shift+enter for newline Â· reads your focus list, courses, repos &amp; forecast</p>
    </> : <button type="button" className="assistant-collapsed" onClick={() => setIsOpen(true)} aria-label="Open assistant" aria-expanded="false"><span aria-hidden="true">â‡¥</span><span>assistant</span>{isStreaming ? <i aria-hidden="true" /> : null}</button>}
  </aside>
}



