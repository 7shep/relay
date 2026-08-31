import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const seedTasks = [
  { id: 't1', label: 'Ship auth refresh-token rotation', project: 'orbit-api', estimate: '2h', done: false },
  { id: 't2', label: 'Review Priya’s scheduler PR', project: 'orbit-api', estimate: '30m', done: false },
  { id: 't3', label: 'Draft CS-441 project proposal', project: 'school', estimate: '45m', done: false },
  { id: 't4', label: 'Fix flaky snapshot tests on CI', project: 'dashboard', estimate: '1h', done: true },
  { id: 't5', label: 'Morning inbox + standup notes', project: 'admin', estimate: '20m', done: true },
]

const assignments = [
  { id: 'a1', course: 'CS-441', title: 'Distributed consensus write-up', kind: 'essay', dueInHours: 6, weight: '15%' },
  { id: 'a2', course: 'MATH-312', title: 'Problem set 7 - eigenspaces', kind: 'problem set', dueInHours: 21, weight: '8%' },
  { id: 'a3', course: 'CS-330', title: 'Lab 4: cache simulator', kind: 'lab', dueInHours: 54, weight: '10%' },
  { id: 'a4', course: 'PHIL-210', title: 'Reading response - Nagel', kind: 'reading', dueInHours: 96, weight: '5%' },
  { id: 'a5', course: 'MATH-312', title: 'Midterm exam', kind: 'exam', dueInHours: 168, weight: '30%' },
]

const pullRequests = [
  { id: 'p1', number: 1842, repo: 'orbit-api', title: 'Rotate refresh tokens on every exchange', branch: 'alex/token-rotation', checks: 'passing', review: 'approved', additions: 412, deletions: 96, updatedHoursAgo: 1, isDraft: false },
  { id: 'p2', number: 1839, repo: 'orbit-api', title: 'Backfill job scheduler with retry budget', branch: 'priya/scheduler-retries', checks: 'failing', review: 'awaiting review', additions: 738, deletions: 210, updatedHoursAgo: 3, isDraft: false },
  { id: 'p3', number: 218, repo: 'terminal-dash', title: 'Extract panel chrome into shared primitive', branch: 'alex/panel-primitive', checks: 'passing', review: 'changes requested', additions: 164, deletions: 302, updatedHoursAgo: 9, isDraft: false },
  { id: 'p4', number: 77, repo: 'dotfiles', title: 'nvim: lazy-load lsp on filetype', branch: 'alex/lazy-lsp', checks: 'running', review: 'awaiting review', additions: 58, deletions: 41, updatedHoursAgo: 26, isDraft: true },
]

const weather = {
  location: 'Seattle, WA',
  temp: 68,
  feelsLike: 66,
  condition: 'Partly cloudy',
  high: 74,
  low: 55,
  windMph: 7,
  humidity: 48,
  hourly: [
    { hour: '15', temp: 70 },
    { hour: '16', temp: 71 },
    { hour: '17', temp: 69 },
    { hour: '18', temp: 66 },
    { hour: '19', temp: 62 },
    { hour: '20', temp: 59 },
  ],
}

function greetingFor(date) {
  const hour = date.getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatClock(date) {
  return date.toLocaleTimeString('en-US', { hour12: false })
}

function formatDateLine(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toLowerCase()
}

function dueLabel(hours) {
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function dueClock(hours, now) {
  const due = new Date(now.getTime() + hours * 3600 * 1000)
  return due.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).toLowerCase()
}

function relativeAgo(hours) {
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function App() {
  const [now, setNow] = useState(() => new Date())
  const [tasks, setTasks] = useState(seedTasks)
  const [showCompleted, setShowCompleted] = useState(true)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const toggleTask = useCallback((id) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)))
  }, [])

  const addTask = useCallback((label) => {
    setTasks((current) => [...current, { id: `t${Date.now()}`, label, project: 'inbox', estimate: '30m', done: false }])
  }, [])

  const tasksLeft = useMemo(() => tasks.filter((task) => !task.done).length, [tasks])

  return (
    <div className="terminal-app">
      <div className="dashboard-frame">
        <DashboardHeader name="Alex" now={now} tasksLeft={tasksLeft} />

        <main className="dashboard-grid">
          <FocusTasks
            tasks={tasks}
            onToggle={toggleTask}
            onAdd={addTask}
            showCompleted={showCompleted}
            onToggleCompleted={() => setShowCompleted((current) => !current)}
            index={0}
          />

          <div className="side-stack">
            <WeatherPanel index={1} />
            <AssignmentsPanel now={now} index={2} />
          </div>

          <PullRequestsPanel index={3} />
        </main>

        <footer className="system-footer">
          <span>synced 2m ago</span>
          <span aria-hidden="true">·</span>
          <span>3 sources connected</span>
          <span aria-hidden="true">·</span>
          <span className="accent-text">all systems nominal</span>
        </footer>
      </div>
    </div>
  )
}

function DashboardHeader({ name, now, tasksLeft }) {
  return (
    <header className="dashboard-header">
      <div className="header-copy">
        <p className="command-line">alex@localhost:~$ ./dashboard --today</p>
        <h1><span className="accent-text">{greetingFor(now)},</span> {name}<span className="caret" aria-hidden="true" /></h1>
        <p className="header-meta">{formatDateLine(now)} <span aria-hidden="true">·</span> <span className="bright-text">{formatClock(now)}</span> <span aria-hidden="true">·</span> {tasksLeft} focus task{tasksLeft === 1 ? '' : 's'} remaining</p>
      </div>
      <div className="weather-summary">
        <span className="weather-glyph" aria-hidden="true">☼</span>
        <div><strong>{weather.temp}°F <span>/ {weather.condition.toLowerCase()}</span></strong><small>{weather.location}</small></div>
      </div>
    </header>
  )
}

function Panel({ path, meta, children, primary = false, index = 0, className = '' }) {
  return (
    <section className={`terminal-panel ${primary ? 'primary-panel' : ''} ${className}`} style={{ '--panel-delay': `${Math.min(index, 4) * 45}ms` }}>
      <header className="panel-header"><h2><span>$ cat </span>{path}</h2>{meta && <div className="panel-meta">{meta}</div>}</header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

function FocusTasks({ tasks, onToggle, onAdd, showCompleted, onToggleCompleted, index }) {
  const completed = tasks.filter((task) => task.done).length
  const visible = showCompleted ? tasks : tasks.filter((task) => !task.done)
  const progress = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)

  function submit(event) {
    event.preventDefault()
    const input = event.currentTarget.elements.task
    const label = input.value.trim()
    if (!label) return
    onAdd(label)
    input.value = ''
  }

  return (
    <Panel path="~/focus/today.md" primary index={index} className="focus-panel" meta={<button className="panel-meta-button" onClick={onToggleCompleted}>{completed}/{tasks.length} done</button>}>
      <div className="progress-row"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
      <ul className="focus-list">
        {visible.map((task, position) => {
          const isNext = !task.done && visible.find((item) => !item.done)?.id === task.id
          return <li key={task.id}><button className={`focus-task ${isNext ? 'next-task' : ''} ${task.done ? 'completed-task' : ''}`} onClick={() => onToggle(task.id)} aria-pressed={task.done}>
            <span className="task-box" aria-hidden="true">{task.done ? '×' : ''}</span>
            <span className="task-text"><strong>{task.label}</strong><small>{String(position + 1).padStart(2, '0')} · {task.project} · est {task.estimate}{isNext && <em> · up next</em>}</small></span>
          </button></li>
        })}
        {visible.length === 0 && <li className="empty-task">everything checked off.<small>Add something below or close the laptop.</small></li>}
      </ul>
      <form className="add-task-form" onSubmit={submit}><label htmlFor="new-task">&gt;</label><input id="new-task" name="task" placeholder="add a focus task..." autoComplete="off" /><button type="submit">+ add</button></form>
    </Panel>
  )
}

function WeatherPanel({ index }) {
  const temps = weather.hourly.map((entry) => entry.temp)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const span = Math.max(max - min, 1)

  return <Panel path="~/weather.now" index={index} className="weather-panel" meta={weather.location}>
    <div className="weather-details"><div><strong className="large-temp">{weather.temp}°</strong><p>feels {weather.feelsLike}° · {weather.condition.toLowerCase()}</p></div><dl><div><dt>↕</dt><dd><b>{weather.high}°</b> / {weather.low}°</dd></div><div><dt>⌁</dt><dd>{weather.windMph} mph</dd></div><div><dt>♢</dt><dd>{weather.humidity}%</dd></div></dl></div>
    <div className="forecast"><div className="forecast-bars">{weather.hourly.map((entry) => <div className="forecast-hour" key={entry.hour}><span>{entry.temp}</span><i style={{ height: `${12 + ((entry.temp - min) / span) * 30}px` }} /><small>{entry.hour}</small></div>)}</div></div>
  </Panel>
}

function AssignmentsPanel({ now, index }) {
  const soon = assignments.filter((item) => item.dueInHours <= 24).length
  return <Panel path="~/edu/assignments" index={index} className="assignments-panel" meta={<span>{assignments.length} queued <b className="danger-text">· {soon} due &lt;24h</b></span>}>
    <ol className="assignment-list"><span className="assignment-line" aria-hidden="true" />{assignments.map((item) => <li key={item.id}><span className={`assignment-dot ${item.dueInHours <= 12 ? 'danger-dot' : item.dueInHours <= 48 ? 'warn-dot' : ''}`} aria-hidden="true" /><div><div className="assignment-title"><strong>{item.title}</strong><span className={item.dueInHours <= 12 ? 'danger-text' : item.dueInHours <= 48 ? 'warn-text' : ''}>{dueLabel(item.dueInHours)}</span></div><small>{item.course} · {item.kind} · {item.weight} of grade · due {dueClock(item.dueInHours, now)}</small></div></li>)}</ol>
  </Panel>
}

function PullRequestsPanel({ index }) {
  const needsAttention = pullRequests.filter((pr) => pr.checks === 'failing' || pr.review === 'changes requested').length
  return <Panel path="~/git/pulls --author=@me" index={index} className="pulls-panel" meta={<span>{pullRequests.length} open <b className="warn-text">· {needsAttention} need attention</b></span>}>
    <div className="pulls-scroll"><table><thead><tr><th>pull request</th><th>checks</th><th>review</th><th className="align-right">diff</th><th className="align-right">updated</th></tr></thead><tbody>{pullRequests.map((pr) => <tr key={pr.id}><td><div className="pr-title"><span className={pr.isDraft ? 'muted-text' : 'accent-text'} aria-hidden="true">♧</span><div><strong>{pr.title} {pr.isDraft && <small className="draft-label">draft</small>}</strong><small>{pr.repo} #{pr.number} · {pr.branch}</small></div></div></td><td><span className={`check-status ${pr.checks}`}>{pr.checks === 'passing' ? '✓' : pr.checks === 'failing' ? '×' : '◌'} {pr.checks === 'passing' ? 'checks passing' : pr.checks === 'failing' ? 'checks failing' : 'checks running'}</span></td><td className={pr.review === 'approved' ? 'accent-text' : pr.review === 'changes requested' ? 'warn-text' : 'muted-text'}>{pr.review}</td><td className="align-right"><span className="accent-text">+{pr.additions}</span> <span className="danger-text">-{pr.deletions}</span></td><td className="align-right muted-text">{relativeAgo(pr.updatedHoursAgo)}</td></tr>)}</tbody></table></div>
  </Panel>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
