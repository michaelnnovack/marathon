"use client";
import { useEffect, useMemo, useCallback } from 'react'
import { useUserStore } from '@/store/user'
import { weeklyFocus, achievement } from '@/utils/coach/advice'
import { useActivities, weeklyMileageKm, last7DaysMileageKm, activitiesWithDatesCount } from '@/store/activities'
import { useProgress } from '@/store/progress'
import { predictMarathonTime, formatHMS } from '@/utils/predict'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'
import ActivityCard from '@/components/ActivityCard'
import HeartRateZones from '@/components/HeartRateZones'

function CoachCard() {
  const user = useUserStore((s) => s.user)
  const acts = useActivities()
  
  useEffect(() => {
    if (typeof window !== 'undefined' && !acts.list.length) {
      acts.hydrate()
    }
  }, [acts])

  const { msg, pred, ach } = useMemo(() => {
    if (!user?.raceDate) return { msg: '', pred: { seconds: 0, ci: 0 }, ach: '' }
    
    const now = new Date()
    const race = new Date(user.raceDate)
    const weeksToRace = Math.max(0, Math.ceil((race.getTime() - now.getTime()) / (1000*60*60*24*7)))
    const weeklyMsg = weeklyFocus(weeksToRace)
    const prediction = predictMarathonTime(acts.list)
    const totalKm = acts.list.reduce((s,a)=>s+(a.distance||0),0)/1000
    const achievementMsg = achievement(totalKm)
    
    return { 
      msg: weeklyMsg, 
      pred: prediction, 
      ach: achievementMsg 
    }
  }, [user?.raceDate, acts.list])

  if (!user?.raceDate) return <p className="text-sm opacity-80">Set a race date to get weekly focus.</p>

  return (
    <div className="text-sm space-y-1">
      <p>{msg}</p>
      {!!pred.seconds && <p>Predicted marathon: {formatHMS(pred.seconds)} ± {Math.round(pred.ci/60)} min</p>}
      {ach && <p className="font-medium">{ach}</p>}
    </div>
  )
}

function useDashboardData() {
  const user = useUserStore((s) => s.user)
  const hydrateUser = useUserStore((s) => s.hydrate)
  const acts = useActivities()
  const progress = useProgress()

  useEffect(() => {
    hydrateUser()
    acts.hydrate()
    progress.hydrate()
  }, [hydrateUser, acts, progress])

  const daysToRace = useMemo(() => {
    if (!user?.raceDate) return undefined
    const now = new Date()
    const race = new Date(user.raceDate)
    return Math.max(0, Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }, [user?.raceDate])

  const dashboardMetrics = useMemo(() => {
    // Emergency mode - minimal processing
    if (acts.list.length > 1000) {
      console.log(`Emergency mode: ${acts.list.length} activities detected - using minimal data`)
      return {
        weekly: [],
        thisWeekKm: 0,
        last4WeeksKm: 0,
        pred: { seconds: 0, ci: 0 },
        workoutsLogged: acts.list.filter(a => a.date).length
      }
    }
    
    // Normal processing for smaller datasets
    const limitedList = acts.list.slice(-100) // Even more restrictive limit
    console.log(`Processing ${limitedList.length} activities (total: ${acts.list.length})`)
    
    const weekly = weeklyMileageKm(limitedList)
    const thisWeekKm = last7DaysMileageKm(limitedList)
    const last4WeeksKm = weekly.slice(-4).reduce((s, x) => s + x.km, 0)
    const pred = predictMarathonTime(limitedList)
    const workoutsLogged = activitiesWithDatesCount(limitedList)
    
    return {
      weekly,
      thisWeekKm,
      last4WeeksKm,
      pred,
      workoutsLogged
    }
  }, [acts.list])

  const { weekly, thisWeekKm, last4WeeksKm, pred, workoutsLogged } = dashboardMetrics

  return { user, daysToRace, weekly, thisWeekKm, last4WeeksKm, pred, workoutsLogged }
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
        <h3 className="font-medium">Race Predictor</h3>
        {badge}
      </div>
      <div className="text-2xl font-semibold">{predSeconds ? formatHMS(predSeconds) : '—:—:—'}</div>
      {goalSec ? (
        <div className="mt-3">
          <div className="h-2 w-full rounded bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }} />
          </div>
          <div className="text-xs opacity-70 mt-1 hidden sm:block">0% = goal pace, 100% = at goal, {'>'}100% = over goal</div>
        </div>
      ) : (
        <div className="text-sm opacity-70 mt-2">Set a goal time in Setup to compare.</div>
      )}
    </div>
  )
}

export default function Home() {
  const { user, daysToRace, weekly, thisWeekKm, last4WeeksKm, pred, workoutsLogged } = useDashboardData()
  const acts = useActivities()
  const progress = useProgress()
  
  const clearAllData = useCallback(() => {
    if (confirm('Clear all activities and progress data? This cannot be undone.')) {
      acts.clear()
      progress.hydrate()
      console.log('All data cleared')
    }
  }, [acts, progress])

  return (
    <div className="grid gap-6">
      
      {acts.list.length > 100 && (
        <div className="rounded-2xl p-4 sm:p-6 border border-yellow-500/20 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-medium">Large Dataset Detected</p>
              <p className="text-sm opacity-80">{acts.list.length} activities loaded. This may slow down the UI.</p>
            </div>
            <button 
              onClick={clearAllData}
              className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm whitespace-nowrap"
            >
              Clear All Data
            </button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
          <div className="text-sm opacity-70">Days to Race</div>
          <div className="text-2xl font-semibold">{daysToRace ?? '—'}</div>
          {user?.raceDate && <div className="text-xs opacity-70 mt-1">Race day: {user.raceDate}</div>}
        </div>
        <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
          <div className="text-sm opacity-70">Last 7 Days</div>
          <div className="text-2xl font-semibold">{thisWeekKm.toFixed(1)} km</div>
        </div>
        <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
          <div className="text-sm opacity-70">Last 4 Weeks</div>
          <div className="text-2xl font-semibold">{last4WeeksKm.toFixed(1)} km</div>
        </div>
        <div className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
          <div className="text-sm opacity-70">Activities Uploaded</div>
          <div className="text-2xl font-semibold">{workoutsLogged}</div>
        </div>
      </section>

      <section className="rounded-2xl p-4 sm:p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
        <h3 className="font-medium mb-2">Coach</h3>
        <CoachCard />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-6 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 lg:col-span-2 order-2 lg:order-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Weekly Mileage</h3>
            <div className="text-xs opacity-70">Last {weekly.length} wks</div>
          </div>
          <div className="h-48 sm:h-56 md:h-64">
            {weekly.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weekly.slice(-52)}> {/* Only show last 52 weeks max for performance */}
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="km" stroke="#4f46e5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm opacity-70">
                No activity data available. Upload TCX/GPX files to see your weekly mileage chart.
              </div>
            )}
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <PredictorCard predSeconds={pred.seconds} goalTime={user?.goalTime} />
        </div>
      </section>

      <section>
        <HeartRateZones />
      </section>

      {/* Recent Activities with GPS Routes */}
      {acts.list.filter(a => a.trackPoints && a.trackPoints.length > 0).length > 0 && (
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

    </div>
  );
}
