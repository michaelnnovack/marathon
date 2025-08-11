"use client";
import Link from 'next/link'
import { useUserStore } from '@/store/user'
import { generatePlan } from '@/utils/plan'
import { toISODate } from '@/utils/dates'
import { CalendarDaysIcon, ClockIcon, MapPinIcon, TagIcon } from '@heroicons/react/24/outline'
import type { WorkoutType } from '@/types'
// Removed CardImage import for clean design

function getWorkoutTypeColor(type: WorkoutType) {
  const colors: Record<WorkoutType, string> = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    tempo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    interval: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    long: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    recovery: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    cross: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    race: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
  }
  return colors[type] || colors.easy
}

function getPhaseColor(phase: string) {
  const colors = {
    base: 'bg-blue-500',
    build: 'bg-yellow-500', 
    peak: 'bg-red-500',
    taper: 'bg-green-500'
  }
  return colors[phase as keyof typeof colors] || colors.base
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${mins}m`
}

function estimateDistance(type: WorkoutType, duration: number): string {
  // Rough estimates based on workout type and duration
  const paceMultipliers: Partial<Record<WorkoutType, number>> = {
    easy: 6.5, // min/km
    recovery: 7.0,
    tempo: 4.5,
    interval: 4.0, 
    long: 6.0,
    cross: 0, // No distance for cross training
    race: 4.2
  }
  
  if (type === 'cross') return 'N/A'
  
  const paceMinPerKm = paceMultipliers[type] || 6.0
  const km = duration / paceMinPerKm
  return `${Math.round(km * 10) / 10}k`
}

// Removed getWorkoutTypeImage function - not needed for clean design

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  
  if (dateString === toISODate(today)) return 'Today'
  if (dateString === toISODate(tomorrow)) return 'Tomorrow'
  if (dateString === toISODate(yesterday)) return 'Yesterday'
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
}

export default function PlanPage() {
  const user = useUserStore((s) => s.user)
  if (!user?.raceDate) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <CalendarDaysIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Training Plan Not Available</p>
          <p className="text-sm opacity-70 mb-4">Set your race date to generate your personalized training plan</p>
          <Link 
            href="/setup" 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Go to Setup
          </Link>
        </div>
      </div>
    )
  }
  
  const todayISO = toISODate(new Date())
  const plan = generatePlan(user.id, todayISO, user.raceDate)
  
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center py-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Training Calendar</h1>
        <p className="text-lg opacity-70">
          {plan.weeks.length} weeks to race day • Current phase: {plan.weeks[0]?.phase || 'base'}
        </p>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-8">
        {plan.weeks.map((week, weekIndex) => (
          <div key={week.start} className="space-y-4">
            {/* Week Header */}
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getPhaseColor(week.phase || 'base')}`}></div>
              <h2 className="text-lg font-semibold">
                Week {weekIndex + 1} • {week.phase?.toUpperCase() || 'BASE'}
              </h2>
              <div className="text-sm opacity-60">
                {new Date(week.start).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
              {week.days.map((workout) => {
                const isToday = workout.date === todayISO
                const isPast = new Date(workout.date) < new Date(todayISO)
                
                return (
                  <Link
                    key={workout.id}
                    href={`/plan/${encodeURIComponent(workout.date)}`}
                    className={`group block rounded-xl border p-4 transition-all hover:shadow-lg hover:scale-[1.02] ${
                      isToday 
                        ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700' 
                        : isPast 
                        ? 'border-black/5 bg-black/5 dark:border-white/5 dark:bg-white/5 opacity-70' 
                        : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30'
                    }`}
                  >
                    {/* Date */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium">
                        {formatDate(workout.date)}
                      </div>
                      {isToday && (
                        <div className="px-2 py-1 rounded-full bg-indigo-600 text-white text-xs font-medium">
                          Today
                        </div>
                      )}
                    </div>

                    {/* Workout Type Badge with Image */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getWorkoutTypeColor(workout.type)}`}>
                        <TagIcon className="w-3 h-3" />
                        {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                      </span>
                    </div>

                    {/* Workout Details */}
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                        {workout.description}
                      </p>
                      
                      {/* Metrics */}
                      <div className="flex items-center gap-4 text-xs opacity-70">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {formatDuration(workout.duration)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPinIcon className="w-3 h-3" />
                          {estimateDistance(workout.type, workout.duration)}
                        </div>
                      </div>
                    </div>

                    {/* Completion Status */}
                    {isPast && (
                      <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full ${workout.completed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          <span className={workout.completed ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}>
                            {workout.completed ? 'Completed' : 'Missed'}
                          </span>
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
