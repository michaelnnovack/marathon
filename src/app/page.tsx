"use client"
import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { useUserStore } from '@/store/user'
import { useActivities, weeklyMileageKm, last7DaysMileageKm, activitiesWithDatesCount } from '@/store/activities'
import { useProgress } from '@/store/progress'
import { predictMarathonTime, formatHMS } from '@/utils/predict'
import { TrashIcon, ExclamationTriangleIcon, CalendarDaysIcon, ChartBarIcon, CloudArrowUpIcon, TrophyIcon, UserIcon } from '@heroicons/react/24/outline'
import { LoadingCard } from '@/components/LoadingSpinner'
import { LazyChart } from '@/components/LazyChart'
import { Card, CardHeader, CardContent, MetricCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundary'
import EnhancedCoachCard from '@/components/EnhancedCoachCard'
import AchievementsDashboard from '@/components/AchievementsDashboard'
import { UserSelector } from '@/components/UserSelector'

// Lazy load heavy components
import dynamic from 'next/dynamic'
import ActivityList from '@/components/ActivityList'
const ActivityCard = dynamic(() => import('@/components/ActivityCard'), {
  loading: () => <LoadingCard />
})

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
            Start by setting your race date and goal time, then upload your training activities to get personalized coaching advice and track your progress.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <a href="/setup" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium">
              Complete Setup
            </a>
            <a href="/upload" className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-600 dark:text-indigo-300 dark:hover:bg-indigo-900/20">
              Upload Activities
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

// Cache for dashboard calculations to prevent recalculations
interface DashboardCacheData {
  weekly: Array<{ week: string; km: number }>;
  thisWeekKm: number;
  last4WeeksKm: number;
  pred: { seconds: number; ci: number };
  workoutsLogged: number;
  isLoading: boolean;
}

let dashboardCache: {
  data: DashboardCacheData;
  checksum: string;
  timestamp: number;
} | null = null;

const DASHBOARD_CACHE_DURATION = 30 * 1000; // 30 seconds

function useDashboardData() {
  const user = useUserStore((s) => s.user)
  const hydrateUser = useUserStore((s) => s.hydrate)
  const activities = useActivities((s) => s.list.slice(-100)) // Only take last 100 activities for performance
  const activitiesHydrate = useActivities((s) => s.hydrate)
  const progressHydrate = useProgress((s) => s.hydrate)
  const [isClientSide, setIsClientSide] = useState(false)

  // Single hydration effect with debouncing
  useEffect(() => {
    let mounted = true
    const timer = setTimeout(() => {
      if (!mounted) return
      
      // Batch hydration operations
      Promise.all([
        hydrateUser(),
        activitiesHydrate(),
        progressHydrate()
      ]).then(() => {
        if (mounted) setIsClientSide(true)
      }).catch(() => {
        if (mounted) setIsClientSide(true) // Always set to prevent hanging
      })
    }, 16) // Single RAF delay
    
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [hydrateUser, activitiesHydrate, progressHydrate]) // Include all dependencies

  const daysToRace = useMemo(() => {
    if (!user?.raceDate) return undefined
    const now = new Date()
    const race = new Date(user.raceDate)
    return Math.max(0, Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }, [user?.raceDate])

  const dashboardMetrics = useMemo(() => {
    // Always provide non-loading defaults for SSR
    const defaults = {
      weekly: [],
      thisWeekKm: 0,
      last4WeeksKm: 0,
      pred: { seconds: 0, ci: 0 },
      workoutsLogged: 0,
      isLoading: false
    }

    if (!isClientSide || !activities.length) {
      return defaults
    }

    // Create cache key from data length and timestamp
    const now = Date.now()
    const checksum = `${activities.length}-${Math.floor(now / DASHBOARD_CACHE_DURATION)}`
    
    // Return cached data if available and fresh
    if (dashboardCache && 
        dashboardCache.checksum === checksum &&
        (now - dashboardCache.timestamp) < DASHBOARD_CACHE_DURATION) {
      return dashboardCache.data
    }
    
    // Emergency mode for large datasets
    if (activities.length > 50) {
      console.log(`Performance mode: using minimal calculations for ${activities.length} activities`)
      const result = {
        ...defaults,
        workoutsLogged: activities.filter(a => a.date).length,
        isLoading: false
      }
      
      dashboardCache = { data: result, checksum, timestamp: now }
      return result
    }
    
    // Efficient calculations for smaller datasets
    try {
      // Use web worker or timeout for heavy calculations
      const weekly = weeklyMileageKm(activities)
      const thisWeekKm = last7DaysMileageKm(activities)
      const last4WeeksKm = weekly.slice(-4).reduce((s, x) => s + x.km, 0)
      const pred = predictMarathonTime(activities)
      const workoutsLogged = activitiesWithDatesCount(activities)
      
      const result = {
        weekly,
        thisWeekKm,
        last4WeeksKm,
        pred,
        workoutsLogged,
        isLoading: false
      }
      
      // Cache the result
      dashboardCache = { data: result, checksum, timestamp: now }
      return result
    } catch (error) {
      console.warn('Error processing dashboard data:', error)
      const result = { ...defaults, isLoading: false }
      dashboardCache = { data: result, checksum, timestamp: now }
      return result
    }
  }, [activities, isClientSide]) // Include full activities dependency

  const { weekly, thisWeekKm, last4WeeksKm, pred, workoutsLogged, isLoading } = dashboardMetrics

  return { user, daysToRace, weekly, thisWeekKm, last4WeeksKm, pred, workoutsLogged, isLoading }
}

function PredictorCard({ predSeconds, goalTime }: { predSeconds: number; goalTime?: string }) {
  const goalSec = useMemo(() => {
    if (!goalTime) return undefined
    const [h, m, s] = goalTime.split(':').map(Number)
    return h * 3600 + m * 60 + s
  }, [goalTime])

  const deltaMin = useMemo(() => {
    if (!goalSec || !predSeconds) return undefined
    return Math.round((predSeconds - goalSec) / 60)
  }, [goalSec, predSeconds])

  const ratio = useMemo(() => {
    if (!goalSec || !predSeconds || goalSec <= 0) return 0
    return Math.max(0, Math.min(2, predSeconds / goalSec))
  }, [goalSec, predSeconds])

  // Convert ratio to display percentage: 1.0 (at goal) = 75%, allowing room to show improvement
  const displayPercentage = useMemo(() => {
    if (ratio === 0) return 0
    // Scale so that ratio 1.0 = 75%, ratio 1.33 = 100% 
    return Math.min(100, Math.max(0, (ratio * 75)))
  }, [ratio])

  const barColor = ratio <= 1 ? 'bg-green-500' : ratio <= 1.1 ? 'bg-yellow-500' : 'bg-red-500'
  const badge = !goalSec || deltaMin === undefined
    ? null
    : (
      <span className={`text-xs px-2 py-0.5 rounded-full ${deltaMin <= 0 ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'}`}>
        {deltaMin <= 0 ? 'On or ahead of goal' : `+${deltaMin} min over goal`}
      </span>
    )

  return (
    <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-1 sm:gap-0">
        <div className="flex items-center gap-2">
          <TrophyIcon className="w-5 h-5" />
          <h3 className="font-medium">Race Predictor</h3>
        </div>
        {badge}
      </div>
      <div className="text-2xl font-semibold">{predSeconds ? formatHMS(predSeconds) : '—:—:—'}</div>
      {goalSec ? (
        <div className="mt-3">
          {/* Pace markers */}
          <div className="relative mb-1">
            <div className="flex justify-between text-xs opacity-60">
              <span>3:00</span>
              <span>3:30</span>
              <span>4:00</span>
              <span>4:30</span>
            </div>
          </div>
          
          {/* Progress bar with pace lines */}
          <div className="relative">
            <div className="h-3 w-full rounded bg-black/10 dark:bg-white/10 overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: `${displayPercentage}%` }} />
            </div>
            
            {/* Pace line markers */}
            <div className="absolute top-0 h-full w-full flex justify-between">
              {/* 3:00 marker */}
              <div className="w-px h-full bg-black/20 dark:bg-white/20"></div>
              {/* 3:30 marker */}
              <div className="w-px h-full bg-black/30 dark:bg-white/30"></div>
              {/* 4:00 marker */}
              <div className="w-px h-full bg-black/30 dark:bg-white/30"></div>
              {/* 4:30 marker */}
              <div className="w-px h-full bg-black/20 dark:bg-white/20"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm opacity-70 mt-2">Set a goal time in Setup to compare.</div>
      )}
    </div>
  )
}

export default function Home() {
  const { user, daysToRace, weekly, thisWeekKm, last4WeeksKm, pred, workoutsLogged, isLoading } = useDashboardData()
  const acts = useActivities((s) => ({ list: s.list, clear: s.clear })) // Only get what we need
  const progress = useProgress()
  
  const clearAllData = useCallback(() => {
    if (confirm('Clear all activities and progress data? This cannot be undone.')) {
      acts.clear()
      progress.hydrate()
      console.log('All data cleared')
    }
  }, [acts, progress])

  const isNewUser = !user || (!user.raceDate && acts.list.length === 0)

  return (
    <div className="space-y-6">
      {/* User Selection */}
      <div className="mb-6">
        <UserSelector variant="compact" />
      </div>

      {/* Welcome Section for New Users */}
      {isNewUser && user && (
        <WelcomeMessage userName={user.name} />
      )}

      {/* Main Dashboard for Existing Users */}
      {!isNewUser && (
        <>
          {/* Header Section */}
          <div className="text-center py-6">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Training Dashboard</h1>
            <p className="text-lg opacity-70">Welcome back, {user?.name}!</p>
            {daysToRace && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <CalendarDaysIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {daysToRace} days until race day
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-6">
      
            {acts.list.length > 100 && (
              <Card variant="outlined" className="border-yellow-500/20 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Large Dataset Detected</p>
                      <p className="text-sm opacity-80">{acts.list.length} activities loaded. This may slow down the UI.</p>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={clearAllData}
                    leftIcon={<TrashIcon className="w-4 h-4" />}
                  >
                    Clear All Data
                  </Button>
                </div>
              </Card>
            )}

            <ErrorBoundaryWrapper componentName="MetricsSection">
              <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Days to Race"
                  value={daysToRace ?? '—'}
                  subtitle={user?.raceDate ? `Race day: ${user.raceDate}` : undefined}
                  icon={<CalendarDaysIcon className="w-4 h-4" />}
                  loading={isLoading}
                />
                <MetricCard
                  title="Last 7 Days"
                  value={`${thisWeekKm.toFixed(1)} km`}
                  icon={<ChartBarIcon className="w-4 h-4" />}
                  loading={isLoading}
                />
                <MetricCard
                  title="Last 4 Weeks"
                  value={`${last4WeeksKm.toFixed(1)} km`}
                  icon={<ChartBarIcon className="w-4 h-4" />}
                  loading={isLoading}
                />
                <MetricCard
                  title="Activities Uploaded"
                  value={workoutsLogged}
                  icon={<CloudArrowUpIcon className="w-4 h-4" />}
                  loading={isLoading}
                />
              </section>
            </ErrorBoundaryWrapper>

            {/* Coach and Race Predictor */}
            <ErrorBoundaryWrapper componentName="CoachPredictorSection">
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {isLoading ? (
                  <>
                    <LoadingCard />
                    <LoadingCard />
                    <LoadingCard />
                  </>
                ) : (
                  <>
                    {user && (
                      <ErrorBoundaryWrapper componentName="EnhancedCoachCard">
                        <EnhancedCoachCard user={user} activities={acts.list.slice(-20)} />
                      </ErrorBoundaryWrapper>
                    )}
                    
                    <ErrorBoundaryWrapper componentName="PredictorCard">
                      <PredictorCard predSeconds={pred.seconds} goalTime={user?.goalTime} />
                    </ErrorBoundaryWrapper>

                    <ErrorBoundaryWrapper componentName="AchievementsDashboard">
                      <AchievementsDashboard variant="compact" maxItems={4} />
                    </ErrorBoundaryWrapper>
                  </>
                )}
              </section>
            </ErrorBoundaryWrapper>

            {/* Weekly Mileage Chart - Only render if we have data */}
            {weekly.length > 0 && (
              <section className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">Weekly Mileage</h3>
                  </div>
                  <div className="text-xs opacity-70">Last {weekly.length} wks</div>
                </div>
                <div className="h-48 sm:h-56 md:h-64">
                  <LazyChart 
                    data={weekly.slice(-26)} // Limit to last 26 weeks for performance
                    height="100%" 
                    dataKey="km" 
                    xAxisKey="week" 
                    stroke="#4f46e5" 
                  />
                </div>
              </section>
            )}
            
            {/* Simplified message when no data */}
            {!isLoading && weekly.length === 0 && (
              <section className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
                <div className="text-center py-8">
                  <h3 className="font-medium mb-2">No Training Data Yet</h3>
                  <p className="text-sm opacity-70 mb-4">Upload TCX/GPX files to see your weekly mileage chart</p>
                  <a 
                    href="/upload" 
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                  >
                    <CloudArrowUpIcon className="w-4 h-4" />
                    Upload Activities
                  </a>
                </div>
              </section>
            )}

            {/* Recent Activities with GPS Routes */}
            {!isLoading && acts.list.filter(a => a.trackPoints && a.trackPoints.length > 0).length > 0 && (
              <section className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
                <h3 className="font-medium mb-4">Recent Activities with GPS Routes</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {acts.list
                    .filter(a => a.trackPoints && a.trackPoints.length > 0)
                    .slice(-6)
                    .reverse()
                    .map((activity, i) => (
                      <ActivityCard key={i} activity={activity} />
                    ))
                  }
                </div>
              </section>
            )}
            {/* Virtualized All Activities List for sophisticated UX on large sets */}
            {!isLoading && acts.list.length > 50 && (
              <section className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">All Activities</h3>
                  <span className="text-xs opacity-70">{acts.list.length} total</span>
                </div>
                <ActivityList activities={acts.list} ariaLabel="All Activities" />
              </section>
            )}
            {/* Loading state for GPS activities */}
            {isLoading && (
              <section className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
                <h3 className="font-medium mb-4">Recent Activities with GPS Routes</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <LoadingCard key={i} />
                  ))}
                </div>
              </section>
            )}
            
          </div>
        </>
      )}
    </div>
  )
}
