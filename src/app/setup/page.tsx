"use client";
import { useEffect, useMemo, useState } from 'react'
import { useUserStore } from '@/store/user'
import { CheckIcon, CalendarIcon, ClockIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import HeartRateZones from '@/components/HeartRateZones'
import { HeroImage } from '@/components/UnsplashImage'

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
    <div className="space-y-8">
      {/* Hero Section */}
      <HeroImage 
        query="runner preparation stretching planning goals" 
        className="h-40 rounded-2xl"
      >
        <h1 className="text-3xl font-bold mb-2">Training Setup</h1>
        <p className="text-lg opacity-90">Configure your race goals and training zones</p>
      </HeroImage>
      
      {/* Race Configuration */}
      <div className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
        <h2 className="font-medium mb-4">Race Configuration</h2>
        <div className="grid gap-4 max-w-lg">
          <label className="grid gap-1">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <CalendarIcon className="w-4 h-4" />
              Race Date
            </div>
            <input
              type="date"
              value={race}
              onChange={(e) => setRace(e.target.value)}
              className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30"
            />
          </label>
          <label className="grid gap-1">
            <div className="flex items-center gap-2 text-sm opacity-80">
              <ClockIcon className="w-4 h-4" />
              Goal Time (HH:MM:SS)
            </div>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <CheckIcon className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => {
                if (user?.raceDate) setRace(user.raceDate)
                if (user?.goalTime) setGoal(user.goalTime)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ArrowUturnLeftIcon className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Heart Rate Zones */}
      <HeartRateZones />
    </div>
  )
}
