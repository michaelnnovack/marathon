"use client"

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useUserStore } from '@/store/user'
import { generatePlan } from '@/utils/plan'
import { addDays, toISODate } from '@/utils/dates'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { 
  ClockIcon,
  CalendarDaysIcon,
  TrophyIcon,
  FireIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  BookOpenIcon,
  HeartIcon,
  MapIcon,
  StarIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'

// Enhanced countdown component
function RaceCountdown({ raceDate }: { raceDate?: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
  }>({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    if (!raceDate) return

    const updateCountdown = () => {
      const now = new Date()
      const race = new Date(raceDate)
      const diff = Math.max(0, race.getTime() - now.getTime())
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      
      setTimeLeft({ days, hours, minutes })
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [raceDate])

  if (!raceDate) {
    return (
      <div className="text-center py-8">
        <CalendarDaysIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg opacity-70 mb-4">Set your race date to see countdown</p>
        <Link href="/setup">
          <Button variant="outline">Set Race Date</Button>
        </Link>
      </div>
    )
  }

  const raceTitle = new Date(raceDate).toLocaleDateString('en-US', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric'
  })

  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrophyIcon className="w-6 h-6 text-amber-500" />
          <h2 className="text-lg font-semibold opacity-80">Race Day</h2>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">{raceTitle}</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <div className="text-3xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400">{timeLeft.days}</div>
          <div className="text-sm opacity-70 font-medium">Days</div>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
          <div className="text-3xl sm:text-4xl font-bold text-purple-600 dark:text-purple-400">{timeLeft.hours}</div>
          <div className="text-sm opacity-70 font-medium">Hours</div>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800">
          <div className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400">{timeLeft.minutes}</div>
          <div className="text-sm opacity-70 font-medium">Minutes</div>
        </div>
      </div>

      {timeLeft.days <= 14 && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-full border border-amber-200 dark:border-amber-800">
          <ExclamationTriangleIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Final preparations time!</span>
        </div>
      )}
    </div>
  )
}

// Training phase timeline component
function PhaseTimeline({ plan, weeksToRace }: { plan: any, weeksToRace: number }) {
  if (!plan) return null

  const currentWeekIndex = Math.max(0, plan.weeks.length - weeksToRace)
  const currentPhase = plan.weeks[currentWeekIndex]?.phase || 'base'

  const phases = [
    { name: 'Base Building', key: 'base', color: 'bg-green-500', description: 'Building aerobic foundation' },
    { name: 'Build Phase', key: 'build', color: 'bg-blue-500', description: 'Increasing intensity and volume' },
    { name: 'Peak Phase', key: 'peak', color: 'bg-purple-500', description: 'Maximum training load' },
    { name: 'Taper Phase', key: 'taper', color: 'bg-amber-500', description: 'Reducing volume for race day' }
  ]

  const getCurrentPhaseProgress = () => {
    const currentPhaseWeeks = plan.weeks.filter((w: any) => w.phase === currentPhase)
    const completedWeeksInPhase = currentPhaseWeeks.slice(0, currentWeekIndex + 1).length
    return Math.round((completedWeeksInPhase / currentPhaseWeeks.length) * 100)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5" />
          Training Phase Progress
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg capitalize">{currentPhase} Phase</h3>
              <p className="text-sm opacity-70">
                {phases.find(p => p.key === currentPhase)?.description}
              </p>
            </div>
            <Badge variant="primary" size="lg">
              Week {currentWeekIndex + 1} of {plan.weeks.length}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Phase Progress</span>
              <span>{getCurrentPhaseProgress()}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${getCurrentPhaseProgress()}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {phases.map(phase => (
              <div
                key={phase.key}
                className={`p-2 rounded-lg text-center text-xs ${
                  phase.key === currentPhase
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-300 dark:border-indigo-700'
                    : 'bg-gray-50 dark:bg-gray-800 opacity-60'
                }`}
              >
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${phase.color}`} />
                <div className="font-medium">{phase.name.split(' ')[0]}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Weekly preview component
function WeeklyPreview({ plan, weeksToRace }: { plan: any, weeksToRace: number }) {
  if (!plan) return null

  const upcomingWeeks = plan.weeks.slice(
    Math.max(0, plan.weeks.length - weeksToRace),
    Math.max(0, plan.weeks.length - weeksToRace + 6)
  ).slice(0, 6)

  const getWorkoutTypeIcon = (type: string) => {
    switch (type) {
      case 'easy': return <HeartIcon className="w-4 h-4 text-green-600" />
      case 'tempo': return <FireIcon className="w-4 h-4 text-orange-600" />
      case 'interval': return <StarIcon className="w-4 h-4 text-red-600" />
      case 'long': return <MapIcon className="w-4 h-4 text-purple-600" />
      case 'recovery': return <BookOpenIcon className="w-4 h-4 text-blue-600" />
      default: return <ClockIcon className="w-4 h-4 text-gray-600" />
    }
  }

  const getWorkoutTypeColor = (type: string) => {
    const colors = {
      easy: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      tempo: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
      interval: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      long: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
      recovery: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      cross: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    }
    return colors[type as keyof typeof colors] || colors.cross
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="w-5 h-5" />
          Next 6 Weeks Preview
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingWeeks.map((week, weekIndex) => (
            <div key={week.start} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">
                  Week {plan.weeks.length - weeksToRace + weekIndex + 1}
                </h4>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" size="sm" className="capitalize">
                    {week.phase}
                  </Badge>
                  <span className="text-sm opacity-60">
                    {new Date(week.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {week.days.map((workout: any, dayIndex: number) => (
                  <div
                    key={workout.id}
                    className={`p-2 rounded-lg border ${getWorkoutTypeColor(workout.type)} hover:scale-105 transition-transform cursor-pointer`}
                    title={`${workout.type}: ${workout.description}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {getWorkoutTypeIcon(workout.type)}
                      <span className="text-xs font-medium capitalize">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]}
                      </span>
                      <span className="text-xs opacity-70">
                        {workout.duration}m
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Key milestones component
function KeyMilestones({ user, plan, daysToRace }: { user: any, plan: any, daysToRace: number }) {
  const milestones = useMemo(() => {
    if (!plan || !daysToRace) return []

    const today = new Date()
    const milestones = []

    // Peak week milestone
    const peakWeeks = plan.weeks.filter((w: any) => w.phase === 'peak')
    if (peakWeeks.length > 0) {
      const peakStart = new Date(peakWeeks[0].start)
      const daysToPeak = Math.ceil((peakStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToPeak > 0) {
        milestones.push({
          title: 'Peak Training Phase',
          date: peakStart,
          daysAway: daysToPeak,
          description: 'Maximum training volume and intensity',
          icon: <FireIcon className="w-5 h-5 text-red-500" />,
          color: 'border-red-200 dark:border-red-800'
        })
      }
    }

    // Taper start milestone  
    const taperWeeks = plan.weeks.filter((w: any) => w.phase === 'taper')
    if (taperWeeks.length > 0) {
      const taperStart = new Date(taperWeeks[0].start)
      const daysToTaper = Math.ceil((taperStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToTaper > 0) {
        milestones.push({
          title: 'Taper Begins',
          date: taperStart,
          daysAway: daysToTaper,
          description: 'Reduce volume, maintain intensity',
          icon: <BookOpenIcon className="w-5 h-5 text-amber-500" />,
          color: 'border-amber-200 dark:border-amber-800'
        })
      }
    }

    // Final preparation milestone (1 week before)
    if (daysToRace > 7) {
      const finalPrep = addDays(new Date(user?.raceDate), -7)
      const daysToFinalPrep = Math.ceil((finalPrep.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToFinalPrep > 0) {
        milestones.push({
          title: 'Final Week Preparation',
          date: finalPrep,
          daysAway: daysToFinalPrep,
          description: 'Race week - focus on rest and logistics',
          icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
          color: 'border-green-200 dark:border-green-800'
        })
      }
    }

    return milestones.sort((a, b) => a.daysAway - b.daysAway).slice(0, 3)
  }, [plan, daysToRace, user?.raceDate])

  if (milestones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <StarIcon className="w-5 h-5" />
            Key Milestones
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm opacity-70">No upcoming milestones</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <StarIcon className="w-5 h-5" />
          Key Milestones
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border ${milestone.color} bg-white/40 dark:bg-black/20`}
            >
              <div className="flex items-start gap-3">
                {milestone.icon}
                <div className="flex-1">
                  <h4 className="font-semibold">{milestone.title}</h4>
                  <p className="text-sm opacity-70 mb-2">{milestone.description}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" size="sm">
                      {milestone.daysAway} days away
                    </Badge>
                    <span className="opacity-60">
                      {milestone.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Race day checklist component
function RaceDayChecklist({ daysToRace }: { daysToRace: number }) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())

  const getChecklistItems = () => {
    if (daysToRace > 14) {
      return [
        'Research and register for your marathon',
        'Plan your training schedule around travel and work',
        'Start building your weekly mileage base',
        'Establish consistent sleep and nutrition habits',
        'Test different fueling strategies on long runs'
      ]
    } else if (daysToRace > 7) {
      return [
        'Confirm race day transportation and accommodation',
        'Pick up race packet if available',
        'Plan your race day outfit and gear',
        'Finalize your fueling strategy',
        'Review the course map and elevation profile',
        'Prepare playlist or entertainment for the race'
      ]
    } else {
      return [
        'Get plenty of sleep (8+ hours per night)',
        'Stay hydrated and eat familiar foods',
        'Avoid new activities or strenuous exercise',
        'Double-check race day logistics and timing',
        'Lay out all race gear the night before',
        'Set multiple alarms and charge your devices',
        'Prepare a simple pre-race breakfast',
        'Review your race strategy and goal times'
      ]
    }
  }

  const toggleItem = (index: number) => {
    const newChecked = new Set(checkedItems)
    if (newChecked.has(index)) {
      newChecked.delete(index)
    } else {
      newChecked.add(index)
    }
    setCheckedItems(newChecked)
  }

  const items = getChecklistItems()
  const completedCount = checkedItems.size

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5" />
            {daysToRace <= 7 ? 'Final Week Checklist' : 'Race Preparation'}
          </div>
          <Badge variant={completedCount === items.length ? 'success' : 'outline'} size="sm">
            {completedCount}/{items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                checkedItems.has(index)
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => toggleItem(index)}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
                checkedItems.has(index)
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {checkedItems.has(index) && (
                  <CheckCircleIcon className="w-3 h-3 text-white" />
                )}
              </div>
              <span className={`text-sm ${
                checkedItems.has(index) ? 'line-through opacity-70' : ''
              }`}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function SchedulePage() {
  const { user, isLoading } = useUserStore((s) => ({ user: s.user, isLoading: s.isLoading }))
  const hydrateUser = useUserStore((s) => s.hydrate)

  useEffect(() => {
    hydrateUser()
  }, [hydrateUser])

  const daysToRace = useMemo(() => {
    if (!user?.raceDate) return undefined
    const now = new Date()
    const race = new Date(user.raceDate)
    return Math.max(0, Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }, [user?.raceDate])

  const weeksToRace = useMemo(() => {
    if (!daysToRace) return 0
    return Math.ceil(daysToRace / 7)
  }, [daysToRace])

  const plan = useMemo(() => {
    if (!user?.raceDate || !user?.id) return null
    
    try {
      const today = new Date().toISOString().slice(0, 10)
      return generatePlan(user.id, today, user.raceDate)
    } catch (error) {
      console.error('Failed to generate training plan:', error)
      return null
    }
  }, [user?.raceDate, user?.id])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user?.raceDate) {
    return (
      <div className="text-center py-12">
        <TrophyIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h1 className="text-2xl font-bold mb-2">Set Your Marathon Date</h1>
        <p className="text-lg opacity-70 mb-6">
          Configure your race date and goal time to see your complete training schedule
        </p>
        <Link href="/setup">
          <Button size="lg">
            <CalendarDaysIcon className="w-5 h-5 mr-2" />
            Set Race Date
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Training Schedule</h1>
        <p className="text-lg opacity-70">Your complete marathon preparation timeline</p>
      </div>

      {/* Race Day Countdown - Hero Section */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800" padding="lg">
        <RaceCountdown raceDate={user.raceDate} />
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <PhaseTimeline plan={plan} weeksToRace={weeksToRace} />
          <KeyMilestones user={user} plan={plan} daysToRace={daysToRace || 0} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <WeeklyPreview plan={plan} weeksToRace={weeksToRace} />
          <RaceDayChecklist daysToRace={daysToRace || 0} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/plan">
          <Button variant="outline">
            <BookOpenIcon className="w-4 h-4 mr-2" />
            View Full Training Plan
          </Button>
        </Link>
        <Link href="/progress">
          <Button variant="outline">
            <ChartBarIcon className="w-4 h-4 mr-2" />
            Track Progress
          </Button>
        </Link>
        <Link href="/setup">
          <Button variant="ghost">
            <ClockIcon className="w-4 h-4 mr-2" />
            Update Race Settings
          </Button>
        </Link>
      </div>
    </div>
  )
}