import { useEffect, useState } from 'react'
import { fallbackWeather } from '../constants/config.js'
import { loadWeather } from '../services/weather.js'

export function useWeather() {
  const [weather, setWeather] = useState(fallbackWeather)
  const [weatherStatus, setWeatherStatus] = useState('locating')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    if (!navigator.geolocation) {
      setWeatherStatus('unavailable')
      return () => controller.abort()
    }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (cancelled) return
      setWeatherStatus('updating')
      try {
        const currentWeather = await loadWeather(coords.latitude, coords.longitude, controller.signal)
        if (!cancelled) { setWeather(currentWeather); setWeatherStatus('live') }
      } catch { if (!cancelled) setWeatherStatus('offline') }
    }, () => { if (!cancelled) setWeatherStatus('permission needed') }, { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 10000 })
    return () => { cancelled = true; controller.abort() }
  }, [])

  return { weather, weatherStatus }
}
