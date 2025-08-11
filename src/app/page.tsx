"use client";
import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { useUserStore } from '@/store/user'
import { weeklyFocus, achievement } from '@/utils/coach/advice'
import { useActivities, weeklyMileageKm, last7DaysMileageKm, activitiesWithDatesCount } from '@/store/activities'
import { useProgress } from '@/store/progress'
import { predictMarathonTime, formatHMS } from '@/utils/predict'
import { TrashIcon, ExclamationTriangleIcon, CalendarDaysIcon, ChartBarIcon, CloudArrowUpIcon, TrophyIcon } from '@heroicons/react/24/outline'
import { LoadingCard, LoadingSkeleton } from '@/components/LoadingSpinner'
import { LazyChart } from '@/components/LazyChart'
// import { HeroImage, CardImage } from '@/components/UnsplashImage'
import { HeroImage, CardImage } from '@/components/SimpleFallback'

// Lazy load heavy components
import dynamic from 'next/dynamic'
const ActivityCard = dynamic(() => import('@/components/ActivityCard'), {
  loading: () => <LoadingCard />
})

// Memoized CoachCard to prevent unnecessary recalculations
const CoachCard = React.memo(function CoachCard() {
  const user = useUserStore((s) => s.user)
  const activities = useActivities((s) => s.list.slice(-20)) // Only take last 20 for coach advice
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50) // Debounce mounting
    return () => clearTimeout(timer)
  }, [])

  const coachData = useMemo(() => {
    if (!mounted || !user?.raceDate) {
      return { msg: 'Set a race date to get weekly focus.', pred: null, ach: '' }
    }
    
    const now = new Date()
    const race = new Date(user.raceDate)
    const weeksToRace = Math.max(0, Math.ceil((race.getTime() - now.getTime()) / (1000*60*60*24*7)))
    
    // Only calculate if we have activities
    if (activities.length === 0) {
      return { 
        msg: weeklyFocus(weeksToRace), 
        pred: null, 
        ach: 'Upload some activities to see achievements!' 
      }
    }
    
    const prediction = predictMarathonTime(activities)
    const totalKm = activities.reduce((s,a)=>s+(a.distance||0),0)/1000
    const achievementMsg = achievement(totalKm)
    
    return { 
      msg: weeklyFocus(weeksToRace), 
      pred: prediction, 
      ach: achievementMsg 
    }
  }, [user?.raceDate, activities.length, mounted]) // Only depend on length

  if (!mounted) {
    return <p className="text-sm opacity-80">Loading coach advice...</p>
  }

  if (!user?.raceDate) {
    return <p className="text-sm opacity-80">{coachData.msg}</p>
  }

  return (
    <div className="text-sm space-y-1">
      <p>{coachData.msg}</p>
      {coachData.pred?.seconds && (
        <p>Predicted marathon: {formatHMS(coachData.pred.seconds)} ± {Math.round(coachData.pred.ci/60)} min</p>
      )}
      {coachData.ach && <p className="font-medium">{coachData.ach}</p>}
    </div>
  )
})

// Cache for dashboard calculations to prevent recalculations
let dashboardCache: {
  data: any;
  checksum: string;
  timestamp: number;
} | null = null;

const DASHBOARD_CACHE_DURATION = 30 * 1000; // 30 seconds

function useDashboardData() {
  const user = useUserStore((s) => s.user)
  const hydrateUser = useUserStore((s) => s.hydrate)
  const activities = useActivities((s) => ({ 
    list: s.list.slice(-100), // Only take last 100 activities for performance
    hydrate: s.hydrate 
  }))
  const progress = useProgress()
  const [isClientSide, setIsClientSide] = useState(false)

  // Single hydration effect with debouncing
  useEffect(() => {
    let mounted = true
    const timer = setTimeout(() => {
      if (!mounted) return
      
      // Batch hydration operations
      Promise.all([
        hydrateUser(),
        activities.hydrate(),
        progress.hydrate()
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
  }, []) // Remove dependencies to prevent re-runs

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

    if (!isClientSide || !activities.list.length) {
      return defaults
    }

    // Create cache key from data length and timestamp
    const now = Date.now()
    const checksum = `${activities.list.length}-${Math.floor(now / DASHBOARD_CACHE_DURATION)}`
    
    // Return cached data if available and fresh
    if (dashboardCache && 
        dashboardCache.checksum === checksum &&
        (now - dashboardCache.timestamp) < DASHBOARD_CACHE_DURATION) {
      return dashboardCache.data
    }
    
    // Emergency mode for large datasets
    if (activities.list.length > 50) {
      console.log(`Performance mode: using minimal calculations for ${activities.list.length} activities`)
      const result = {
        ...defaults,
        workoutsLogged: activities.list.filter(a => a.date).length,
        isLoading: false
      }
      
      dashboardCache = { data: result, checksum, timestamp: now }
      return result
    }
    
    // Efficient calculations for smaller datasets
    try {
      // Use web worker or timeout for heavy calculations
      const weekly = weeklyMileageKm(activities.list)
      const thisWeekKm = last7DaysMileageKm(activities.list)
      const last4WeeksKm = weekly.slice(-4).reduce((s, x) => s + x.km, 0)
      const pred = predictMarathonTime(activities.list)
      const workoutsLogged = activitiesWithDatesCount(activities.list)
      
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
  }, [activities.list.length, isClientSide]) // Only depend on length, not full array

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

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <HeroImage 
        query="marathon runner training motivation dawn" 
        className="h-48 sm:h-64 rounded-2xl"
      >
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Marathon Training</h1>
        <p className="text-lg opacity-90">Your personal training companion</p>
        {daysToRace && (
          <p className="text-sm mt-2 opacity-80">
            {daysToRace} days until race day
          </p>
        )}
      </HeroImage>

      <div className="grid gap-6">
      
      {acts.list.length > 100 && (
        <div className="rounded-2xl p-4 sm:p-6 border border-yellow-500/20 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Large Dataset Detected</p>
                <p className="text-sm opacity-80">{acts.list.length} activities loaded. This may slow down the UI.</p>
              </div>
            </div>
            <button 
              onClick={clearAllData}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm whitespace-nowrap"
            >
              <TrashIcon className="w-4 h-4" />
              Clear All Data
            </button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          // Loading skeleton for metrics cards
          Array.from({ length: 4 }).map((_, i) => (
            <LoadingCard key={i} />
          ))
        ) : (
          <>
            <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
              <div className="flex items-center gap-2 text-sm opacity-70 mb-1">
                <CalendarDaysIcon className="w-4 h-4" />
                Days to Race
              </div>
              <div className="text-2xl font-semibold">{daysToRace ?? '—'}</div>
              {user?.raceDate && <div className="text-xs opacity-70 mt-1">Race day: {user.raceDate}</div>}
            </div>
            <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
              <div className="flex items-center gap-2 text-sm opacity-70 mb-1">
                <ChartBarIcon className="w-4 h-4" />
                Last 7 Days
              </div>
              <div className="text-2xl font-semibold">{thisWeekKm.toFixed(1)} km</div>
            </div>
            <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
              <div className="flex items-center gap-2 text-sm opacity-70 mb-1">
                <ChartBarIcon className="w-4 h-4" />
                Last 4 Weeks
              </div>
              <div className="text-2xl font-semibold">{last4WeeksKm.toFixed(1)} km</div>
            </div>
            <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
              <div className="flex items-center gap-2 text-sm opacity-70 mb-1">
                <CloudArrowUpIcon className="w-4 h-4" />
                Activities Uploaded
              </div>
              <div className="text-2xl font-semibold">{workoutsLogged}</div>
            </div>
          </>
        )}
      </section>

      {/* Coach and Race Predictor - Same Line */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <LoadingCard />
            <LoadingCard />
          </>
        ) : (
          <>
            <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
              <div className="flex items-center gap-4 mb-4">
                <CardImage 
                  query="coach trainer motivation running" 
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0" 
                  small={true} 
                />
                <h3 className="font-medium">Your Coach</h3>
              </div>
              <CoachCard />
            </div>
            <div>
              <PredictorCard predSeconds={pred.seconds} goalTime={user?.goalTime} />
            </div>
          </>
        )}
      </section>

      {/* Weekly Mileage Chart - Only render if we have data */}
      {weekly.length > 0 && (
        <section className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <CardImage 
                query="running statistics chart progress" 
                className="w-8 h-8 rounded object-cover" 
                small={true} 
              />
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
    </div>
  );
}
