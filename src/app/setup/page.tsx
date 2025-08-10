"use client";
import { useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/store/user'

function isValidHHMMSS(v: string) {
  const m = v.match(/^([0-1]?\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
  return !!m
}

export default function SetupPage() {
  const user = useUserStore((s) => s.user)
  const setRaceDate = useUserStore((s) => s.setRaceDate)
  const setGoalTime = useUserStore((s) => s.setGoalTime)
  const hydrate = useUserStore((s) => s.hydrate)
  const [race, setRace] = useState<string>("")
  const [goal, setGoal] = useState<string>("")
  const goalValid = useMemo(() => (goal ? isValidHHMMSS(goal) : true), [goal])

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (user?.raceDate) setRace(user.raceDate)
    if (user?.goalTime) setGoal(user.goalTime)
  }, [user?.raceDate, user?.goalTime])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Race Setup</h1>
        <p className="opacity-80 text-sm">Set your race date and goal marathon time.</p>
      </div>
      <div className="grid gap-4 max-w-lg">
        <label className="grid gap-1">
          <span className="text-sm opacity-80">Race Date</span>
          <input
            type="date"
            value={race}
            onChange={(e) => setRace(e.target.value)}
            className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm opacity-80">Goal Time (HH:MM:SS)</span>
          <input
            placeholder="03:30:00"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className={`px-3 py-2 rounded-lg border bg-white/60 dark:bg-black/30 ${
              goal && !goalValid ? 'border-red-400' : 'border-black/10 dark:border-white/10'
            }`}
          />
          {goal && !goalValid && (
            <span className="text-xs text-red-500">Enter time as HH:MM:SS</span>
          )}
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (race) setRaceDate(race)
              if (goalValid && goal) setGoalTime(goal)
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              if (user?.raceDate) setRace(user.raceDate)
              if (user?.goalTime) setGoal(user.goalTime)
            }}
            className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
