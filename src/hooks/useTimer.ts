import { useState, useEffect, useCallback } from 'react'

export function useTimer(endTime: string | null | undefined) {
  const [remaining, setRemaining] = useState(0)
  const [isActive, setIsActive] = useState(false)

  const calculate = useCallback(() => {
    if (!endTime) {
      setRemaining(0)
      setIsActive(false)
      return
    }
    const diff = new Date(endTime).getTime() - Date.now()
    if (diff <= 0) {
      setRemaining(0)
      setIsActive(false)
    } else {
      setRemaining(Math.floor(diff / 1000))
      setIsActive(true)
    }
  }, [endTime])

  useEffect(() => {
    calculate()
    const interval = setInterval(calculate, 1000)
    return () => clearInterval(interval)
  }, [calculate])

  const formatted = formatTime(remaining)
  return { remaining, isActive, formatted }
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
