import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const seedTasks = [
  { id: 't1', label: 'Ship auth refresh-token rotation', project: 'orbit-api', estimate: '2h', due: '2026-09-02', description: 'Rotate refresh tokens on every exchange and keep the existing session invalidation path intact.', timeline: ['Review the current token exchange flow', 'Implement rotation and persistence', 'Add coverage for reuse and expiry', 'Open the PR and request review'], done: false },
  { id: 't2', label: 'Review Priya’s scheduler PR', project: 'orbit-api', estimate: '30m', due: '2026-09-01', description: 'Check the retry budget behavior and make sure failed jobs cannot create an unbounded retry loop.', timeline: ['Read the diff and existing scheduler tests', 'Run the retry-related test suite', 'Leave review notes or approve'], done: false },
  { id: 't3', label: 'Draft CS-441 project proposal', project: 'school', estimate: '45m', due: '2026-09-03', description: 'Turn the project idea into a one-page proposal with the problem, approach, and a realistic scope.', timeline: ['Write a rough problem statement', 'Choose the smallest useful scope', 'Add milestones and proofread'], done: false },
  { id: 't4', label: 'Fix flaky snapshot tests on CI', project: 'dashboard', estimate: '1h', due: '2026-09-04', description: 'Find the source of the intermittent snapshot mismatch and make the test deterministic in CI.', timeline: ['Reproduce the failure locally', 'Trace the source of the unstable output', 'Update the fixture and rerun CI'], done: true },
  { id: 't5', label: 'Morning inbox + standup notes', project: 'admin', estimate: '20m', due: '2026-08-31', description: 'Clear the highest-signal messages and capture anything that should become a task later.', timeline: ['Scan unread messages', 'Capture follow-ups', 'Write the standup update'], done: true },
]

const assignments = [
  { id: 'a1', course: 'CS-441', title: 'Distributed consensus write-up', kind: 'essay', dueInHours: 6, weight: '15%' },
  { id: 'a2', course: 'MATH-312', title: 'Problem set 7 - eigenspaces', kind: 'problem set', dueInHours: 21, weight: '8%' },
  { id: 'a3', course: 'CS-330', title: 'Lab 4: cache simulator', kind: 'lab', dueInHours: 54, weight: '10%' },
  { id: 'a4', course: 'PHIL-210', title: 'Reading response - Nagel', kind: 'reading', dueInHours: 96, weight: '5%' },
  { id: 'a5', course: 'MATH-312', title: 'Midterm exam', kind: 'exam', dueInHours: 168, weight: '30%' },
]

const fallbackWeather = {
  location: 'Current location',
  temp: 20,
  feelsLike: 19,
  condition: 'Locating weather',
  high: 23,
  low: 13,
  windKmh: 11,
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

function relativeUpdated(timestamp) {
  const hours = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 3600000))
  return relativeAgo(hours)
}

function formatTaskDue(value) {
  if (!value) return 'No due date set'
  return new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function readGitHubConfig() {
  try {
    return JSON.parse(window.localStorage.getItem('start.github.config')) || { username: '', token: '' }
  } catch {
    return { username: '', token: '' }
  }
}

async function githubJson(url, token, signal) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(url, { headers, signal })
  if (response.ok) return response.json()
  if (response.status === 401) throw new Error('GitHub rejected the token. Check it and try again.')
  if (response.status === 403) throw new Error('GitHub rate limit reached. Add a token or try again later.')
  if (response.status === 404) throw new Error('GitHub could not access one of these repositories. Check the token permissions.')
  throw new Error(`GitHub returned ${response.status}.`)
}

async function githubPages(url, token, signal) {
  const results = []
  for (let page = 1; page <= 10; page += 1) {
    const joiner = url.includes('?') ? '&' : '?'
    const pageItems = await githubJson(`${url}${joiner}per_page=100&page=${page}`, token, signal)
    if (!Array.isArray(pageItems)) return results
    results.push(...pageItems)
    if (pageItems.length < 100) break
  }
  return results
}

function normalizePullRequest(item, username, fallbackRepo = '') {
  const repo = fallbackRepo || item.repository_url?.replace('https://api.github.com/repos/', '') || item.base?.repo?.full_name || 'unknown/repository'
  return {
    id: `${repo}#${item.number}`,
    number: item.number,
    repo,
    title: item.title,
    author: item.user?.login || 'unknown',
    branch: item.head?.ref || '',
    url: item.html_url,
    updatedAt: item.updated_at,
    draft: Boolean(item.draft),
    isMine: item.user?.login?.toLowerCase() === username.toLowerCase(),
  }
}

async function loadGitHubPullRequests(username, token, signal) {
  const query = encodeURIComponent(`is:pr is:open author:${username}`)
  const authoredItems = await githubPages(`https://api.github.com/search/issues?q=${query}&sort=updated&order=desc`, token, signal)
  const mine = authoredItems.map((item) => normalizePullRequest(item, username))
  const repoNames = [...new Set(mine.map((item) => item.repo))]
  const repositories = []

  for (const repo of repoNames) {
    const repoItems = await githubPages(`https://api.github.com/repos/${repo}/pulls?state=open&sort=updated&direction=desc`, token, signal)
    repositories.push({ name: repo, pullRequests: repoItems.map((item) => normalizePullRequest(item, username, repo)) })
  }

  return { mine, repositories }
}

function weatherDescription(code) {
  if (code === 0) return 'Clear sky'
  if ([1, 2].includes(code)) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if ([45, 48].includes(code)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain'
  if ([71, 73, 75, 77].includes(code)) return 'Snow'
  if ([80, 81, 82].includes(code)) return 'Rain showers'
  if ([85, 86].includes(code)) return 'Snow showers'
  if ([95, 96, 99].includes(code)) return 'Thunderstorms'
  return 'Current conditions'
}

async function loadWeather(latitude, longitude, signal) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    forecast_days: '1',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!response.ok) throw new Error('Weather request failed')
  const data = await response.json()
  const currentHour = data.hourly.time.findIndex((time) => time >= data.current.time)
  const start = currentHour < 0 ? 0 : currentHour
  const hourly = data.hourly.time.slice(start, start + 6).map((time, index) => ({
    hour: time.slice(11, 13),
    temp: Math.round(data.hourly.temperature_2m[start + index]),
  }))

  let location = 'Current location'
  try {
    const reverseParams = new URLSearchParams({ format: 'jsonv2', lat: String(latitude), lon: String(longitude), zoom: '10', addressdetails: '1' })
    const reverseResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?${reverseParams}`, { signal })
    if (reverseResponse.ok) {
      const reverseData = await reverseResponse.json()
      const address = reverseData.address || {}
      const city = address.city || address.town || address.village || address.municipality
      const region = address.state_code || address.state
      if (city) location = region ? `${city}, ${region}` : city
    }
  } catch {
    // Weather still works if the optional city lookup is unavailable.
  }

  return {
    location,
    temp: Math.round(data.current.temperature_2m),
    feelsLike: Math.round(data.current.apparent_temperature),
    condition: weatherDescription(data.current.weather_code),
    high: Math.round(data.daily.temperature_2m_max[0]),
    low: Math.round(data.daily.temperature_2m_min[0]),
    windKmh: Math.round(data.current.wind_speed_10m),
    humidity: Math.round(data.current.relative_humidity_2m),
    hourly: hourly.length ? hourly : fallbackWeather.hourly,
  }
}

function App() {
  const [now, setNow] = useState(() => new Date())
  const [tasks, setTasks] = useState(seedTasks)
  const [showCompleted, setShowCompleted] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [weather, setWeather] = useState(fallbackWeather)
  const [weatherStatus, setWeatherStatus] = useState('locating')

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedTask) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSelectedTask(null)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedTask])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    if (!navigator.geolocation) {
      setWeatherStatus('unavailable')
      return () => controller.abort()
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (cancelled) return
        setWeatherStatus('updating')
        try {
          const currentWeather = await loadWeather(coords.latitude, coords.longitude, controller.signal)
          if (!cancelled) {
            setWeather(currentWeather)
            setWeatherStatus('live')
          }
        } catch {
          if (!cancelled) setWeatherStatus('offline')
        }
      },
      () => {
        if (!cancelled) setWeatherStatus('permission needed')
      },
      { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 10000 },
    )

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const toggleTask = useCallback((id) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)))
    setSelectedTask((current) => current && current.id === id ? { ...current, done: !current.done } : current)
  }, [])

  const addTask = useCallback((label) => {
    const nextTask = { id: `t${Date.now()}`, label, project: 'inbox', estimate: '30m', due: '', description: 'Captured from the focus input. Add more context so the next step is obvious.', timeline: ['Define the first concrete step', 'Make a small block of progress', 'Review and decide what comes next'], done: false }
    setTasks((current) => [...current, nextTask])
    setSelectedTask(nextTask)
  }, [])

  const updateTask = useCallback((id, updates) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...updates } : task)))
    setSelectedTask((current) => current && current.id === id ? { ...current, ...updates } : current)
  }, [])

  const tasksLeft = useMemo(() => tasks.filter((task) => !task.done).length, [tasks])

  return (
    <div className="terminal-app">
      <div className="dashboard-frame">
        <DashboardHeader name="Alex" now={now} tasksLeft={tasksLeft} weather={weather} weatherStatus={weatherStatus} />

        <main className="dashboard-grid">
          <FocusTasks
            tasks={tasks}
            onAdd={addTask}
            onOpen={setSelectedTask}
            showCompleted={showCompleted}
            onToggleCompleted={() => setShowCompleted((current) => !current)}
            index={0}
          />

          <div className="side-stack">
            <WeatherPanel index={1} weather={weather} weatherStatus={weatherStatus} />
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
      {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} onToggle={toggleTask} onSave={updateTask} />}
    </div>
  )
}

function DashboardHeader({ name, now, tasksLeft, weather, weatherStatus }) {
  return (
    <header className="dashboard-header">
      <div className="header-copy">
        <p className="command-line">alex@localhost:~$ ./dashboard --today</p>
        <h1><span className="accent-text">{greetingFor(now)},</span> {name}<span className="caret" aria-hidden="true" /></h1>
        <p className="header-meta">{formatDateLine(now)} <span aria-hidden="true">·</span> <span className="bright-text">{formatClock(now)}</span> <span aria-hidden="true">·</span> {tasksLeft} focus task{tasksLeft === 1 ? '' : 's'} remaining</p>
      </div>
      <div className="weather-summary">
        <span className="weather-glyph" aria-hidden="true">☼</span>
        <div><strong>{weather.temp}°C <span>/ {weather.condition.toLowerCase()}</span></strong><small>{weatherStatus === 'live' ? weather.location : `location ${weatherStatus}`}</small></div>
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

function FocusTasks({ tasks, onAdd, onOpen, showCompleted, onToggleCompleted, index }) {
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
          return <li key={task.id}><button className={`focus-task ${isNext ? 'next-task' : ''} ${task.done ? 'completed-task' : ''}`} onClick={() => onOpen(task)} aria-haspopup="dialog">
            <span className="task-box" aria-hidden="true">{task.done ? '×' : ''}</span>
            <span className="task-text"><strong>{task.label}</strong><small>{String(position + 1).padStart(2, '0')} · {task.project} · est {task.estimate}{isNext && <em> · up next</em>}</small></span><span className="task-open" aria-hidden="true">↗</span>
          </button></li>
        })}
        {visible.length === 0 && <li className="empty-task">everything checked off.<small>Add something below or close the laptop.</small></li>}
      </ul>
      <form className="add-task-form" onSubmit={submit}><label htmlFor="new-task">&gt;</label><input id="new-task" name="task" placeholder="add a focus task..." autoComplete="off" /><button type="submit">+ add</button></form>
    </Panel>
  )
}

function TaskModal({ task, onClose, onToggle, onSave }) {
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
      <header className="task-modal-header"><span className="command-line">$ cat ~/focus/{task.id}.md</span><button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Close task details">×</button></header>
      {editing ? <form className="task-edit-form" onSubmit={save}>
        <label><span>task</span><input value={draft.label} onChange={(event) => updateDraft('label', event.target.value)} autoFocus /></label>
        <label><span>description</span><textarea value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} rows="3" /></label>
        <div className="task-edit-grid"><label><span>estimate</span><input value={draft.estimate} onChange={(event) => updateDraft('estimate', event.target.value)} /></label><label><span>due date</span><input type="date" value={draft.due} onChange={(event) => updateDraft('due', event.target.value)} /></label></div>
        <label><span>timeline <small>one step per line</small></span><textarea value={timelineText} onChange={(event) => updateDraft('timelineText', event.target.value)} rows="5" /></label>
        <div className="task-modal-actions"><button type="button" className="modal-secondary" onClick={() => setEditing(false)}>cancel</button><button type="submit" className="modal-primary">save changes</button></div>
      </form> : <div className="task-detail">
        <div className="task-detail-top"><span className="eyebrow">{task.project} · {task.done ? 'completed' : 'focus task'}</span><span className="task-detail-id">{task.id}</span></div>
        <h2 id="task-modal-title">{task.label}</h2>
        <p id="task-modal-description" className="task-description">{task.description || 'No description yet. Add context to make this task easier to pick back up.'}</p>
        <div className="task-facts"><div><span>estimate</span><strong>{task.estimate}</strong></div><div><span>due</span><strong>{formatTaskDue(task.due)}</strong></div></div>
        <div className="timeline-block"><span className="eyebrow">Suggested timeline</span><ol>{task.timeline?.length ? task.timeline.map((step, index) => <li key={`${step}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>) : <li className="timeline-empty">No timeline yet. Add one while editing.</li>}</ol></div>
        <div className="task-modal-actions"><button className="modal-secondary" onClick={() => setEditing(true)}>edit task</button><button className={`modal-primary ${task.done ? 'reopen-button' : ''}`} onClick={() => onToggle(task.id)}>{task.done ? 'reopen task' : 'mark complete'}</button></div>
      </div>}
    </section>
  </div>
}

function WeatherPanel({ index, weather, weatherStatus }) {
  const temps = weather.hourly.map((entry) => entry.temp)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const span = Math.max(max - min, 1)

  return <Panel path="~/weather.now" index={index} className="weather-panel" meta={<span>{weather.location} · {weatherStatus}</span>}>
    <div className="weather-details"><div><strong className="large-temp">{weather.temp}°C</strong><p>feels {weather.feelsLike}° · {weather.condition.toLowerCase()}</p></div><dl><div><dt>↕</dt><dd><b>{weather.high}°</b> / {weather.low}°</dd></div><div><dt>⌁</dt><dd>{weather.windKmh} km/h</dd></div><div><dt>♢</dt><dd>{weather.humidity}%</dd></div></dl></div>
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
  const [config, setConfig] = useState(readGitHubConfig)
  const [draftUsername, setDraftUsername] = useState(config.username)
  const [draftToken, setDraftToken] = useState(config.token)
  const [state, setState] = useState({ status: config.username ? 'loading' : 'setup', data: null, error: '' })

  useEffect(() => {
    if (!config.username) return undefined
    let cancelled = false
    const controller = new AbortController()
    setState({ status: 'loading', data: null, error: '' })
    loadGitHubPullRequests(config.username, config.token, controller.signal)
      .then((data) => { if (!cancelled) setState({ status: 'ready', data, error: '' }) })
      .catch((error) => { if (!cancelled && error.name !== 'AbortError') setState({ status: 'error', data: null, error: error.message }) })
    return () => { cancelled = true; controller.abort() }
  }, [config])

  function connect(event) {
    event.preventDefault()
    const username = draftUsername.trim()
    if (!username) return
    const next = { username, token: draftToken.trim() }
    window.localStorage.setItem('start.github.config', JSON.stringify(next))
    setConfig(next)
  }

  function disconnect() {
    window.localStorage.removeItem('start.github.config')
    setConfig({ username: '', token: '' })
    setDraftUsername('')
    setDraftToken('')
    setState({ status: 'setup', data: null, error: '' })
  }

  const meta = state.status === 'ready' ? <span>{state.data.mine.length} mine · {state.data.repositories.length} repos</span> : state.status === 'loading' ? <span>syncing...</span> : null
  return <Panel path="~/git/pulls --author=@me" index={index} className="pulls-panel" meta={meta}>
    {!config.username ? <GitHubSetup username={draftUsername} token={draftToken} onUsernameChange={setDraftUsername} onTokenChange={setDraftToken} onSubmit={connect} /> : state.status === 'loading' ? <div className="github-message"><span className="accent-text">◌</span> syncing open pull requests for {config.username}...</div> : state.status === 'error' ? <div className="github-message error-message"><strong>github sync failed</strong><span>{state.error}</span><div><button className="github-action" onClick={() => setConfig({ ...config })}>retry</button><button className="github-action" onClick={disconnect}>change account</button></div></div> : <GitHubDataView data={state.data} username={config.username} onDisconnect={disconnect} />}
  </Panel>
}

function GitHubSetup({ username, token, onUsernameChange, onTokenChange, onSubmit }) {
  return <form className="github-setup" onSubmit={onSubmit}>
    <div><span className="github-setup-icon accent-text" aria-hidden="true">♧</span><div><strong>Connect GitHub to make this panel live.</strong><p>Enter your username for public repositories. Add a Personal Access Token if you want private repositories and a higher API limit.</p></div></div>
    <div className="github-fields"><label><span>username</span><input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="your-github-name" autoComplete="username" /></label><label><span>token <small>(optional)</small></span><input type="password" value={token} onChange={(event) => onTokenChange(event.target.value)} placeholder="github_pat_..." autoComplete="current-password" /></label><button className="github-connect" type="submit">connect ↵</button></div>
    <small className="github-security-note">For now, the token stays in this browser’s local storage. We can move it to the Windows keychain when we wrap Start in Tauri.</small>
  </form>
}

function GitHubDataView({ data, username, onDisconnect }) {
  return <div className="github-data"><div className="github-toolbar"><span><span className="accent-text">●</span> connected as {username}</span><button className="github-action" onClick={onDisconnect}>disconnect</button></div><div className="github-scroll-region"><section className="github-section"><div className="github-section-header"><strong>1 · my open PRs</strong><span>{data.mine.length}</span></div>{data.mine.length ? <div className="github-pr-list">{data.mine.map((pr) => <GitHubPRRow key={pr.id} pr={pr} showRepo />)}</div> : <p className="github-empty">No open PRs authored by {username}.</p>}</section><section className="github-section"><div className="github-section-header"><strong>2 · repositories I’ve contributed to</strong><span>{data.repositories.length}</span></div>{data.repositories.length ? <div className="github-repository-list">{data.repositories.map((repository) => repository.pullRequests.length > 5 ? <GitHubRepositorySummary key={repository.name} repository={repository} /> : <div className="github-repository-group" key={repository.name}><div className="github-repository-title"><strong>{repository.name}</strong><span>{repository.pullRequests.length} open</span></div>{repository.pullRequests.map((pr) => <GitHubPRRow key={pr.id} pr={pr} showAuthor />)}</div>)}</div> : <p className="github-empty">No repositories with open PRs authored by {username}.</p>}</section></div></div>
}

function GitHubPRRow({ pr, showRepo, showAuthor }) {
  return <a className="github-pr-row" href={pr.url} target="_blank" rel="noreferrer"><span className={`github-pr-icon ${pr.draft ? 'muted-text' : 'accent-text'}`} aria-hidden="true">♧</span><span className="github-pr-copy"><strong>{pr.title}{pr.draft && <small className="draft-label">draft</small>}</strong><small>{showRepo ? `${pr.repo} #${pr.number}` : `#${pr.number}`}{showAuthor ? ` · opened by ${pr.author}` : ''}{pr.branch ? ` · ${pr.branch}` : ''}</small></span><span className="github-pr-updated">{relativeUpdated(pr.updatedAt)}</span><span className="github-external" aria-hidden="true">↗</span></a>
}

function GitHubRepositorySummary({ repository }) {
  return <a className="github-repository-summary" href={`https://github.com/${repository.name}/pulls`} target="_blank" rel="noreferrer"><span className="github-pr-icon accent-text" aria-hidden="true">♧</span><span><strong>{repository.name}</strong><small>{repository.pullRequests.length} open PRs · showing repository instead</small></span><span className="github-external" aria-hidden="true">↗</span></a>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
