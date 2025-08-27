import { NextRequest, NextResponse } from 'next/server'
import { getIntervalsIcuClient } from '@/lib/intervalsIcu'
import { transformIntervalsActivities, deduplicateActivities, filterRunningActivities } from '@/utils/intervalsTransform'
import { calculateCoachingMetrics } from '@/utils/coaching/metrics'
import { generateTodaysWorkout } from '@/utils/coaching/workoutGenerator'
import { assessRaceReadiness } from '@/utils/coaching/raceReadiness'
import { assessInjuryRisk } from '@/utils/coaching/injuryRisk'
import { calculateTrainingStressBalance } from '@/utils/coaching/trainingStress'
import { findPersonalRecords } from '@/utils/coaching/personalRecords'
import { predictMarathonTime } from '@/utils/predict'
import type { DashboardMetrics, SimpleActivity, User } from '@/types'

/**
 * Unified Marathon Coaching Dashboard API
 * Consolidates all coaching intelligence into a single response
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 Fetching unified coaching dashboard data...')
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Fetch latest activities from intervals.icu
    const client = getIntervalsIcuClient()
    const intervalsActivities = await client.getActivities(100) // Last 100 activities
    
    let activities = transformIntervalsActivities(intervalsActivities)
    activities = deduplicateActivities(activities)
    activities = filterRunningActivities(activities)
    
    // Sort by date (newest first)
    activities.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateB - dateA
    })

    console.log(`📊 Processing ${activities.length} running activities`)

    // For demo purposes, create a mock user profile
    // In production, this would come from your user store
    const mockUser: User = {
      id: userId,
      name: 'Marathon Runner',
      level: 'intermediate',
      trainingFocus: ['endurance', 'speed'],
      maxHeartRate: 184,
      restingHeartRate: 52,
      weight: 70,
      height: 175,
      raceDate: '2024-04-21', // Boston Marathon
      goalTime: '03:15:00',
      preferences: {
        units: 'metric',
        theme: 'auto',
        notifications: {
          workoutReminders: true,
          achievementAlerts: true,
          weeklyReports: true
        },
        privacy: {
          shareProgress: false,
          publicProfile: false
        }
      },
      stats: {
        totalDistance: 0,
        totalWorkouts: 0,
        totalDuration: 0,
        averagePace: 0,
        currentStreak: 0,
        longestStreak: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Calculate all coaching metrics
    console.log('📈 Calculating comprehensive coaching metrics...')
    
    const [
      weeklyMileage,
      personalRecords,
      raceReadiness,
      injuryRisk,
      trainingStress,
      todaysWorkout,
      marathonPrediction
    ] = await Promise.all([
      calculateWeeklyMileage(activities),
      findPersonalRecords(activities),
      assessRaceReadiness(activities, mockUser),
      assessInjuryRisk(activities, mockUser),
      calculateTrainingStressBalance(activities, mockUser),
      generateTodaysWorkout(activities, mockUser),
      enhanceMarathonPrediction(activities, mockUser)
    ])

    // Create weekly plan (simplified for now)
    const weeklyPlan = await generateWeeklyPlan(activities, mockUser, todaysWorkout)

    const dashboardMetrics: DashboardMetrics = {
      weeklyMileage,
      personalRecords,
      raceReadiness,
      injuryRisk,
      trainingStress,
      todaysWorkout,
      weeklyPlan,
      recentFeedback: [], // Would be populated from completed workouts
      marathonPrediction
    }

    console.log('✅ Dashboard metrics calculated successfully')
    
    return NextResponse.json({
      success: true,
      data: dashboardMetrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Failed to generate coaching dashboard:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Helper functions

async function calculateWeeklyMileage(activities: SimpleActivity[]) {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const currentWeekActivities = activities.filter(a => 
    new Date(a.date || '') >= oneWeekAgo
  )
  const previousWeekActivities = activities.filter(a => {
    const date = new Date(a.date || '')
    return date >= twoWeeksAgo && date < oneWeekAgo
  })

  const current = currentWeekActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
  const previous = previousWeekActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
  
  const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0
  const trend = percentChange > 5 ? 'increasing' : percentChange < -5 ? 'decreasing' : 'stable'

  // Target based on user level and race proximity
  const target = 60 // km per week for intermediate level

  return {
    current: Math.round(current * 10) / 10,
    previous: Math.round(previous * 10) / 10,
    percentChange: Math.round(percentChange * 10) / 10,
    trend,
    target
  }
}

async function enhanceMarathonPrediction(activities: SimpleActivity[], user: User) {
  const prediction = predictMarathonTime(activities, user)
  
  // Parse goal time to seconds
  const goalTimeSeconds = user.goalTime ? 
    parseTimeToSeconds(user.goalTime) : null

  const onTrack = goalTimeSeconds ? 
    prediction.seconds <= goalTimeSeconds * 1.05 : true // within 5% of goal

  const timeToTarget = user.raceDate ? 
    Math.ceil((new Date(user.raceDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null

  return {
    ...prediction,
    targetTime: goalTimeSeconds,
    onTrack,
    timeToTarget
  }
}

async function generateWeeklyPlan(
  activities: SimpleActivity[], 
  user: User, 
  todaysWorkout: any
) {
  const monday = getStartOfWeek(new Date())
  
  return {
    week: monday.toISOString(),
    phase: 'build' as const,
    targetMileage: 60,
    workouts: [todaysWorkout],
    focusAreas: ['aerobic base', 'tempo development'],
    keyWorkout: todaysWorkout.id
  }
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}

function parseTimeToSeconds(timeString: string): number {
  const parts = timeString.split(':').map(Number)
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0)
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}