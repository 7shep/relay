import { formatClock, formatDateLine, greetingFor } from '../utils/dates.js'
import Icon from './Icons.jsx'

export default function DashboardHeader({ name, now, tasksLeft, weather, weatherStatus, onOpenWorkspace }) {
  return (
    <header className="dashboard-header">
      <div className="header-copy">
        <p className="command-line">alex@localhost:~$ ./dashboard --today</p>
        <h1><span className="accent-text">{greetingFor(now)},</span> {name}<span className="caret" aria-hidden="true" /></h1>
        <p className="header-meta">{formatDateLine(now)} <span aria-hidden="true">&#8226;</span> <span className="bright-text">{formatClock(now)}</span> <span aria-hidden="true">&#8226;</span> {tasksLeft} focus task{tasksLeft === 1 ? '' : 's'} remaining</p>
      </div>
      <div className="header-actions">
        <button type="button" className="workspace-launch" onClick={onOpenWorkspace}><Icon name="spark" size={12} /> study memory <span>↗</span></button>
        <div className="weather-summary">
        <Icon name="sun" size={22} className="weather-glyph" />
        <div><strong>{weather.temp}&deg;C <span>/ {weather.condition.toLowerCase()}</span></strong><small>{weatherStatus === 'live' ? weather.location : `location ${weatherStatus}`}</small></div>
        </div>
      </div>
    </header>
  )
}
