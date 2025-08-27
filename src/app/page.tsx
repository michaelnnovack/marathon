"use client"
import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { useUserStore } from '@/store/user'
import { useActivities, weeklyMileageKm, last7DaysMileageKm, activitiesWithDatesCount, clearDistanceCache } from '@/store/activities'
import { useProgress } from '@/store/progress'
import { predictMarathonTime, formatHMS } from '@/utils/predict'
import { getTodaysWorkout, DailyWorkout } from '@/utils/coach/advice'
import { 
  CalendarDaysIcon, 
  ChartBarIcon, 
  CloudArrowUpIcon, 
  CheckCircleIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline'
import { Card, CardContent, MetricCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundary'

// Welcome message for new users
const WelcomeMessage = React.memo(function WelcomeMessage({ userName }: { userName: string }) {
  return (
    <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
      <CardContent className="text-center py-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Welcome to Marathon Training, {userName}!</h2>
        <p className="text-lg opacity-80 mb-6">
          Your personal training companion for marathon success
        </p>
        <div className="space-y-3">
          <p className="text-sm opacity-70">
            Set your race date and goal time to get personalized coaching advice. Your training data is automatically synced from intervals.icu.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <a href="/setup" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium">
              Set Race Goals
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

// Daily workout recommendation hero section
const DailyWorkoutHero = React.memo(function DailyWorkoutHero({ 
  workout, 
  onCompleteWorkout, 
  onModifyPlan 
}: { 
  workout: DailyWorkout
  onCompleteWorkout: () => void
  onModifyPlan: () => void 
}) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-3xl p-8 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-3 mb-6">
        <AcademicCapIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200 uppercase tracking-wide">Today's Workout</span>
      </div>
      
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-3">
          {workout.type} • {workout.distance} at {workout.pace}
        </h1>
        <p className="text-lg opacity-80 leading-relaxed">
          {workout.reasoning}
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={onCompleteWorkout}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium"
          leftIcon={<CheckCircleIcon className="w-5 h-5" />}
        >
          Mark Complete
        </Button>
        <Button 
          variant="outline"
          onClick={onModifyPlan}
          className="border-blue-300 dark:border-blue-700 px-6 py-3 rounded-xl"
          leftIcon={<PencilIcon className="w-5 h-5" />}
        >
          Modify Plan
        </Button>
      </div>
    </div>
  )
})

// Race progress indicator
const RaceProgress = React.memo(function RaceProgress({ 
  daysToRace, 
  raceDate,
  prediction 
}: { 
  daysToRace?: number
  raceDate?: string
  prediction: any 
}) {
  if (!daysToRace || !raceDate) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <h3 className="font-semibold mb-2">Race Progress</h3>
          <p className="text-sm opacity-70 mb-4">Set your race date to track progress</p>
          <a href="/setup" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
            Set Race Date
          </a>
        </div>
      </Card>
    )
  }

  const weeksToRace = Math.ceil(daysToRace / 7)
  const progressPercentage = Math.max(0, Math.min(100, (1 - (weeksToRace / 20)) * 100))

  return (
    <Card className="p-6">
      <h3 className="font-semibold mb-4">Race Readiness</h3>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm opacity-70">Days to race</span>
          <span className="font-semibold">{daysToRace}</span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
        
        {prediction.seconds > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-sm opacity-70">Predicted time</span>
              <span className="font-semibold">{formatHMS(prediction.seconds)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
})

// Collapsible secondary data section
const SecondaryDataSection = React.memo(function SecondaryDataSection({
  isExpanded,
  onToggle,
  thisWeekKm,
  last4WeeksKm,
  workoutsLogged,
  weekly,
  isLoading
}: {
  isExpanded: boolean
  onToggle: () => void
  thisWeekKm: number
  last4WeeksKm: number
  workoutsLogged: number
  weekly: any[]
  isLoading: boolean
}) {
  const LazyChart = React.lazy(() => import('@/components/LazyChart').then(m => ({ default: m.LazyChart })))
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <span className="font-medium">Training Data & Analytics</span>
        {isExpanded ? (
          <ChevronUpIcon className="w-5 h-5" />
        ) : (
          <ChevronDownIcon className="w-5 h-5" />
        )}
      </button>
      
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Last 7 Days"
              value={thisWeekKm > 0 ? `${thisWeekKm.toFixed(1)} km` : '0.0 km'}
              icon={<ChartBarIcon className="w-4 h-4" />}
              loading={isLoading}
            />
            <MetricCard
              title="Last 4 Weeks"
              value={last4WeeksKm > 0 ? `${last4WeeksKm.toFixed(1)} km` : '0.0 km'}
              icon={<ChartBarIcon className="w-4 h-4" />}
              loading={isLoading}
            />
            <MetricCard
              title="Activities Logged"
              value={workoutsLogged}
              icon={<CloudArrowUpIcon className="w-4 h-4" />}
              loading={isLoading}
            />
          </div>
          
          {/* Weekly Chart */}
          {weekly.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Weekly Mileage Trend</h4>
              <div className="h-48">
                <React.Suspense fallback={<div className="h-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />}>
                  <LazyChart 
                    data={weekly.slice(-12)} 
                    height="100%" 
                    dataKey="km" 
                    xAxisKey="week" 
                    stroke="#4f46e5" 
                  />
                </React.Suspense>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// Simplified dashboard data interface
interface DashboardData {
  weekly: Array<{ week: string; km: number }>
  thisWeekKm: number
  last4WeeksKm: number
  pred: { seconds: number; ci: number }
  workoutsLogged: number
  isLoading: boolean
}

function useDashboardData() {
  const user = useUserStore((s) => s.user)
  const hydrateUser = useUserStore((s) => s.hydrate)
  const activities = useActivities((s) => s.list.slice(-50)) // Limit for performance
  const activitiesHydrate = useActivities((s) => s.hydrate)
  const progressHydrate = useProgress((s) => s.hydrate)
  const [isClientSide, setIsClientSide] = useState(false)

  // Hydration effect
  useEffect(() => {
    let mounted = true
    const timer = setTimeout(() => {
      if (!mounted) return
      
      Promise.all([
        hydrateUser(),
        activitiesHydrate(),
        progressHydrate()
      ]).then(() => {
        if (mounted) setIsClientSide(true)
      }).catch(() => {
        if (mounted) setIsClientSide(true)
      })
    }, 16)
    
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [hydrateUser, activitiesHydrate, progressHydrate])

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

  const dashboardData = useMemo(() => {
    if (!isClientSide) {
      return {
        weekly: [],
        thisWeekKm: 0,
        last4WeeksKm: 0,
        pred: { seconds: 0, ci: 0 },
        workoutsLogged: 0,
        isLoading: true
      }
    }

    try {
      const weekly = weeklyMileageKm(activities)
      const thisWeekKm = last7DaysMileageKm(activities)
      const last4WeeksKm = weekly.slice(-4).reduce((s, x) => s + x.km, 0)
      const pred = predictMarathonTime(activities, user || undefined)
      const workoutsLogged = activitiesWithDatesCount(activities)
      
      return {
        weekly,
        thisWeekKm,
        last4WeeksKm,
        pred,
        workoutsLogged,
        isLoading: false
      }
    } catch (error) {
      console.warn('Dashboard calculation error:', error)
      return {
        weekly: [],
        thisWeekKm: 0,
        last4WeeksKm: 0,
        pred: { seconds: 0, ci: 0 },
        workoutsLogged: 0,
        isLoading: false
      }
    }
  }, [activities, isClientSide, user])

  const todaysWorkout = useMemo(() => {
    if (!user || !isClientSide) {
      return {
        type: 'Easy Run',
        distance: '8K',
        pace: '6:30',
        reasoning: 'Loading your personalized workout recommendation...'
      }
    }
    return getTodaysWorkout(user, activities, weeksToRace)
  }, [user, activities, weeksToRace, isClientSide])

  return { 
    user, 
    daysToRace, 
    weeksToRace,
    todaysWorkout,
    ...dashboardData
  }
}

export default function Home() {
  const { user, daysToRace, todaysWorkout, weekly, thisWeekKm, last4WeeksKm, pred, workoutsLogged, isLoading } = useDashboardData()
  const acts = useActivities(useCallback((s) => ({ 
    refreshFromIntervalsIcu: s.refreshFromIntervalsIcu, 
    error: s.error, 
    isLoading: s.isLoading 
  }), []))
  const [showSecondaryData, setShowSecondaryData] = useState(false)

  const refreshActivities = useCallback(async () => {
    console.log('Refreshing activities from intervals.icu...')
    clearDistanceCache()
    await acts.refreshFromIntervalsIcu()
  }, [acts])

  const handleCompleteWorkout = useCallback(() => {
    // Navigate to intervals.icu or show completion modal
    if (confirm('Great job! Mark this workout as complete in intervals.icu?')) {
      window.open('https://intervals.icu', '_blank')
    }
  }, [])

  const handleModifyPlan = useCallback(() => {
    // Navigate to plan modification
    window.location.href = '/setup'
  }, [])

  const isNewUser = !user || (!user.raceDate && thisWeekKm === 0)

  if (isNewUser && user) {
    return (
      <div className="space-y-6">
        <WelcomeMessage userName={user.name} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="text-center pt-6">
        <h1 className="text-2xl font-bold mb-2">Marathon Coach</h1>
        <p className="text-lg opacity-70">Welcome back, {user?.name}!</p>
        
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshActivities}
            disabled={acts.isLoading}
            className="text-xs"
          >
            {acts.isLoading ? 'Syncing...' : 'Sync intervals.icu'}
          </Button>
        </div>
      </div>

      {/* Error notification */}
      {acts.error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm"><strong>Sync Issue:</strong> {acts.error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshActivities}
              disabled={acts.isLoading}
            >
              Retry
            </Button>
          </div>
        </Card>
      )}

      {/* 1. Daily Workout Hero Section */}
      <ErrorBoundaryWrapper componentName="DailyWorkoutHero">
        <DailyWorkoutHero 
          workout={todaysWorkout}
          onCompleteWorkout={handleCompleteWorkout}
          onModifyPlan={handleModifyPlan}
        />
      </ErrorBoundaryWrapper>

      {/* 2. Race Progress */}
      <ErrorBoundaryWrapper componentName="RaceProgress">
        <RaceProgress 
          daysToRace={daysToRace}
          raceDate={user?.raceDate}
          prediction={pred}
        />
      </ErrorBoundaryWrapper>

      {/* 3. Secondary Data (Collapsible) */}
      <ErrorBoundaryWrapper componentName="SecondaryDataSection">
        <SecondaryDataSection 
          isExpanded={showSecondaryData}
          onToggle={() => setShowSecondaryData(!showSecondaryData)}
          thisWeekKm={thisWeekKm}
          last4WeeksKm={last4WeeksKm}
          workoutsLogged={workoutsLogged}
          weekly={weekly}
          isLoading={isLoading}
        />
      </ErrorBoundaryWrapper>
    </div>
  )
}