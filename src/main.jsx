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
  const [weather, setWeather] = useState(fallbackWeather)
  const [weatherStatus, setWeatherStatus] = useState('locating')

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

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
  }, [])

  const addTask = useCallback((label) => {
    setTasks((current) => [...current, { id: `t${Date.now()}`, label, project: 'inbox', estimate: '30m', done: false }])
  }, [])

  const tasksLeft = useMemo(() => tasks.filter((task) => !task.done).length, [tasks])

  return (
    <div className="terminal-app">
      <div className="dashboard-frame">
        <DashboardHeader name="Alex" now={now} tasksLeft={tasksLeft} weather={weather} weatherStatus={weatherStatus} />

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
  const needsAttention = pullRequests.filter((pr) => pr.checks === 'failing' || pr.review === 'changes requested').length
  return <Panel path="~/git/pulls --author=@me" index={index} className="pulls-panel" meta={<span>{pullRequests.length} open <b className="warn-text">· {needsAttention} need attention</b></span>}>
    <div className="pulls-scroll"><table><thead><tr><th>pull request</th><th>checks</th><th>review</th><th className="align-right">diff</th><th className="align-right">updated</th></tr></thead><tbody>{pullRequests.map((pr) => <tr key={pr.id}><td><div className="pr-title"><span className={pr.isDraft ? 'muted-text' : 'accent-text'} aria-hidden="true">♧</span><div><strong>{pr.title} {pr.isDraft && <small className="draft-label">draft</small>}</strong><small>{pr.repo} #{pr.number} · {pr.branch}</small></div></div></td><td><span className={`check-status ${pr.checks}`}>{pr.checks === 'passing' ? '✓' : pr.checks === 'failing' ? '×' : '◌'} {pr.checks === 'passing' ? 'checks passing' : pr.checks === 'failing' ? 'checks failing' : 'checks running'}</span></td><td className={pr.review === 'approved' ? 'accent-text' : pr.review === 'changes requested' ? 'warn-text' : 'muted-text'}>{pr.review}</td><td className="align-right"><span className="accent-text">+{pr.additions}</span> <span className="danger-text">-{pr.deletions}</span></td><td className="align-right muted-text">{relativeAgo(pr.updatedHoursAgo)}</td></tr>)}</tbody></table></div>
  </Panel>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
