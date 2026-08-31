import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DashboardHeader from './components/DashboardHeader.jsx'
import FocusTasks from './components/FocusTasks.jsx'
import TaskModal from './components/TaskModal.jsx'
import ChatBar from './components/ChatBar.jsx'
import WeatherPanel from './components/WeatherPanel.jsx'
import AssignmentsPanel from './components/AssignmentsPanel.jsx'
import PullRequestsPanel from './components/PullRequestsPanel.jsx'
import { draftAssignmentsFromSyllabi, draftFocusTasks, draftTasksFromPrompt } from './services/qwen.js'
import { readSyllabusFile } from './services/syllabus.js'
import { useWeather } from './hooks/useWeather.js'
import { dayKey } from './utils/dates.js'
import { clearStoredAssignments, readAssignments, readFocusState, writeAssignments, writeFocusState } from './utils/storage.js'
function App() {
  const [now, setNow] = useState(() => new Date())
  const [focusState] = useState(() => readFocusState(new Date()))
  const [tasks, setTasks] = useState(() => focusState.tasks)
  const [focusDay, setFocusDay] = useState(() => focusState.day)
  const [focusStatus, setFocusStatus] = useState(() => focusState.shouldDraft ? 'planning' : 'ready')
  const [assignments, setAssignments] = useState(readAssignments)
  const [syllabusState, setSyllabusState] = useState({ status: 'idle', error: '' })
  const [showCompleted, setShowCompleted] = useState(() => !(focusState.tasks.length && focusState.tasks.every((task) => task.done)))
  const [taskStatus, setTaskStatus] = useState('idle')
  const [selectedTask, setSelectedTask] = useState(null)
  const { weather, weatherStatus } = useWeather()
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
      writeFocusState(focusDay, tasks)
    } catch {
      // The focus list still works when browser storage is unavailable.
    }
  }, [tasks, focusDay])

  useEffect(() => {
    assignmentsRef.current = assignments
    try {
      writeAssignments(assignments)
    } catch {
      // Assignment data still remains available for this session when storage is unavailable.
    }
  }, [assignments])

  useEffect(() => {
    if (tasks.length && tasks.every((task) => task.done)) setShowCompleted(false)
  }, [tasks])

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
    clearStoredAssignments()
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

  const toggleTask = useCallback((id) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)))
    setSelectedTask((current) => current && current.id === id ? { ...current, done: !current.done } : current)
  }, [])

  const createTasksFromPrompt = useCallback(async (prompt, signal) => {
    setTaskStatus('planning')

    try {
      const draftedTasks = await draftTasksFromPrompt(prompt, tasksRef.current, assignmentsRef.current, signal)
      if (signal?.aborted) return []
      setTasks((current) => [...current, ...draftedTasks])
      setTaskStatus(draftedTasks.length ? 'ready' : 'empty')
      return draftedTasks
    } catch (error) {
      if (!signal?.aborted) setTaskStatus('offline')
      throw error
    }
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
            onOpen={setSelectedTask}
            showCompleted={showCompleted}
            onToggleCompleted={() => setShowCompleted((current) => !current)}
            focusStatus={focusStatus}
            taskStatus={taskStatus}
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
          <span aria-hidden="true">&#8226;</span>
          <span>3 sources connected</span>
          <span aria-hidden="true">&#8226;</span>
          <span className="accent-text">all systems nominal</span>
        </footer>
      </div>
      {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} onToggle={toggleTask} onSave={updateTask} />}
      <ChatBar tasks={tasks} assignments={assignments} onCreateTasks={createTasksFromPrompt} />
    </div>
  )
}

export default App

