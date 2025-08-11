"use client";

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUserStore } from '@/store/user'
import { generatePlan } from '@/utils/plan'
import { useProgress } from '@/store/progress'
import { CheckIcon, ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline'

export default function DayClient({ date }: { date: string }) {
  const user = useUserStore((s) => s.user)
  const progress = useProgress()

  useEffect(() => {
    progress.hydrate()
  }, [progress])

  const plan = useMemo(
    () => (user?.raceDate ? generatePlan(user.id, new Date().toISOString().slice(0, 10), user.raceDate) : null),
    [user?.raceDate, user?.id]
  )
  const workout = useMemo(() => (plan ? plan.weeks.flatMap((w) => w.days).find((d) => d.date === date) : null), [plan, date])

  const [rpe, setRpe] = useState<number>(5)
  const [notes, setNotes] = useState<string>("")

  useEffect(() => {
    if (workout?.id && progress.map[workout.id]) {
      setRpe(progress.map[workout.id].rpe || 5)
      setNotes(progress.map[workout.id].notes || '')
    }
  }, [workout?.id, progress.map])

  if (!user?.raceDate)
    return (
      <div>
        Set your race date in <Link className="underline" href="/setup">Setup</Link>.
      </div>
    )

  if (!workout) return <div>No workout found for {date}.</div>

  const save = () => {
    progress.mark(workout.id, { completedAt: new Date().toISOString(), rpe, notes })
  }

  return (
    <div className="space-y-4">
      <Link href="/plan" className="flex items-center gap-1 text-sm underline w-fit">
        <ArrowLeftIcon className="w-3 h-3" />
        Back to plan
      </Link>
      <h1 className="text-xl font-semibold">
        {workout.type} — {workout.date}
      </h1>
      <p className="opacity-80 text-sm">{workout.description}</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white/60 dark:bg-black/30">
          <h3 className="font-medium mb-2">Complete</h3>
          <label className="grid gap-1 text-sm">
            <span>RPE (1-10)</span>
            <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(parseInt(e.target.value))} />
          </label>
          <label className="grid gap-1 text-sm mt-3">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 p-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30"
            />
          </label>
          <button onClick={save} className="flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
            <CheckIcon className="w-4 h-4" />
            Save
          </button>
        </div>
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 bg-white/60 dark:bg-black/30">
          <div className="flex items-center gap-2 font-medium mb-2">
            <ClockIcon className="w-4 h-4" />
            Pace Zones
          </div>
          <PaceZones goalTime={user.goalTime} />
        </div>
      </div>
    </div>
  )
}

function PaceZones({ goalTime }: { goalTime?: string }) {
  if (!goalTime) return <p className="text-sm opacity-80">Set a goal time to see target paces.</p>
  const [h, m, s] = goalTime.split(':').map(Number)
  const marathonSec = h * 3600 + m * 60 + s
  const paceSec = marathonSec / 42.195
  const fmt = (sec: number) => {
    const mm = Math.floor(sec / 60)
    const ss = Math.round(sec % 60)
      .toString()
      .padStart(2, '0')
    return `${mm}:${ss}/km`
  }
  return (
    <ul className="text-sm space-y-1">
      <li>Easy: {fmt(paceSec * 1.3)}</li>
      <li>Tempo: {fmt(paceSec * 1.05)}</li>
      <li>Interval: {fmt(paceSec * 0.9)}</li>
      <li>Long: {fmt(paceSec * 1.15)}</li>
    </ul>
  )
}
