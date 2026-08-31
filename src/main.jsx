import React, { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './styles.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const seedTasks = [
  { id: 't1', label: 'Ship auth refresh-token rotation', project: 'orbit-api', estimate: '2h', due: '2026-09-02', description: 'Rotate refresh tokens on every exchange and keep the existing session invalidation path intact.', timeline: ['Review the current token exchange flow', 'Implement rotation and persistence', 'Add coverage for reuse and expiry', 'Open the PR and request review'], done: false },
  { id: 't2', label: 'Review Priya’s scheduler PR', project: 'orbit-api', estimate: '30m', due: '2026-09-01', description: 'Check the retry budget behavior and make sure failed jobs cannot create an unbounded retry loop.', timeline: ['Read the diff and existing scheduler tests', 'Run the retry-related test suite', 'Leave review notes or approve'], done: false },
  { id: 't3', label: 'Draft CS-441 project proposal', project: 'school', estimate: '45m', due: '2026-09-03', description: 'Turn the project idea into a one-page proposal with the problem, approach, and a realistic scope.', timeline: ['Write a rough problem statement', 'Choose the smallest useful scope', 'Add milestones and proofread'], done: false },
  { id: 't4', label: 'Fix flaky snapshot tests on CI', project: 'dashboard', estimate: '1h', due: '2026-09-04', description: 'Find the source of the intermittent snapshot mismatch and make the test deterministic in CI.', timeline: ['Reproduce the failure locally', 'Trace the source of the unstable output', 'Update the fixture and rerun CI'], done: true },
  { id: 't5', label: 'Morning inbox + standup notes', project: 'admin', estimate: '20m', due: '2026-08-31', description: 'Clear the highest-signal messages and capture anything that should become a task later.', timeline: ['Scan unread messages', 'Capture follow-ups', 'Write the standup update'], done: true },
]

const FOCUS_STATE_KEY = 'start.focus.state'
const ASSIGNMENTS_STATE_KEY = 'start.assignments'

function dayKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function readFocusState(date) {
  const today = dayKey(date)
  try {
    const saved = JSON.parse(window.localStorage.getItem(FOCUS_STATE_KEY))
    if (!saved || !Array.isArray(saved.tasks)) return { day: today, tasks: seedTasks, shouldDraft: false }
    if (saved.day === today) return { day: today, tasks: saved.tasks, shouldDraft: false }
    return { day: today, tasks: saved.tasks.filter((task) => !task.done), shouldDraft: true }
  } catch {
    return { day: today, tasks: seedTasks, shouldDraft: false }
  }
}

function readAssignments() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ASSIGNMENTS_STATE_KEY))
    if (!Array.isArray(saved)) return []
    return saved.map((item, index) => ({
      id: String(item?.id || `assignment-${index}`),
      course: String(item?.course || '').trim(),
      title: String(item?.title || '').trim(),
      kind: String(item?.kind || 'assignment').trim(),
      dueInHours: item?.dueInHours !== undefined && item?.dueInHours !== null && item?.dueInHours !== '' && Number.isFinite(Number(item.dueInHours)) ? Number(item.dueInHours) : null,
      dueAt: String(item?.dueAt || '').trim(),
      weight: String(item?.weight || '').trim(),
      source: String(item?.source || '').trim(),
    })).filter((item) => item.title && !item.id.startsWith('google-'))
  } catch {
    return []
  }
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start >= 0 && end >= start) return JSON.parse(cleaned.slice(start, end + 1))
  const parsed = JSON.parse(cleaned)
  return parsed.assignments || parsed.tasks || []
}

function formatSyllabusDue(value) {
  const date = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ''
  return new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`)).toLowerCase()
}

function normalizeSyllabusAssignments(items, now, sourceNames) {
  if (!Array.isArray(items)) return []
  return items.map((item, index) => {
    const title = String(item?.title || item?.label || '').trim()
    const course = String(item?.course || '').trim()
    const dueAt = String(item?.dueAt || item?.due || '').trim().slice(0, 10)
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueAt) ? new Date(`${dueAt}T23:59:00`) : null
    const dueInHours = dueDate && !Number.isNaN(dueDate.getTime()) ? Math.max(0, Math.round((dueDate.getTime() - now.getTime()) / 3600000)) : null
    return {
      id: `syllabus-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`,
      course,
      title,
      kind: String(item?.kind || (/midterm|exam|quiz|test/i.test(title) ? 'exam' : 'assignment')).trim(),
      dueInHours,
      dueAt: formatSyllabusDue(dueAt),
      weight: String(item?.weight || '').trim(),
      source: sourceNames.join(', '),
    }
  }).filter((item) => item.title)
}

async function draftAssignmentsFromSyllabi(sources, now, signal) {
  const prompt = `You are Qwen, a local academic planning assistant. Extract every upcoming assignment, project, paper, lab, quiz, exam, midterm, presentation, or report from these syllabi. Do not invent work that is not in the source. Return only a JSON object with an assignments array. Each assignment must contain exactly: title, course, kind, dueAt, weight. Use ISO dates (YYYY-MM-DD) for dueAt when a date is stated; otherwise use an empty string. Preserve the course name and grading weight when available.

Current date: ${dayKey(now)}

Syllabi:
${sources.map((source) => `--- ${source.name} ---\n${source.text}`).join('\n\n')}`
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: 'qwen2.5:7b',
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: 'Extract only assignments explicitly present in the supplied syllabi. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Qwen returned ${response.status}`)
  const data = await response.json()
  const content = data.message?.content || data.response || ''
  return normalizeSyllabusAssignments(extractJson(content), now, sources.map((source) => source.name))
}

async function readSyllabusFile(file) {
  if (!/\.pdf$/i.test(file.name)) return { name: file.name, text: await file.text() }
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str).join(' '))
  }
  const text = pages.join('\n\n').trim()
  if (!text) throw new Error(`${file.name} has no selectable text. Scanned PDFs need OCR before import.`)
  return { name: file.name, text }
}

function normalizeDraftTasks(items) {
  if (!Array.isArray(items)) return []
  return items.map((item, index) => ({
    id: `qwen-${Date.now()}-${index}`,
    label: String(item?.label || '').trim(),
    project: String(item?.project || item?.course || 'school').trim(),
    estimate: String(item?.estimate || '30m').trim(),
    due: String(item?.due || '').trim(),
    description: String(item?.description || 'Drafted by Qwen from the upcoming assignment queue.').trim(),
    timeline: Array.isArray(item?.timeline) ? item.timeline.map((step) => String(step).trim()).filter(Boolean) : [],
    done: false,
  })).filter((task) => task.label)
}

async function draftFocusTasks(today, carriedTasks, assignments, signal) {
  const prompt = `You are Qwen, a local planning assistant. Draft 2 to 4 concrete focus tasks for ${today} from the upcoming assignments and midterms below. Prioritize the closest deadlines and high-weight work. Do not duplicate the carried-over tasks. Return only a JSON array with objects containing exactly: label, project, estimate, due, description, timeline. Use short labels, estimates like "45m" or "2h", ISO dates for due when known, and 2 to 4 timeline steps.\n\nUpcoming assignments:\n${JSON.stringify(assignments)}\n\nCarried-over incomplete tasks:\n${JSON.stringify(carriedTasks)}`
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: 'qwen2.5:7b',
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: 'You create concise, actionable study and work plans. Output valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Qwen returned ${response.status}`)
  const data = await response.json()
  const content = data.message?.content || data.response || ''
  return normalizeDraftTasks(extractJson(content))
}

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
  const ownedRepositories = await githubPages(`https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc`, token, signal)
  const repoNames = ownedRepositories
    .filter((repository) => repository.owner?.login?.toLowerCase() === username.toLowerCase())
    .map((repository) => repository.full_name)
    .filter(Boolean)
  const repositories = []

  for (const repo of repoNames) {
    const repoItems = await githubPages(`https://api.github.com/repos/${repo}/pulls?state=open&sort=updated&direction=desc`, token, signal)
    const pullRequests = repoItems.map((item) => normalizePullRequest(item, username, repo))
    if (pullRequests.length) repositories.push({ name: repo, pullRequests })
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
  const [focusState] = useState(() => readFocusState(new Date()))
  const [tasks, setTasks] = useState(() => focusState.tasks)
  const [focusDay, setFocusDay] = useState(() => focusState.day)
  const [focusStatus, setFocusStatus] = useState(() => focusState.shouldDraft ? 'planning' : 'ready')
  const [assignments, setAssignments] = useState(readAssignments)
  const [syllabusState, setSyllabusState] = useState({ status: 'idle', error: '' })
  const [showCompleted, setShowCompleted] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [weather, setWeather] = useState(fallbackWeather)
  const [weatherStatus, setWeatherStatus] = useState('locating')
  const tasksRef = useRef(tasks)
  const assignmentsRef = useRef(assignments)
  const lastFocusDayRef = useRef(focusState.day)
  const draftControllerRef = useRef(null)
  const syllabusControllerRef = useRef(null)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const runFocusDraft = useCallback(async (day, carriedTasks) => {
    draftControllerRef.current?.abort()
    if (!assignmentsRef.current.length) {
      setFocusStatus('no-data')
      return
    }
    const controller = new AbortController()
    draftControllerRef.current = controller
    setFocusStatus('planning')

    try {
      const draftedTasks = await draftFocusTasks(day, carriedTasks, assignmentsRef.current, controller.signal)
      if (controller.signal.aborted || lastFocusDayRef.current !== day) return
      setTasks((current) => [...current, ...draftedTasks])
      setFocusStatus(draftedTasks.length ? 'ready' : 'offline')
    } catch (error) {
      if (!controller.signal.aborted && lastFocusDayRef.current === day) setFocusStatus('offline')
    }
  }, [])

  useEffect(() => {
    tasksRef.current = tasks
    try {
      window.localStorage.setItem(FOCUS_STATE_KEY, JSON.stringify({ day: focusDay, tasks }))
    } catch {
      // The focus list still works when browser storage is unavailable.
    }
  }, [tasks, focusDay])

  useEffect(() => {
    assignmentsRef.current = assignments
    try {
      window.localStorage.setItem(ASSIGNMENTS_STATE_KEY, JSON.stringify(assignments))
    } catch {
      // Assignment data still remains available for this session when storage is unavailable.
    }
  }, [assignments])

  useEffect(() => {
    if (focusState.shouldDraft) runFocusDraft(focusState.day, tasksRef.current)
    return () => draftControllerRef.current?.abort()
  }, [focusState, runFocusDraft])

  useEffect(() => {
    const today = dayKey(now)
    if (today === lastFocusDayRef.current) return

    lastFocusDayRef.current = today
    const carriedTasks = tasksRef.current.filter((task) => !task.done)
    setFocusDay(today)
    setTasks(carriedTasks)
    setSelectedTask((current) => current && current.done ? null : current)
    runFocusDraft(today, carriedTasks)
  }, [now, runFocusDraft])

  const importSyllabi = useCallback(async (files) => {
    if (!files.length) return
    syllabusControllerRef.current?.abort()
    const controller = new AbortController()
    syllabusControllerRef.current = controller
    setSyllabusState({ status: 'importing', error: '' })
    try {
      const sources = await Promise.all(files.map(async (file) => {
        if (!/\.(txt|md|csv|json|html?|pdf)$/i.test(file.name)) throw new Error(`${file.name} is not a supported syllabus. Use .txt, .md, .csv, .json, .html, or .pdf.`)
        return readSyllabusFile(file)
      }))
      const importedAssignments = await draftAssignmentsFromSyllabi(sources, now, controller.signal)
      if (controller.signal.aborted) return
      setAssignments((current) => {
        const next = [...current]
        importedAssignments.forEach((item) => {
          const duplicate = next.find((existing) => existing.title.toLowerCase() === item.title.toLowerCase() && existing.course.toLowerCase() === item.course.toLowerCase())
          if (duplicate) Object.assign(duplicate, item)
          else next.push(item)
        })
        return next.sort((a, b) => (a.dueInHours ?? Number.MAX_SAFE_INTEGER) - (b.dueInHours ?? Number.MAX_SAFE_INTEGER))
      })
      setSyllabusState({ status: importedAssignments.length ? 'ready' : 'empty', error: '' })
    } catch (error) {
      if (!controller.signal.aborted && error.name !== 'AbortError') setSyllabusState({ status: 'error', error: error.message })
    }
  }, [now])

  useEffect(() => () => syllabusControllerRef.current?.abort(), [])

  const clearAssignments = useCallback(() => {
    window.localStorage.removeItem(ASSIGNMENTS_STATE_KEY)
    setAssignments([])
    setSyllabusState({ status: 'idle', error: '' })
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
            focusStatus={focusStatus}
            index={0}
          />

          <div className="side-stack">
            <WeatherPanel index={1} weather={weather} weatherStatus={weatherStatus} />
            <AssignmentsPanel now={now} assignments={assignments} index={2} syllabusState={syllabusState} onImport={importSyllabi} onClear={clearAssignments} />
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
      <ChatBar />
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

function FocusTasks({ tasks, onAdd, onOpen, showCompleted, onToggleCompleted, focusStatus, index }) {
  const completed = tasks.filter((task) => task.done).length
  const visible = showCompleted ? tasks : tasks.filter((task) => !task.done)
  const progress = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)
  const syncLabel = focusStatus === 'planning' ? 'Qwen drafting...' : focusStatus === 'offline' ? 'Qwen unavailable' : ''

  function submit(event) {
    event.preventDefault()
    const input = event.currentTarget.elements.task
    const label = input.value.trim()
    if (!label) return
    onAdd(label)
    input.value = ''
  }

  return (
    <Panel path="~/focus/today.md" primary index={index} className="focus-panel" meta={<span className="focus-meta"><button className="panel-meta-button" onClick={onToggleCompleted}>{completed}/{tasks.length} done</button>{syncLabel && <span className={`focus-sync-status ${focusStatus}`}> · {syncLabel}</span>}</span>}>
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

const suggestedPrompts = [
  'Plan my afternoon around what’s due',
  'Which PR should I unblock first?',
  'Summarize my week',
]

const assistantReply = {
  thinking: 'Checked task due dates, current time, and recent PR metadata.',
  answer: `Here's how I'd sequence the rest of your day.

**Suggested blocks**

1. **14:45 – 16:15 – CS-441 write-up.** Hard deadline in 6h and worth 15% of the grade.
   Nothing else in the board is time-boxed this tightly.
2. **16:15 – 16:45 – Review Priya's scheduler PR.** Short, and it's currently blocking someone else. CI is red on it, so flag the failing job in your review rather than leaving every line.
3. **16:45 – 18:45 – Ship refresh-token rotation.** \`orbit-api#1842\` is already approved with green checks, so this is merge-and-monitor rather than new work.

**What I'd drop**

- The flaky snapshot tests are already checked off, so ignore them.
- \`dotfiles#77\` is a draft with no reviewer waiting – leave it for the weekend.

> Rain probability climbs to 35% around 19:00, so if you run planning to walk, go before 18:00.

Want me to rewrite your focus list in this order?`,
}

function tokenize(text) {
  return text.split(/(\s+)/).filter(Boolean)
}

function renderInline(text, keyPrefix) {
  return text.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>
    return <React.Fragment key={key}>{part}</React.Fragment>
  })
}

function AssistantMarkdown({ text }) {
  return <div className="assistant-markdown">{text.split('\n').map((line, index) => {
    const key = `line-${index}`
    if (!line) return <span className="assistant-break" key={key} aria-hidden="true" />
    if (line.startsWith('> ')) return <blockquote key={key}>{renderInline(line.slice(2), key)}</blockquote>
    if (/^\d+\. /.test(line)) {
      const [, number, content] = line.match(/^(\d+)\. (.*)$/)
      return <div className="assistant-list-item" key={key}><span>{number}.</span><p>{renderInline(content, key)}</p></div>
    }
    if (line.startsWith('- ')) return <div className="assistant-list-item assistant-bullet" key={key}><span>–</span><p>{renderInline(line.slice(2), key)}</p></div>
    if (line.startsWith('**') && line.endsWith('**')) return <p className="assistant-heading" key={key}>{renderInline(line, key)}</p>
    return <p key={key}>{renderInline(line, key)}</p>
  })}</div>
}

function ChatBar() {
  const [isOpen, setIsOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const scrollRef = useRef(null)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach((timer) => window.clearInterval(timer)), [])

  useEffect(() => {
    if (isOpen && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isOpen])

  function reset() {
    timers.current.forEach((timer) => window.clearInterval(timer))
    timers.current = []
    setMessages([])
    setIsStreaming(false)
    setThinkingOpen(false)
  }

  function send(value) {
    const prompt = value.trim()
    if (!prompt || isStreaming) return
    const assistantId = Date.now()
    setMessages((current) => [...current, { role: 'user', content: prompt }, { id: assistantId, role: 'assistant', content: '', thinking: '', phase: 'thinking' }])
    setDraft('')
    setThinkingOpen(true)
    setIsStreaming(true)

    const thinkingTokens = tokenize(assistantReply.thinking)
    const answerTokens = tokenize(assistantReply.answer)
    let cursor = 0
    const thinkTimer = window.setInterval(() => {
      cursor += 2
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, thinking: thinkingTokens.slice(0, cursor).join('') } : message))
      if (cursor >= thinkingTokens.length) {
        window.clearInterval(thinkTimer)
        setThinkingOpen(false)
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, phase: 'answering', thoughtSeconds: 1, thinking: assistantReply.thinking } : message))
        let answerCursor = 0
        const answerTimer = window.setInterval(() => {
          answerCursor += 2
          setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: answerTokens.slice(0, answerCursor).join('') } : message))
          if (answerCursor >= answerTokens.length) {
            window.clearInterval(answerTimer)
            setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, phase: 'done' } : message))
            setIsStreaming(false)
          }
        }, 18)
        timers.current.push(answerTimer)
      }
    }, 16)
    timers.current.push(thinkTimer)
  }

  function stop() {
    timers.current.forEach((timer) => window.clearInterval(timer))
    timers.current = []
    setIsStreaming(false)
    setThinkingOpen(false)
    setMessages((current) => current.map((message) => message.phase ? { ...message, phase: 'done' } : message))
  }

  function submit(event) {
    event.preventDefault()
    send(draft)
  }

  return <aside className={`assistant-dock ${isOpen ? 'is-open' : 'is-collapsed'}`} aria-label="Assistant sidebar">
    {isOpen ? <>
      <header className="assistant-header">
        <h2><span className="assistant-spark" aria-hidden="true">✣</span><span>~/assistant</span><span className="assistant-model">qwen-2.5-7b</span></h2>
        <div className="assistant-actions">
          <button type="button" className="assistant-icon-button" onClick={reset} aria-label="New conversation" title="New conversation">↻</button>
          <button type="button" className="assistant-icon-button" onClick={() => setIsOpen(false)} aria-label="Collapse assistant" title="Collapse assistant">⇥</button>
        </div>
      </header>
      <div ref={scrollRef} className="assistant-messages" aria-live="polite" aria-busy={isStreaming}>
        {!messages.length ? <div className="assistant-empty-state">
          <p><span className="accent-text">assistant</span> connected to this dashboard.</p>
          <p>It can see your focus list, assignment queue, open pull requests, and today’s forecast. Ask it to triage, plan, or explain anything on screen.</p>
          <div className="assistant-prompts">{suggestedPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => send(prompt)}><span aria-hidden="true">&gt;</span>{prompt}</button>)}</div>
        </div> : messages.map((message, index) => message.role === 'user' ? <div className="assistant-user-message" key={`${message.role}-${index}`}>{message.content}</div> : <div className="assistant-response" key={message.id}>
          <button type="button" className="assistant-thinking-toggle" onClick={() => setThinkingOpen((value) => !value)} aria-expanded={thinkingOpen}><span aria-hidden="true">›</span>{message.phase === 'thinking' ? 'Thinking…' : `Thought for ${message.thoughtSeconds || 1}s`}</button>
          {thinkingOpen && message.thinking ? <p className="assistant-thinking-copy">{message.thinking}</p> : null}
          {message.content ? <AssistantMarkdown text={message.content} /> : null}
        </div>)}
      </div>
      <form className="assistant-form" onSubmit={submit}>
        <span className="assistant-prompt-mark" aria-hidden="true">&gt;</span>
        <label className="visually-hidden" htmlFor="assistant-input">Ask the assistant</label>
        <input id="assistant-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="ask about your day..." />
        {isStreaming ? <button type="button" className="assistant-send" onClick={stop} aria-label="Stop generating">■</button> : <button type="submit" className="assistant-send" disabled={!draft.trim()} aria-label="Send message">↥</button>}
      </form>
      <p className="assistant-hint">enter to send · shift+enter for newline · reads your focus list, courses, repos &amp; forecast</p>
    </> : <button type="button" className="assistant-collapsed" onClick={() => setIsOpen(true)} aria-label="Open assistant" aria-expanded="false"><span aria-hidden="true">⇥</span><span>assistant</span>{isStreaming ? <i aria-hidden="true" /> : null}</button>}
  </aside>
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

/*
function LegacyAssignmentsPanel({ now, index }) {
  const soon = assignments.filter((item) => item.dueInHours <= 24).length
  return <Panel path="~/edu/assignments" index={index} className="assignments-panel" meta={<span>{assignments.length} queued <b className="danger-text">· {soon} due &lt;24h</b></span>}>
    <ol className="assignment-list"><span className="assignment-line" aria-hidden="true" />{assignments.map((item) => <li key={item.id}><span className={`assignment-dot ${item.dueInHours <= 12 ? 'danger-dot' : item.dueInHours <= 48 ? 'warn-dot' : ''}`} aria-hidden="true" /><div><div className="assignment-title"><strong>{item.title}</strong><span className={item.dueInHours <= 12 ? 'danger-text' : item.dueInHours <= 48 ? 'warn-text' : ''}>{dueLabel(item.dueInHours)}</span></div><small>{item.course} · {item.kind} · {item.weight} of grade · due {dueClock(item.dueInHours, now)}</small></div></li>)}</ol>
function AssignmentsPanel({ now, assignments, index, calendarState, clientId, onConnect, onDisconnect }) {
  const soon = assignments.filter((item) => Number.isFinite(item.dueInHours) && item.dueInHours <= 24).length
  const meta = assignments.length ? <span>{assignments.length} queued <b className="danger-text">· {soon} due &lt;24h</b></span> : calendarState.status === 'connected' ? <span>google calendar · 0 matches</span> : null
  return <Panel path="~/edu/assignments" index={index} className="assignments-panel" meta={meta}>
    {assignments.length ? <ol className="assignment-list"><span className="assignment-line" aria-hidden="true" />{assignments.map((item) => {
      const dueHours = Number.isFinite(item.dueInHours) ? item.dueInHours : null
      const dueText = item.dueAt || (dueHours === null ? 'date not set' : dueClock(dueHours, now))
      return <li key={item.id}><span className={`assignment-dot ${dueHours !== null && dueHours <= 12 ? 'danger-dot' : dueHours !== null && dueHours <= 48 ? 'warn-dot' : ''}`} aria-hidden="true" /><div><div className="assignment-title"><strong>{item.title}</strong><span className={dueHours !== null && dueHours <= 12 ? 'danger-text' : dueHours !== null && dueHours <= 48 ? 'warn-text' : ''}>{dueHours === null ? '—' : dueLabel(dueHours)}</span></div><small>{[item.course, item.kind, item.weight && `${item.weight} of grade`, `due ${dueText}`].filter(Boolean).join(' · ')}</small></div></li>
    })}</ol> : <GoogleCalendarSetup clientId={clientId} state={calendarState} onConnect={onConnect} onDisconnect={onDisconnect} />}
  </Panel>
}

function GoogleCalendarSetup({ clientId, state, onConnect, onDisconnect }) {
  const [draftClientId, setDraftClientId] = useState(clientId)
  const [isEditing, setIsEditing] = useState(!clientId)

  useEffect(() => {
    setDraftClientId(clientId)
    setIsEditing(!clientId)
  }, [clientId])

  function submit(event) {
    event.preventDefault()
    onConnect(draftClientId)
    setIsEditing(false)
  }

  if (state.status === 'connecting') return <div className="assignment-empty"><strong>Connecting Google Calendar...</strong><small>Approve calendar read access in the Google sign-in window.</small></div>

  if (state.status === 'error') return <div className="assignment-empty calendar-error"><strong>Google Calendar could not sync.</strong><small>{state.error}</small><div className="calendar-actions"><button type="button" className="calendar-action" onClick={() => setIsEditing(true)}>edit client ID</button>{clientId ? <button type="button" className="calendar-action" onClick={() => onConnect(clientId)}>retry</button> : null}</div>{isEditing ? <CalendarClientIdForm value={draftClientId} onChange={setDraftClientId} onSubmit={submit} /> : null}</div>

  if (!isEditing && clientId && state.status === 'connected') return <div className="assignment-empty"><strong>No upcoming schoolwork found.</strong><small>Google Calendar is connected. Sync events titled assignment, midterm, exam, quiz, test, project, paper, lab, or report.</small><div className="calendar-actions"><button type="button" className="calendar-action" onClick={() => onConnect(clientId)}>sync again</button><button type="button" className="calendar-action" onClick={onDisconnect}>disconnect</button></div></div>

  if (!isEditing && clientId) return <div className="assignment-empty"><strong>Google Calendar is ready to sync.</strong><small>Your client ID is saved locally. Connect to import upcoming assignments and midterms.</small><div className="calendar-actions"><button type="button" className="calendar-connect" onClick={() => onConnect(clientId)}>connect Google Calendar <span aria-hidden="true">↗</span></button><button type="button" className="calendar-action" onClick={() => setIsEditing(true)}>edit client ID</button></div></div>

  return <div className="assignment-empty"><strong>Connect Google Calendar.</strong><small>Import upcoming assignments and midterms so Qwen can draft your focus tasks.</small><CalendarClientIdForm value={draftClientId} onChange={setDraftClientId} onSubmit={submit} /></div>
}

function CalendarClientIdForm({ value, onChange, onSubmit }) {
  return <form className="calendar-setup" onSubmit={onSubmit}><label><span>Google OAuth client ID</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="123...apps.googleusercontent.com" autoComplete="off" required /></label><button type="submit" className="calendar-connect">connect Google Calendar <span aria-hidden="true">↗</span></button><small>Use a Web application client ID with this app&apos;s local URL as an authorized origin.</small><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">create a client ID in Google Cloud ↗</a></form>
}

*/

function AssignmentsPanel({ now, assignments, index, syllabusState, onImport, onClear }) {
  const soon = assignments.filter((item) => Number.isFinite(item.dueInHours) && item.dueInHours <= 24).length
  const meta = assignments.length ? <span>{assignments.length} queued <b className="danger-text">· {soon} due &lt;24h</b></span> : syllabusState.status === 'importing' ? <span>qwen extracting...</span> : null
  return <Panel path="~/edu/assignments" index={index} className="assignments-panel" meta={meta}>
    {assignments.length ? <><div className="assignment-toolbar"><span>source: syllabi · qwen-2.5-7b</span><SyllabusImportButton onImport={onImport} /><button type="button" className="assignment-action" onClick={onClear}>clear</button></div><ol className="assignment-list"><span className="assignment-line" aria-hidden="true" />{assignments.map((item) => {
      const dueHours = Number.isFinite(item.dueInHours) ? item.dueInHours : null
      const dueText = item.dueAt || (dueHours === null ? 'date not set' : dueClock(dueHours, now))
      return <li key={item.id}><span className={`assignment-dot ${dueHours !== null && dueHours <= 12 ? 'danger-dot' : dueHours !== null && dueHours <= 48 ? 'warn-dot' : ''}`} aria-hidden="true" /><div><div className="assignment-title"><strong>{item.title}</strong><span className={dueHours !== null && dueHours <= 12 ? 'danger-text' : dueHours !== null && dueHours <= 48 ? 'warn-text' : ''}>{dueHours === null ? '—' : dueLabel(dueHours)}</span></div><small>{[item.course, item.kind, item.weight && `${item.weight} of grade`, `due ${dueText}`].filter(Boolean).join(' · ')}</small></div></li>
    })}</ol></> : <SyllabusSetup state={syllabusState} onImport={onImport} />}
  </Panel>
}

function SyllabusSetup({ state, onImport }) {
  if (state.status === 'importing') return <div className="assignment-empty"><strong>Qwen is reading your syllabi...</strong><small>Extracting dated assignments, exams, labs, and projects locally.</small></div>
  return <div className={`assignment-empty ${state.status === 'error' ? 'assignment-error' : ''}`}><strong>{state.status === 'empty' ? 'No assignments found.' : 'Add your syllabi.'}</strong><small>{state.status === 'error' ? state.error : 'Qwen will extract assignments and midterms from text-based syllabus files and PDFs.'}</small><SyllabusImportButton onImport={onImport} /><small>Supported: .txt, .md, .csv, .json, .html, and .pdf files.</small></div>
}

function SyllabusImportButton({ onImport }) {
  const inputRef = useRef(null)
  function chooseFiles(event) {
    onImport(Array.from(event.target.files || []))
    event.target.value = ''
  }
  return <><input ref={inputRef} className="visually-hidden" type="file" accept=".txt,.md,.csv,.json,.html,.htm,.pdf,text/plain,text/markdown,text/csv,application/json,text/html,application/pdf" multiple onChange={chooseFiles} /><button type="button" className="syllabus-connect" onClick={() => inputRef.current?.click()}>add syllabus <span aria-hidden="true">↗</span></button></>
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
  const [hiddenPrIds, setHiddenPrIds] = useState(() => new Set())
  const visibleMine = data.mine.filter((pr) => !hiddenPrIds.has(pr.id))
  const visibleRepositories = data.repositories
    .map((repository) => ({ ...repository, pullRequests: repository.pullRequests.filter((pr) => !hiddenPrIds.has(pr.id)) }))
    .filter((repository) => repository.pullRequests.length)

  function hidePullRequest(prId) {
    setHiddenPrIds((current) => new Set([...current, prId]))
  }

  return <div className="github-data"><div className="github-toolbar"><span><span className="accent-text">●</span> connected as {username}</span><button className="github-action" onClick={onDisconnect}>disconnect</button></div><div className="github-scroll-region"><section className="github-section"><div className="github-section-header"><strong>1 · my open PRs</strong><span>{visibleMine.length}</span></div>{visibleMine.length ? <div className="github-pr-list">{visibleMine.map((pr) => <GitHubPRRow key={pr.id} pr={pr} showRepo onHide={hidePullRequest} />)}</div> : <p className="github-empty">No visible open PRs authored by {username}.</p>}</section><section className="github-section"><div className="github-section-header"><strong>2 · repos owned by me</strong><span>{visibleRepositories.length}</span></div>{visibleRepositories.length ? <div className="github-repository-list">{visibleRepositories.map((repository) => repository.pullRequests.length > 5 ? <GitHubRepositorySummary key={repository.name} repository={repository} /> : <div className="github-repository-group" key={repository.name}><div className="github-repository-title"><strong>{repository.name}</strong><span>{repository.pullRequests.length} open</span></div>{repository.pullRequests.map((pr) => <GitHubPRRow key={pr.id} pr={pr} showAuthor onHide={hidePullRequest} />)}</div>)}</div> : <p className="github-empty">No visible owned repositories with open PRs.</p>}</section></div></div>
}

function GitHubPRRow({ pr, showRepo, showAuthor, onHide }) {
  return <div className="github-pr-row"><a className="github-pr-link" href={pr.url} target="_blank" rel="noreferrer"><span className={`github-pr-icon ${pr.draft ? 'muted-text' : 'accent-text'}`} aria-hidden="true">♧</span><span className="github-pr-copy"><strong>{pr.title}{pr.draft && <small className="draft-label">draft</small>}</strong><small>{showRepo ? `${pr.repo} #${pr.number}` : `#${pr.number}`}{showAuthor ? ` · opened by ${pr.author}` : ''}{pr.branch ? ` · ${pr.branch}` : ''}</small></span><span className="github-pr-updated">{relativeUpdated(pr.updatedAt)}</span><span className="github-external" aria-hidden="true">↗</span></a><button type="button" className="github-pr-hide" onClick={() => onHide(pr.id)} aria-label={`Hide ${pr.title}`} title="Hide pull request">×</button></div>
}

function GitHubRepositorySummary({ repository }) {
  return <a className="github-repository-summary" href={`https://github.com/${repository.name}/pulls`} target="_blank" rel="noreferrer"><span className="github-pr-icon accent-text" aria-hidden="true">♧</span><span><strong>{repository.name}</strong><small>{repository.pullRequests.length} open PRs · showing repository instead</small></span><span className="github-external" aria-hidden="true">↗</span></a>
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
