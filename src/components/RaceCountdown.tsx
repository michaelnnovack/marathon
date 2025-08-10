"use client";
import { useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/store/user'

function diff(from: Date, to: Date) {
  const ms = Math.max(0, to.getTime() - from.getTime())
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return { days, hours }
}

export function RaceCountdown() {
  const user = useUserStore((s) => s.user)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const target = useMemo(() => (user?.raceDate ? new Date(user.raceDate) : null), [user?.raceDate])
  if (!target) return <span className="opacity-60">No race set</span>
  const { days, hours } = diff(now, target)
  return <span className="font-medium">{days}d {hours}h</span>
}
