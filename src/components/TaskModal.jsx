import { useEffect, useRef, useState } from 'react'
import { formatTaskDue } from '../utils/dates.js'
import Icon from './Icons.jsx'

export default function TaskModal({ task, onClose, onToggle, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...task, timelineText: task.timeline?.join('\n') || '' })
  const closeRef = useRef(null)

  useEffect(() => {
    setDraft({ ...task, timelineText: task.timeline?.join('\n') || '' })
    setEditing(false)
  }, [task])

  useEffect(() => {
    closeRef.current?.focus()
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return
      const dialog = closeRef.current?.closest('[role="dialog"]')
      if (!dialog) return
      const focusable = [...dialog.querySelectorAll('button, input, textarea')].filter((element) => !element.disabled)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapFocus)
    return () => document.removeEventListener('keydown', trapFocus)
  }, [])

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function save(event) {
    event.preventDefault()
    const timeline = draft.timelineText.split('\n').map((line) => line.trim()).filter(Boolean)
    onSave(task.id, { label: draft.label.trim() || task.label, description: draft.description.trim(), estimate: draft.estimate.trim() || '30m', due: draft.due, timeline })
    setEditing(false)
  }

  const timelineText = editing ? draft.timelineText : task.timeline.join('\n')
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" aria-describedby="task-modal-description">
      <header className="task-modal-header"><span className="command-line">$ cat ~/focus/{task.id}.md</span><button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close task details"><Icon name="close" size={15} /></button></header>
      {editing ? <form className="task-edit-form" onSubmit={save}>
        <label><span>task</span><input value={draft.label} onChange={(event) => updateDraft('label', event.target.value)} autoFocus /></label>
        <label><span>description</span><textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} rows="3" /></label>
        <div className="task-edit-grid"><label><span>estimate</span><input value={draft.estimate} onChange={(event) => updateDraft('estimate', event.target.value)} /></label><label><span>due date</span><input type="date" value={draft.due} onChange={(event) => updateDraft('due', event.target.value)} /></label></div>
        <label><span>timeline <small>one step per line</small></span><textarea value={timelineText} onChange={(event) => updateDraft('timelineText', event.target.value)} rows="5" /></label>
        <div className="task-modal-actions"><button type="button" className="modal-secondary" onClick={() => setEditing(false)}>cancel</button><button type="submit" className="modal-primary">save changes</button></div>
      </form> : <div className="task-detail">
        <div className="task-detail-top"><span className="eyebrow">{task.project} &#8226; {task.done ? 'completed' : 'focus task'}</span><span className="task-detail-id">{task.id}</span></div>
        <h2 id="task-modal-title">{task.label}</h2>
        <p id="task-modal-description" className="task-description">{task.description || 'No description yet. Add context to make this task easier to pick back up.'}</p>
        <div className="task-facts"><div><span>estimate</span><strong>{task.estimate}</strong></div><div><span>due</span><strong>{formatTaskDue(task.due)}</strong></div></div>
        <div className="timeline-block"><span className="eyebrow">Suggested timeline</span><ol>{task.timeline?.length ? task.timeline.map((step, index) => <li key={`${step}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>) : <li className="timeline-empty">No timeline yet. Add one while editing.</li>}</ol></div>
        <div className="task-modal-actions"><button className="modal-secondary" onClick={() => setEditing(true)}>edit task</button><button className={`modal-primary ${task.done ? 'reopen-button' : ''}`} onClick={() => onToggle(task.id)}>{task.done ? 'reopen task' : 'mark complete'}</button></div>
      </div>}
    </section>
  </div>
}


