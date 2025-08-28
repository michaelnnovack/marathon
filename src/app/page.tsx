"use client"
import React, { useEffect, useMemo, useCallback, useState } from 'react'
import { useUserStore } from '@/store/user'
import { useActivities, weeklyMileageKm, last7DaysMileageKm, activitiesWithDatesCount, clearDistanceCache } from '@/store/activities'
import { useProgress } from '@/store/progress'
import { predictMarathonTime } from '@/utils/predict'
import { getTodaysWorkout, DailyWorkout, riskAssessment } from '@/utils/coach/advice'
import { 
  CalendarDaysIcon, 
  ChartBarIcon, 
  CheckCircleIcon,
  PencilIcon,
  UserIcon,
  HeartIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  PlayCircleIcon,
  ClockIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import { Card, CardContent, MetricCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundary'
import PRDashboard from '@/components/PRDashboard'

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

// Weekly Progress Bar Component
const WeeklyProgressSection = React.memo(function WeeklyProgressSection({
  currentKm,
  targetKm,
  weekDays
}: {
  currentKm: number
  targetKm: number
  weekDays: Array<{ day: string; distance: number; planned: boolean }>
}) {
  const progressPercent = Math.min(100, (currentKm / targetKm) * 100)
  const remainingKm = Math.max(0, targetKm - currentKm)
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDaysIcon className="w-5 h-5" />
          This Week&apos;s Progress
        </h2>
        <span className="text-sm text-gray-500">
          {remainingKm.toFixed(1)}km remaining
        </span>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Weekly Target: {targetKm}km</span>
          <span className="text-sm font-bold">{currentKm.toFixed(1)}km / {targetKm}km</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0km</span>
          <span>{Math.round(progressPercent)}%</span>
          <span>{targetKm}km</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => (
          <div key={index} className="text-center">
            <div className="text-xs font-medium mb-1 text-gray-500">{day.day}</div>
            <div className={`h-8 rounded flex items-center justify-center text-xs font-medium ${
              day.distance > 0 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : day.planned
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}>
              {day.distance > 0 ? `${day.distance.toFixed(1)}` : day.planned ? 'Plan' : 'Rest'}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
})

// Enhanced Today's Workout Section
const TodaysWorkoutSection = React.memo(function TodaysWorkoutSection({ 
  workout, 
  onCompleteWorkout, 
  onModifyPlan,
  heartRateZones
}: { 
  workout: DailyWorkout
  onCompleteWorkout: () => void
  onModifyPlan: () => void 
  heartRateZones?: { zone2: [number, number], zone4: [number, number], zone5: [number, number] }
}) {
  const hasIntervals = workout.type === 'Intervals' || workout.distance.includes('x')
  
  return (
    <Card className="p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <PlayCircleIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Today&apos;s Workout</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-3xl font-bold mb-2">
              {workout.type}
            </h3>
            <div className="flex items-center gap-4 text-lg">
              <span className="flex items-center gap-1">
                <MapPinIcon className="w-4 h-4" />
                {workout.distance}
              </span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                {workout.pace}
              </span>
            </div>
          </div>
          
          {hasIntervals && (
            <div className="bg-white/60 dark:bg-black/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-gray-600 dark:text-gray-400">Workout Structure</h4>
              <div className="space-y-2 text-sm">
                <div>• 10min easy warm-up</div>
                <div>• {workout.distance}</div>
                <div>• 90sec easy recovery between reps</div>
                <div>• 10min easy cool-down</div>
              </div>
            </div>
          )}
          
          {heartRateZones && (
            <div className="bg-white/60 dark:bg-black/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-gray-600 dark:text-gray-400">Target Heart Rate</h4>
              <div className="flex items-center gap-4 text-sm">
                {workout.type === 'Easy Run' && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-green-800 dark:text-green-300">
                    Zone 2: {heartRateZones.zone2[0]}-{heartRateZones.zone2[1]} bpm
                  </span>
                )}
                {workout.type === 'Tempo Run' && (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded text-yellow-800 dark:text-yellow-300">
                    Zone 4: {heartRateZones.zone4[0]}-{heartRateZones.zone4[1]} bpm
                  </span>
                )}
                {workout.type === 'Intervals' && (
                  <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-red-800 dark:text-red-300">
                    Zone 5: {heartRateZones.zone5[0]}-{heartRateZones.zone5[1]} bpm
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="bg-white/60 dark:bg-black/20 rounded-lg p-4">
            <h4 className="font-semibold mb-2 text-sm uppercase tracking-wide text-gray-600 dark:text-gray-400">Coach&apos;s Notes</h4>
            <p className="text-sm leading-relaxed">
              {workout.reasoning}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={onCompleteWorkout}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium flex-1"
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
              Modify
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
})

// This Week Overview Section
const WeekOverviewSection = React.memo(function WeekOverviewSection({
  weeklyPlan
}: {
  weeklyPlan: Array<{ day: string; workout?: string; distance?: string; completed: boolean }>
}) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <CalendarDaysIcon className="w-5 h-5" />
        This Week&apos;s Training Plan
      </h2>
      
      <div className="space-y-3">
        {weeklyPlan.map((day, index) => (
          <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
            day.completed ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
            day.workout ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
            'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                day.completed ? 'bg-green-500 text-white' :
                day.workout ? 'bg-blue-500 text-white' :
                'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
              }`}>
                {day.completed ? <CheckCircleIcon className="w-4 h-4" /> : day.day.slice(0, 1)}
              </div>
              <div>
                <div className="font-medium">{day.day}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {day.workout || 'Rest Day'}
                </div>
              </div>
            </div>
            {day.distance && (
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {day.distance}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
})

// Race Readiness Assessment
const RaceReadinessSection = React.memo(function RaceReadinessSection({
  raceReadiness,
  daysToRace
}: {
  raceReadiness: {
    overall: number
    components: {
      aerobicBase: number
      lactateThreshold: number
      neuromuscularPower: number
      strengthMobility: number
      mentalPreparation: number
    }
  }
  daysToRace?: number
}) {
  const components = [
    { key: 'aerobicBase', label: 'Aerobic Base', score: raceReadiness.components.aerobicBase, color: 'bg-blue-500' },
    { key: 'lactateThreshold', label: 'Lactate Threshold', score: raceReadiness.components.lactateThreshold, color: 'bg-green-500' },
    { key: 'neuromuscularPower', label: 'Speed & Power', score: raceReadiness.components.neuromuscularPower, color: 'bg-yellow-500' },
    { key: 'strengthMobility', label: 'Strength & Mobility', score: raceReadiness.components.strengthMobility, color: 'bg-orange-500' },
    { key: 'mentalPreparation', label: 'Mental Prep', score: raceReadiness.components.mentalPreparation, color: 'bg-purple-500' }
  ]
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrophyIcon className="w-5 h-5" />
          Race Readiness
        </h2>
        {daysToRace && (
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{daysToRace}</div>
            <div className="text-xs text-gray-500">days to race</div>
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-semibold">Overall Readiness</span>
          <span className="text-2xl font-bold">{raceReadiness.overall}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
          <div 
            className={`h-4 rounded-full transition-all duration-500 ${
              raceReadiness.overall >= 80 ? 'bg-green-500' :
              raceReadiness.overall >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${raceReadiness.overall}%` }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {components.map((component) => (
          <div key={component.key} className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-2">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - component.score / 100)}`}
                  className={component.color.replace('bg-', 'text-')}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {component.score}
              </div>
            </div>
            <div className="text-xs font-medium">{component.label}</div>
          </div>
        ))}
      </div>
    </Card>
  )
})

// Heart Rate Zones Section
const HeartRateZonesSection = React.memo(function HeartRateZonesSection({
  user,
  zones
}: {
  user: { restingHeartRate?: number; dateOfBirth?: string; maxHeartRate?: number } | null
  zones?: Array<{ zone: number, name: string, bpm: [number, number], color: string }>
}) {
  if (!user?.restingHeartRate || !user?.dateOfBirth) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <HeartIcon className="w-5 h-5" />
          Your Heart Rate Zones
        </h2>
        <div className="text-center py-8 text-gray-500">
          <p>Set your age and resting heart rate in settings to see your training zones</p>
          <a href="/setup" className="text-blue-600 hover:underline font-medium mt-2 inline-block">
            Update Profile
          </a>
        </div>
      </Card>
    )
  }
  
  const age = new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
  const maxHR = user.maxHeartRate || Math.round(208 - (0.7 * age))
  const restingHR = user.restingHeartRate
  
  const calculatedZones = zones || [
    { zone: 1, name: 'Recovery', bpm: [restingHR + Math.round((maxHR - restingHR) * 0.50), restingHR + Math.round((maxHR - restingHR) * 0.60)], color: 'bg-blue-500' },
    { zone: 2, name: 'Aerobic Base', bpm: [restingHR + Math.round((maxHR - restingHR) * 0.60), restingHR + Math.round((maxHR - restingHR) * 0.70)], color: 'bg-green-500' },
    { zone: 3, name: 'Aerobic', bpm: [restingHR + Math.round((maxHR - restingHR) * 0.70), restingHR + Math.round((maxHR - restingHR) * 0.80)], color: 'bg-yellow-500' },
    { zone: 4, name: 'Threshold', bpm: [restingHR + Math.round((maxHR - restingHR) * 0.80), restingHR + Math.round((maxHR - restingHR) * 0.90)], color: 'bg-orange-500' },
    { zone: 5, name: 'VO2 Max', bpm: [restingHR + Math.round((maxHR - restingHR) * 0.90), maxHR], color: 'bg-red-500' }
  ]
  
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <HeartIcon className="w-5 h-5" />
          Your Heart Rate Zones
        </h2>
        <div className="text-sm text-gray-500">
          Max HR: {maxHR} | Rest: {restingHR} bpm
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {calculatedZones.map((zone) => (
          <div key={zone.zone} className="text-center">
            <div className={`w-12 h-12 rounded-full ${zone.color} flex items-center justify-center text-white text-lg font-bold mx-auto mb-2`}>
              {zone.zone}
            </div>
            <div className="text-sm font-medium mb-1">{zone.name}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {zone.bpm[0]}-{zone.bpm[1]} bpm
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Zones calculated using Heart Rate Reserve method. Zone 2 is your primary training zone for aerobic development.
        </p>
      </div>
    </Card>
  )
})

// Quick Stats Comparison Section
const QuickStatsSection = React.memo(function QuickStatsSection({
  thisWeekKm,
  lastWeekKm,
  avgPace,
  lastWeekAvgPace,
  injuryRisk,
  personalBests
}: {
  thisWeekKm: number
  lastWeekKm: number
  avgPace: number
  lastWeekAvgPace: number
  injuryRisk: string
  personalBests: Array<{ distance: string, time: string, date: string }>
}) {
  const distanceChange = thisWeekKm - lastWeekKm
  const paceImprovement = lastWeekAvgPace - avgPace // negative means slower
  
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ArrowTrendingUpIcon className="w-5 h-5" />
        Performance Overview
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Distance vs Last Week"
          value={`${distanceChange >= 0 ? '+' : ''}${distanceChange.toFixed(1)}km`}
          icon={distanceChange >= 0 ? 
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" /> : 
            <ChartBarIcon className="w-4 h-4 text-red-600" />
          }
          trend={distanceChange >= 0 ? 'positive' : 'negative'}
        />
        
        <MetricCard
          title="Pace Trend"
          value={paceImprovement > 0 ? `${Math.abs(paceImprovement).toFixed(0)}s faster` : paceImprovement < 0 ? `${Math.abs(paceImprovement).toFixed(0)}s slower` : 'Same pace'}
          icon={<ClockIcon className="w-4 h-4" />}
          trend={paceImprovement > 0 ? 'positive' : paceImprovement < 0 ? 'negative' : 'neutral'}
        />
        
        <MetricCard
          title="Injury Risk"
          value={injuryRisk === 'low' ? 'Low' : injuryRisk === 'moderate' ? 'Moderate' : 'High'}
          icon={injuryRisk === 'high' ? 
            <ExclamationTriangleIcon className="w-4 h-4 text-red-600" /> :
            <HeartIcon className="w-4 h-4 text-green-600" />
          }
          trend={injuryRisk === 'low' ? 'positive' : injuryRisk === 'high' ? 'negative' : 'neutral'}
        />
        
        <MetricCard
          title="Personal Records"
          value={`${personalBests.length} PRs`}
          icon={<TrophyIcon className="w-4 h-4 text-yellow-600" />}
          trend="positive"
        />
      </div>
      
      {personalBests.length > 0 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-1">
            <TrophyIcon className="w-4 h-4" />
            Recent Personal Bests
          </h3>
          <div className="space-y-1 text-xs">
            {personalBests.slice(0, 3).map((pb, index) => (
              <div key={index} className="flex justify-between">
                <span>{pb.distance}: {pb.time}</span>
                <span className="opacity-70">{pb.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
})

// Helper functions for dashboard calculations
function generateWeekDays(activities: { date?: string; distance?: number }[]): Array<{ day: string; distance: number; planned: boolean }> {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const mondayOfWeek = new Date(today)
  mondayOfWeek.setDate(today.getDate() - today.getDay() + 1) // Get Monday of current week
  
  return days.map((day, index) => {
    const dayDate = new Date(mondayOfWeek)
    dayDate.setDate(mondayOfWeek.getDate() + index)
    
    const dayActivities = activities.filter(activity => {
      if (!activity.date) return false
      const activityDate = new Date(activity.date)
      return activityDate.toDateString() === dayDate.toDateString()
    })
    
    const totalDistance = dayActivities.reduce((sum, activity) => sum + (activity.distance || 0), 0) / 1000
    
    return {
      day,
      distance: totalDistance,
      planned: totalDistance === 0 && dayDate > today // Future days without activities are "planned"
    }
  })
}

function generateWeeklyPlan(): Array<{ day: string; workout?: string; distance?: string; completed: boolean }> {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const workouts = [
    { workout: 'Easy Run', distance: '8K' },
    { workout: 'Intervals', distance: '10K total' },
    { workout: 'Easy Run', distance: '6K' },
    { workout: 'Tempo Run', distance: '10K' },
    { workout: 'Easy Run', distance: '5K' },
    { workout: 'Easy Run', distance: '8K' },
    { workout: 'Long Run', distance: '18K' }
  ]
  
  const today = new Date().getDay() // 0 = Sunday, 1 = Monday, etc.
  
  return days.map((day, index) => ({
    day,
    workout: workouts[index]?.workout,
    distance: workouts[index]?.distance,
    completed: index < (today === 0 ? 6 : today - 1) // Mark past days as completed
  }))
}

function calculateRaceReadiness(activities: { distance?: number; avgHr?: number; maxHr?: number }[], _user: { level?: string }): {
  overall: number
  components: {
    aerobicBase: number
    lactateThreshold: number
    neuromuscularPower: number
    strengthMobility: number
    mentalPreparation: number
  }
} {
  // Mock calculation - in real app this would analyze training data
  const weeklyKm = activities.slice(-7).reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  const hasLongRuns = activities.some(a => (a.distance || 0) > 15000)
  const hasSpeedWork = activities.some(a => a.avgHr && a.maxHr && a.avgHr > (a.maxHr * 0.85))
  
  return {
    overall: Math.min(95, 40 + (weeklyKm * 2) + (hasLongRuns ? 20 : 0) + (hasSpeedWork ? 15 : 0)),
    components: {
      aerobicBase: Math.min(100, 50 + (weeklyKm * 2)),
      lactateThreshold: hasSpeedWork ? 85 : 65,
      neuromuscularPower: hasSpeedWork ? 80 : 60,
      strengthMobility: 75,
      mentalPreparation: hasLongRuns ? 90 : 70
    }
  }
}

function calculateHeartRateZones(user: { restingHeartRate?: number; dateOfBirth?: string; maxHeartRate?: number } | null) {
  if (!user?.restingHeartRate || !user?.dateOfBirth) return undefined
  
  const age = new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
  const maxHR = user.maxHeartRate || Math.round(208 - (0.7 * age))
  const restingHR = user.restingHeartRate
  const hrReserve = maxHR - restingHR
  
  return {
    zone2: [restingHR + Math.round(hrReserve * 0.60), restingHR + Math.round(hrReserve * 0.70)],
    zone4: [restingHR + Math.round(hrReserve * 0.80), restingHR + Math.round(hrReserve * 0.90)],
    zone5: [restingHR + Math.round(hrReserve * 0.90), maxHR]
  }
}

// Enhanced dashboard data interface - moved inline to avoid unused interface warning

function useUnifiedDashboardData() {
  const user = useUserStore((s) => s.user)
  const hydrateUser = useUserStore((s) => s.hydrate)
  const activities = useActivities((s) => s.list.slice(-100)) // More activities for better analysis
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
        lastWeekKm: 0,
        pred: { seconds: 0, ci: 0 },
        workoutsLogged: 0,
        isLoading: true,
        avgPace: 0,
        lastWeekAvgPace: 0,
        personalBests: [],
        raceReadiness: { overall: 0, components: { aerobicBase: 0, lactateThreshold: 0, neuromuscularPower: 0, strengthMobility: 0, mentalPreparation: 0 }},
        heartRateZones: undefined,
        weekDays: [],
        weeklyPlan: [],
        injuryRisk: 'low'
      }
    }

    try {
      const weekly = weeklyMileageKm(activities)
      const thisWeekKm = last7DaysMileageKm(activities)
      const lastWeekKm = activities.slice(-14, -7).reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
      const pred = predictMarathonTime(activities, user || undefined)
      const workoutsLogged = activitiesWithDatesCount(activities)
      
      // Calculate average paces
      const thisWeekActivities = activities.slice(-7).filter(a => a.avgPace && a.avgPace > 0)
      const lastWeekActivities = activities.slice(-14, -7).filter(a => a.avgPace && a.avgPace > 0)
      
      const avgPace = thisWeekActivities.length > 0 
        ? thisWeekActivities.reduce((sum, a) => sum + (a.avgPace || 0), 0) / thisWeekActivities.length
        : 0
      
      const lastWeekAvgPace = lastWeekActivities.length > 0
        ? lastWeekActivities.reduce((sum, a) => sum + (a.avgPace || 0), 0) / lastWeekActivities.length
        : 0

      // Calculate personal bests (mock data for now)
      const personalBests = [
        { distance: '5K', time: '22:30', date: '2024-08-15' },
        { distance: '10K', time: '46:45', date: '2024-08-20' },
        { distance: 'Half', time: '1:42:15', date: '2024-08-25' }
      ]

      const raceReadiness = calculateRaceReadiness(activities, user)
      const heartRateZones = calculateHeartRateZones(user)
      const weekDays = generateWeekDays(activities)
      const weeklyPlan = generateWeeklyPlan()
      
      // Assess injury risk using existing function
      const load7 = thisWeekKm
      const load28 = weekly.slice(-4).reduce((s, x) => s + x.km, 0)
      const riskResult = riskAssessment(load7, load28)
      const injuryRisk = riskResult.includes('Elevated') ? 'high' : riskResult.includes('low') ? 'moderate' : 'low'
      
      return {
        weekly,
        thisWeekKm,
        lastWeekKm,
        pred,
        workoutsLogged,
        isLoading: false,
        avgPace,
        lastWeekAvgPace,
        personalBests,
        raceReadiness,
        heartRateZones,
        weekDays,
        weeklyPlan,
        injuryRisk
      }
    } catch (error) {
      console.warn('Dashboard calculation error:', error)
      return {
        weekly: [],
        thisWeekKm: 0,
        lastWeekKm: 0,
        pred: { seconds: 0, ci: 0 },
        workoutsLogged: 0,
        isLoading: false,
        avgPace: 0,
        lastWeekAvgPace: 0,
        personalBests: [],
        raceReadiness: { overall: 0, components: { aerobicBase: 0, lactateThreshold: 0, neuromuscularPower: 0, strengthMobility: 0, mentalPreparation: 0 }},
        heartRateZones: undefined,
        weekDays: [],
        weeklyPlan: [],
        injuryRisk: 'low'
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
  const { 
    user, 
    daysToRace, 
    todaysWorkout, 
    thisWeekKm, 
    lastWeekKm,
    avgPace,
    lastWeekAvgPace,
    personalBests,
    raceReadiness,
    heartRateZones,
    weekDays,
    weeklyPlan,
    injuryRisk 
  } = useUnifiedDashboardData()
  
  const acts = useActivities(useCallback((s) => ({ 
    refreshFromIntervalsIcu: s.refreshFromIntervalsIcu, 
    error: s.error, 
    isLoading: s.isLoading 
  }), []))

  const refreshActivities = useCallback(async () => {
    console.log('Refreshing activities from intervals.icu...')
    clearDistanceCache()
    await acts.refreshFromIntervalsIcu()
  }, [acts])

  const handleCompleteWorkout = useCallback(() => {
    if (confirm('Great job! Mark this workout as complete in intervals.icu?')) {
      window.open('https://intervals.icu', '_blank')
    }
  }, [])

  const handleModifyPlan = useCallback(() => {
    window.location.href = '/setup'
  }, [])

  // Calculate target weekly mileage based on training phase
  const targetWeeklyKm = useMemo(() => {
    if (!user?.level) return 40
    const baseTargets = { beginner: 30, intermediate: 50, advanced: 70 }
    return baseTargets[user.level] || 40
  }, [user?.level])

  const isNewUser = !user || (!user.raceDate && thisWeekKm === 0)

  if (isNewUser && user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <WelcomeMessage userName={user.name} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Marathon Coach Dashboard</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Welcome back, {user?.name}!</p>
          
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
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 max-w-4xl mx-auto">
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

        {/* 1. Weekly Progress */}
        <ErrorBoundaryWrapper componentName="WeeklyProgressSection">
          <WeeklyProgressSection 
            currentKm={thisWeekKm}
            targetKm={targetWeeklyKm}
            weekDays={weekDays}
          />
        </ErrorBoundaryWrapper>

        {/* 2. Today's Workout */}
        <ErrorBoundaryWrapper componentName="TodaysWorkoutSection">
          <TodaysWorkoutSection 
            workout={todaysWorkout}
            onCompleteWorkout={handleCompleteWorkout}
            onModifyPlan={handleModifyPlan}
            heartRateZones={heartRateZones}
          />
        </ErrorBoundaryWrapper>

        {/* 3. This Week Overview */}
        <ErrorBoundaryWrapper componentName="WeekOverviewSection">
          <WeekOverviewSection weeklyPlan={weeklyPlan} />
        </ErrorBoundaryWrapper>

        {/* 4. Race Readiness */}
        <ErrorBoundaryWrapper componentName="RaceReadinessSection">
          <RaceReadinessSection 
            raceReadiness={raceReadiness}
            daysToRace={daysToRace}
          />
        </ErrorBoundaryWrapper>

        {/* 5. Heart Rate Zones */}
        <ErrorBoundaryWrapper componentName="HeartRateZonesSection">
          <HeartRateZonesSection user={user} />
        </ErrorBoundaryWrapper>

        {/* 6. Personal Records Dashboard */}
        <ErrorBoundaryWrapper componentName="PRDashboard">
          <PRDashboard />
        </ErrorBoundaryWrapper>

        {/* 7. Performance Overview */}
        <ErrorBoundaryWrapper componentName="QuickStatsSection">
          <QuickStatsSection 
            thisWeekKm={thisWeekKm}
            lastWeekKm={lastWeekKm}
            avgPace={avgPace}
            lastWeekAvgPace={lastWeekAvgPace}
            injuryRisk={injuryRisk}
            personalBests={personalBests}
          />
        </ErrorBoundaryWrapper>
      </div>
    </div>
  )
}