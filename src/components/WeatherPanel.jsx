import Panel from './Panel.jsx'
import Icon from './Icons.jsx'

export default function WeatherPanel({ index, weather, weatherStatus }) {
  const temps = weather.hourly.map((entry) => entry.temp)
  const min = Math.min(...temps)
  const max = Math.max(...temps)
  const span = Math.max(max - min, 1)

  return <Panel path="~/weather.now" index={index} className="weather-panel" meta={<span>{weather.location} Â· {weatherStatus}</span>}>
    <div className="weather-details"><div><strong className="large-temp">{weather.temp}Â°C</strong><p>feels {weather.feelsLike}Â° Â· {weather.condition.toLowerCase()}</p></div><dl><div><dt><Icon name="highLow" size={13} /></dt><dd><b>{weather.high}Â°</b> / {weather.low}Â°</dd></div><div><dt><Icon name="wind" size={13} /></dt><dd>{weather.windKmh} km/h</dd></div><div><dt><Icon name="humidity" size={13} /></dt><dd>{weather.humidity}%</dd></div></dl></div>
    <div className="forecast"><div className="forecast-bars">{weather.hourly.map((entry) => <div className="forecast-hour" key={entry.hour}><span>{entry.temp}</span><i style={{ height: `${12 + ((entry.temp - min) / span) * 30}px` }} /><small>{entry.hour}</small></div>)}</div></div>
  </Panel>
}
