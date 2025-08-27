'use client'

import { useActivities } from '@/store/activities'
import { useUserStore } from '@/store/user'
import { useEffect, useState } from 'react'
import { 
  predictMarathonTime, 
  calculatePersonalizedTrainingPaces, 
  analyzeHeartRateDistribution,
  formatHMS,
  formatTimeRange 
} from '@/utils/predict'
import { ChartBarIcon, FireIcon, TrophyIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { weeklyMileageKm, last7DaysMileageKm, activitiesSelectors } from '@/store/activities'
import type { SimpleActivity } from '@/types'

interface ProgressInsight {
  type: 'positive' | 'neutral' | 'warning'
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

interface FitnessMetrics {
  ctl: number // Chronic Training Load (fitness)
  atl: number // Acute Training Load (fatigue)
  tsb: number // Training Stress Balance (form)
}

// Calculate simplified fitness metrics
function calculateFitnessMetrics(activities: SimpleActivity[]): FitnessMetrics {
  if (!activities.length) return { ctl: 0, atl: 0, tsb: 0 }
  
  const now = new Date()
  const last42Days = activities.filter(a => {
    if (!a.date) return false
    const activityDate = new Date(a.date)
    const daysAgo = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 42
  })
  
  const last7Days = activities.filter(a => {
    if (!a.date) return false
    const activityDate = new Date(a.date)
    const daysAgo = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo <= 7
  })
  
  // Simple TSS calculation: duration (hours) * intensity factor^2 * 100
  // Assuming moderate intensity factor of 0.8 for most runs
  const calculateTSS = (acts: SimpleActivity[]) => {
    return acts.reduce((total, a) => {
      if (!a.duration || !a.distance) return total
      const hours = a.duration / 3600
      const paceKmh = (a.distance / 1000) / hours
      // Rough intensity factor based on pace
      const intensityFactor = Math.min(1.0, Math.max(0.6, paceKmh / 15)) // Normalize around 15km/h
      return total + (hours * intensityFactor * intensityFactor * 100)
    }, 0)
  }
  
  const ctl = calculateTSS(last42Days) / 42 // Average daily TSS over 42 days
  const atl = calculateTSS(last7Days) / 7   // Average daily TSS over 7 days
  const tsb = ctl - atl                     // Training Stress Balance
  
  return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(tsb) }
}

// Generate coach-like insights
function generateInsights(
  activities: SimpleActivity[], 
  weeklyData: Array<{week: string, km: number}>,
  prediction: any,
  fitness: FitnessMetrics
): ProgressInsight[] {
  const insights: ProgressInsight[] = []
  
  // Training volume trends
  const recentWeeks = weeklyData.slice(-4)
  if (recentWeeks.length >= 2) {
    const avgRecentKm = recentWeeks.reduce((sum, w) => sum + w.km, 0) / recentWeeks.length
    const prevWeeksKm = weeklyData.slice(-8, -4)
    if (prevWeeksKm.length > 0) {
      const avgPrevKm = prevWeeksKm.reduce((sum, w) => sum + w.km, 0) / prevWeeksKm.length
      
      if (avgRecentKm > avgPrevKm * 1.1) {
        insights.push({
          type: 'positive',
          title: 'Volume Building Well',
          description: `Your weekly mileage is up ${Math.round(((avgRecentKm - avgPrevKm) / avgPrevKm) * 100)}% from last month. Consistent progression!`,
          icon: ChartBarIcon
        })
      } else if (avgRecentKm < avgPrevKm * 0.9) {
        insights.push({
          type: 'warning',
          title: 'Volume Has Dropped',
          description: `Weekly mileage down ${Math.round(((avgPrevKm - avgRecentKm) / avgPrevKm) * 100)}%. Consider if this is planned recovery or if consistency needs work.`,
          icon: ChartBarIcon
        })
      }
    }
  }
  
  // Fitness insights
  if (fitness.tsb > 10) {
    insights.push({
      type: 'positive',
      title: 'Fresh and Ready',
      description: `Training Stress Balance of +${fitness.tsb} suggests you're well-recovered and ready for harder sessions.`,
      icon: FireIcon
    })
  } else if (fitness.tsb < -15) {
    insights.push({
      type: 'warning',
      title: 'Fatigue Accumulating',
      description: `Training Stress Balance of ${fitness.tsb} indicates accumulated fatigue. Consider easier days ahead.`,
      icon: FireIcon
    })
  }
  
  // Prediction reliability
  if (prediction.reliability === 'high' && prediction.basedOnActivities >= 8) {
    insights.push({
      type: 'positive',
      title: 'Prediction Confidence High',
      description: `Based on ${prediction.basedOnActivities} quality runs, your marathon prediction is highly reliable.`,
      icon: TrophyIcon
    })
  } else if (prediction.reliability === 'low') {
    insights.push({
      type: 'neutral',
      title: 'Need More Data Points',
      description: `Run more varied distances to improve prediction accuracy. Currently based on ${prediction.basedOnActivities} runs.`,
      icon: CalendarIcon
    })
  }
  
  // Recent activity patterns
  const recentActivities = activities
    .filter(a => a.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .slice(0, 10)
    
  const lastRunDate = recentActivities[0]?.date
  if (lastRunDate) {
    const daysSinceLastRun = (Date.now() - new Date(lastRunDate).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceLastRun > 7) {
      insights.push({
        type: 'warning',
        title: 'Consistency Gap',
        description: `${Math.floor(daysSinceLastRun)} days since last run. Getting back into routine will help maintain fitness.`,
        icon: CalendarIcon
      })
    }
  }
  
  return insights
}

export default function ProgressPage() {
  const { list: activities, isLoading, hydrate } = useActivities()
  const { user } = useUserStore()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    hydrate()
  }, [hydrate])
  
  if (!mounted) {
    return <div className="animate-pulse">Loading progress...</div>
  }
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }
  
  // Calculate metrics
  const weeklyData = weeklyMileageKm(activities)
  const thisWeekKm = last7DaysMileageKm(activities)
  const prediction = predictMarathonTime(activities, user || undefined)
  const fitness = calculateFitnessMetrics(activities)
  const insights = generateInsights(activities, weeklyData, prediction, fitness)
  const hrDistribution = analyzeHeartRateDistribution(activities, user || undefined)
  const trainingPaces = calculatePersonalizedTrainingPaces(activities, user || undefined, prediction.seconds)
  
  // Recent weeks for trend
  const last4Weeks = weeklyData.slice(-4)
  const totalLast4Weeks = last4Weeks.reduce((sum, w) => sum + w.km, 0)
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training Progress</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Your weekly review from your training coach
        </p>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          title="This Week"
          value={`${thisWeekKm.toFixed(1)} km`}
          trend={last4Weeks.length > 1 ? 
            ((thisWeekKm - last4Weeks[last4Weeks.length - 2]?.km) || 0) : 0
          }
          trendLabel="vs last week"
        />
        
        <MetricCard
          title="4-Week Average"
          value={`${(totalLast4Weeks / 4).toFixed(1)} km`}
          subtitle="per week"
        />
        
        <MetricCard
          title="Current Fitness"
          value={fitness.ctl.toString()}
          subtitle="CTL (Chronic Training Load)"
          trend={fitness.tsb}
          trendLabel={fitness.tsb > 0 ? "fresh" : "fatigued"}
        />
        
        <MetricCard
          title="Marathon Prediction"
          value={prediction.seconds ? formatHMS(prediction.seconds) : "---"}
          subtitle={prediction.reliability ? `${prediction.reliability} confidence` : ""}
          reliability={prediction.reliability}
        />
      </div>
      
      {/* Insights Section */}
      {insights.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FireIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Coach Insights
          </h2>
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        </div>
      )}
      
      {/* Fitness Progression Chart */}
      <FitnessChart weeklyData={weeklyData} fitness={fitness} />
      
      {/* Training Zones & Paces */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TrainingPacesCard paces={trainingPaces} prediction={prediction} />
        <HeartRateDistributionCard distribution={hrDistribution} />
      </div>
      
      {/* What's Working / Needs Attention */}
      <WorkingVsNeedsAttention 
        activities={activities} 
        weeklyData={weeklyData} 
        prediction={prediction}
      />
    </div>
  )
}

// Component implementations
function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendLabel, 
  reliability 
}: {
  title: string
  value: string
  subtitle?: string
  trend?: number
  trendLabel?: string
  reliability?: 'low' | 'medium' | 'high'
}) {
  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600 dark:text-green-400'
    if (trend < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-600 dark:text-gray-400'
  }
  
  const getReliabilityColor = (reliability?: string) => {
    switch (reliability) {
      case 'high': return 'text-green-600 dark:text-green-400'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400'
      case 'low': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {subtitle && (
        <div className={`text-sm mt-1 ${getReliabilityColor(reliability)}`}>
          {subtitle}
        </div>
      )}
      {typeof trend === 'number' && trendLabel && (
        <div className={`text-sm mt-1 ${getTrendColor(trend)}`}>
          {trend > 0 ? '+' : ''}{trend.toFixed(1)} {trendLabel}
        </div>
      )}
    </div>
  )
}

function InsightCard({ insight }: { insight: ProgressInsight }) {
  const { type, title, description, icon: Icon } = insight
  
  const colors = {
    positive: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/20',
    neutral: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/20',
    warning: 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/20'
  }
  
  return (
    <div className={`rounded-md p-4 ${colors[type]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm mt-1 opacity-90">{description}</p>
        </div>
      </div>
    </div>
  )
}

function FitnessChart({ 
  weeklyData, 
  fitness 
}: { 
  weeklyData: Array<{week: string, km: number}>
  fitness: FitnessMetrics 
}) {
  const last12Weeks = weeklyData.slice(-12)
  const maxKm = Math.max(...last12Weeks.map(w => w.km))
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold mb-4">Weekly Volume Trend</h2>
      
      {/* Simple bar chart */}
      <div className="space-y-2">
        {last12Weeks.map((week, index) => {
          const percentage = maxKm > 0 ? (week.km / maxKm) * 100 : 0
          const weekDate = new Date(week.week)
          const isRecent = index >= last12Weeks.length - 2
          
          return (
            <div key={week.week} className="flex items-center gap-3">
              <div className="text-xs text-gray-500 w-12">
                {weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 relative">
                <div 
                  className={`h-full rounded-full transition-all ${
                    isRecent ? 'bg-blue-500' : 'bg-blue-300 dark:bg-blue-600'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-start pl-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {week.km.toFixed(1)}km
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Fitness metrics summary */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">{fitness.ctl}</div>
          <div className="text-xs text-gray-500">Fitness (CTL)</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{fitness.atl}</div>
          <div className="text-xs text-gray-500">Fatigue (ATL)</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-semibold ${
            fitness.tsb > 0 ? 'text-green-600 dark:text-green-400' : 
            fitness.tsb < 0 ? 'text-red-600 dark:text-red-400' :
            'text-gray-600 dark:text-gray-400'
          }`}>
            {fitness.tsb > 0 ? '+' : ''}{fitness.tsb}
          </div>
          <div className="text-xs text-gray-500">Form (TSB)</div>
        </div>
      </div>
    </div>
  )
}

function TrainingPacesCard({ paces, prediction }: { paces: any, prediction: any }) {
  const formatPace = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
  
  if (!paces) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Training Paces</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Complete more runs to get personalized training paces
        </p>
      </div>
    )
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold mb-4">Your Training Paces</h2>
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2">
          <div>
            <span className="font-medium">Easy</span>
            <span className="text-sm text-gray-500 block">Recovery & base runs</span>
          </div>
          <span className="font-mono text-lg">{paces.easy ? formatPace(paces.easy) : '---'}/km</span>
        </div>
        
        <div className="flex justify-between items-center py-2 bg-blue-50 dark:bg-blue-950/30 rounded px-3">
          <div>
            <span className="font-medium">Marathon</span>
            <span className="text-sm text-gray-500 block">Race pace target</span>
          </div>
          <span className="font-mono text-lg font-semibold">{paces.marathon ? formatPace(paces.marathon) : '---'}/km</span>
        </div>
        
        <div className="flex justify-between items-center py-2">
          <div>
            <span className="font-medium">Tempo</span>
            <span className="text-sm text-gray-500 block">Comfortably hard</span>
          </div>
          <span className="font-mono text-lg">{paces.tempo ? formatPace(paces.tempo) : '---'}/km</span>
        </div>
        
        <div className="flex justify-between items-center py-2">
          <div>
            <span className="font-medium">Interval</span>
            <span className="text-sm text-gray-500 block">Speed work</span>
          </div>
          <span className="font-mono text-lg">{paces.interval ? formatPace(paces.interval) : '---'}/km</span>
        </div>
      </div>
      
      {prediction.seconds && prediction.ci && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
          Predicted marathon: {formatTimeRange(prediction.seconds, prediction.ci)}
        </div>
      )}
    </div>
  )
}

function HeartRateDistributionCard({ distribution }: { distribution: any }) {
  if (!distribution) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Heart Rate Distribution</h2>
        <p className="text-gray-600 dark:text-gray-400">
          No heart rate data available. Consider using a heart rate monitor for better training insights.
        </p>
      </div>
    )
  }
  
  const zones = [
    { name: 'Recovery', value: distribution.recovery, color: 'bg-green-400' },
    { name: 'Aerobic', value: distribution.aerobic, color: 'bg-blue-400' },
    { name: 'Tempo', value: distribution.tempo, color: 'bg-yellow-400' },
    { name: 'Lactate', value: distribution.lactate, color: 'bg-orange-400' },
    { name: 'Neuro', value: distribution.neuro, color: 'bg-red-400' },
  ]
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold mb-4">Heart Rate Distribution</h2>
      <div className="space-y-3">
        {zones.map(zone => (
          <div key={zone.name} className="flex items-center gap-3">
            <div className="w-16 text-sm text-gray-600 dark:text-gray-400">{zone.name}</div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 relative">
              <div 
                className={`h-full rounded-full ${zone.color}`}
                style={{ width: `${zone.value}%` }}
              />
            </div>
            <div className="w-12 text-sm font-medium text-right">
              {zone.value.toFixed(0)}%
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
        Aim for 80% easy/aerobic, 20% moderate/hard for optimal training distribution
      </div>
    </div>
  )
}

function WorkingVsNeedsAttention({ 
  activities, 
  weeklyData, 
  prediction 
}: { 
  activities: SimpleActivity[]
  weeklyData: Array<{week: string, km: number}>
  prediction: any 
}) {
  const recentWeeks = weeklyData.slice(-4)
  const consistency = recentWeeks.filter(w => w.km > 0).length
  const avgWeeklyKm = recentWeeks.reduce((sum, w) => sum + w.km, 0) / recentWeeks.length
  
  const workingWell = []
  const needsAttention = []
  
  // Analyze what's working
  if (consistency >= 3) {
    workingWell.push('Consistent weekly training - ' + consistency + ' out of 4 weeks active')
  }
  
  if (avgWeeklyKm >= 30) {
    workingWell.push(`Good training volume - ${avgWeeklyKm.toFixed(1)}km per week average`)
  }
  
  if (prediction.reliability === 'high') {
    workingWell.push(`Reliable race prediction - based on ${prediction.basedOnActivities} quality runs`)
  }
  
  const recentRuns = activities
    .filter(a => a.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .slice(0, 5)
    
  const longRuns = recentRuns.filter(r => (r.distance || 0) >= 15000)
  if (longRuns.length >= 1) {
    workingWell.push(`Long runs incorporated - ${longRuns.length} runs 15km+ in last 5 sessions`)
  }
  
  // Analyze what needs attention
  if (consistency < 3) {
    needsAttention.push(`Training consistency - only ${consistency} weeks active in last 4`)
  }
  
  if (avgWeeklyKm < 25) {
    needsAttention.push(`Training volume - ${avgWeeklyKm.toFixed(1)}km/week may be low for marathon goals`)
  }
  
  if (prediction.reliability === 'low') {
    needsAttention.push(`Prediction reliability - need more varied distance runs for accuracy`)
  }
  
  const lastRunDate = recentRuns[0]?.date
  if (lastRunDate) {
    const daysSince = (Date.now() - new Date(lastRunDate).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 5) {
      needsAttention.push(`Recent activity - ${Math.floor(daysSince)} days since last run`)
    }
  }
  
  if (longRuns.length === 0) {
    needsAttention.push('Long runs - no runs 15km+ in recent sessions')
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4 flex items-center gap-2">
          <TrophyIcon className="w-5 h-5" />
          What's Working Well
        </h2>
        {workingWell.length > 0 ? (
          <ul className="space-y-2">
            {workingWell.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-green-700 dark:text-green-300">
                <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-green-700 dark:text-green-300 text-sm">
            Keep building your training foundation - progress will show here as you log more activities.
          </p>
        )}
      </div>
      
      <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-4 flex items-center gap-2">
          <FireIcon className="w-5 h-5" />
          Areas for Focus
        </h2>
        {needsAttention.length > 0 ? (
          <ul className="space-y-2">
            {needsAttention.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-yellow-700 dark:text-yellow-300">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-yellow-700 dark:text-yellow-300 text-sm">
            Your training is looking well balanced! Keep up the excellent work.
          </p>
        )}
      </div>
    </div>
  )
}