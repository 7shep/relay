import { useRef } from 'react'
import Panel from './Panel.jsx'
import { dueClock } from '../utils/dates.js'
import { dueLabel } from '../utils/formatting.js'
import Icon from './Icons.jsx'

export default function AssignmentsPanel({ now, assignments, index, syllabusState, archivePending = 0, onImport, onClear }) {
  const soon = assignments.filter((item) => Number.isFinite(item.dueInHours) && item.dueInHours <= 24).length
  const meta = assignments.length ? <span>{assignments.length} queued <b className="danger-text">&#8226; {soon} due &lt;24h</b>{archivePending ? <b className="warn-text">&#8226; {archivePending} archive pending</b> : null}</span> : syllabusState.status === 'importing' ? <span>qwen extracting...</span> : archivePending ? <span>{archivePending} archive pending review</span> : null
  return <Panel path="~/edu/assignments" index={index} className="assignments-panel" meta={meta}>
    {assignments.length ? <><div className="assignment-toolbar"><span>source: syllabi &#8226; qwen-2.5-7b</span>{archivePending ? <small className="warn-text">open study memory to review archive proposal</small> : null}<SyllabusImportButton label="add more syllabi" onImport={onImport} /><button type="button" className="assignment-action" onClick={onClear}>clear</button></div><ol className="assignment-list"><span className="assignment-line" aria-hidden="true" />{assignments.map((item) => {
      const dueHours = Number.isFinite(item.dueInHours) ? item.dueInHours : null
      const dueText = item.dueAt || (dueHours === null ? 'date not set' : dueClock(dueHours, now))
      return <li key={item.id}><span className={`assignment-dot ${dueHours !== null && dueHours <= 12 ? 'danger-dot' : dueHours !== null && dueHours <= 48 ? 'warn-dot' : ''}`} aria-hidden="true" /><div><div className="assignment-title"><strong>{item.title}</strong><span className={dueHours !== null && dueHours <= 12 ? 'danger-text' : dueHours !== null && dueHours <= 48 ? 'warn-text' : ''}>{dueHours === null ? <>&mdash;</> : dueLabel(dueHours)}</span></div><small>{[item.course, item.kind, item.weight && `${item.weight} of grade`, `due ${dueText}`].filter(Boolean).join(' \u2022 ')}</small></div></li>
    })}</ol></> : <SyllabusSetup state={syllabusState} onImport={onImport} />}
  </Panel>
}

function SyllabusSetup({ state, onImport }) {
  if (state.status === 'importing') return <div className="assignment-empty"><strong>Qwen is reading your syllabi...</strong><small>Extracting dated assignments, exams, labs, and projects locally.</small></div>
  return <div className={`assignment-empty ${state.status === 'error' ? 'assignment-error' : ''}`}><strong>{state.status === 'empty' ? 'No assignments found.' : 'Add your syllabi.'}</strong><small>{state.status === 'error' ? state.error : 'Qwen will extract assignments and midterms from text-based syllabus files and PDFs.'}</small><SyllabusImportButton onImport={onImport} /><small>Supported: .txt, .md, .csv, .json, .html, and .pdf files.</small></div>
}

function SyllabusImportButton({ label = 'add syllabus', onImport }) {
  const inputRef = useRef(null)
  function chooseFiles(event) {
    onImport(Array.from(event.target.files || []))
    event.target.value = ''
  }
  return <><input ref={inputRef} className="visually-hidden" type="file" accept=".txt,.md,.csv,.json,.html,.htm,.pdf,text/plain,text/markdown,text/csv,application/json,text/html,application/pdf" multiple onChange={chooseFiles} /><button type="button" className="syllabus-connect" onClick={() => inputRef.current?.click()}>{label} <Icon name="upload" size={12} /></button></>
}
