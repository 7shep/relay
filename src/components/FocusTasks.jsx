import Panel from './Panel.jsx'
import Icon from './Icons.jsx'

export default function FocusTasks({ tasks, onOpen, showCompleted, onToggleCompleted, focusStatus, taskStatus, index }) {
  const completed = tasks.filter((task) => task.done).length
  const visible = showCompleted ? tasks : tasks.filter((task) => !task.done)
  const progress = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)
  const syncLabel = taskStatus === 'planning' ? 'Qwen drafting task...' : taskStatus === 'offline' ? 'Qwen unavailable' : focusStatus === 'planning' ? 'Qwen drafting...' : focusStatus === 'offline' ? 'Qwen unavailable' : ''
  const syncState = taskStatus === 'planning' || taskStatus === 'offline' ? taskStatus : focusStatus

  return (
    <Panel path="~/focus/today.md" primary index={index} className="focus-panel" meta={<span className="focus-meta"><button type="button" className="panel-meta-button" onClick={onToggleCompleted}>{completed}/{tasks.length} done</button>{syncLabel && <span className={`focus-sync-status ${syncState}`}> &#8226; {syncLabel}</span>}</span>}>
      <div className="progress-row"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
      <ul className="focus-list">
        {visible.map((task, position) => {
          const isNext = !task.done && visible.find((item) => !item.done)?.id === task.id
          return <li key={task.id}><button className={`focus-task ${isNext ? 'next-task' : ''} ${task.done ? 'completed-task' : ''}`} onClick={() => onOpen(task)} aria-haspopup="dialog">
            <span className="task-box">{task.done ? <Icon name="check" size={11} /> : null}</span>
            <span className="task-text"><strong>{task.label}</strong><small>{String(position + 1).padStart(2, '0')} &#8226; {task.project} &#8226; est {task.estimate}{isNext && <em> &#8226; up next</em>}</small></span><Icon name="arrowUpRight" size={13} className="task-open" />
          </button></li>
        })}
        {visible.length === 0 && <li className="empty-task">everything checked off.<small>Ask Qwen in the assistant to add another focus task.</small></li>}
      </ul>
    </Panel>
  )
}
