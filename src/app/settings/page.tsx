"use client";
import { useEffect, useMemo, useState, Suspense, lazy } from 'react'
import { useUserStore } from '@/store/user'
import { CheckIcon, CalendarIcon, ClockIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
// Removed HeroImage import for clean design
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundary'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// 🚀 Lazy load the heavy HeartRateZones component
const HeartRateZones = lazy(() => import('@/components/HeartRateZones'))

// Loading fallback for HeartRateZones
const HeartRateZonesLoader = () => (
  <Card className="animate-pulse">
    <div className="space-y-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    </div>
  </Card>
)

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
      {/* Header Section */}
      <div className="text-center py-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Settings</h1>
        <p className="text-lg opacity-70">Configure your race goals, training zones, and app preferences.</p>
      </div>
      
      {/* Race Configuration */}
      <Card>
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
              className="px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className={`px-3 py-2 rounded-lg border bg-white/60 dark:bg-black/30 focus:outline-none focus:ring-2 ${
                goal && !goalValid 
                  ? 'border-red-400 focus:ring-red-500' 
                  : 'border-black/10 dark:border-white/10 focus:ring-indigo-500'
              }`}
            />
            {goal && !goalValid && (
              <span className="text-xs text-red-500">Enter time as HH:MM:SS</span>
            )}
          </label>
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={() => {
                if (race) setRaceDate(race)
                if (goalValid && goal) setGoalTime(goal)
              }}
              leftIcon={<CheckIcon className="w-4 h-4" />}
            >
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (user?.raceDate) setRace(user.raceDate)
                if (user?.goalTime) setGoal(user.goalTime)
              }}
              leftIcon={<ArrowUturnLeftIcon className="w-4 h-4" />}
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* intervals.icu Integration Info */}
      <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <CheckIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Activity Data Sync</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 opacity-90">
              Your training activities are automatically synced from intervals.icu. All running activities will appear in your dashboard and analysis pages.
            </p>
          </div>
        </div>
      </Card>

      {/* Heart Rate Zones - Lazy Loaded */}
      <ErrorBoundaryWrapper 
        componentName="HeartRateZones"
        fallback={
          <Card>
            <div className="text-center py-8">
              <p className="text-red-600 mb-2">Failed to load Heart Rate Zones</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </div>
          </Card>
        }
      >
        <Suspense fallback={<HeartRateZonesLoader />}>
          <HeartRateZones />
        </Suspense>
      </ErrorBoundaryWrapper>
    </div>
  )
}
