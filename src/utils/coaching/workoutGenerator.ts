import type { SimpleActivity, User, WorkoutRecommendation, WorkoutType } from '@/types'
import { calculatePersonalizedTrainingPaces } from '@/utils/predict'
import { formatHMS } from '@/utils/predict'

/**
 * Intelligent Workout Generation System
 * Generates today's workout based on training history, fatigue, and periodization
 */

interface WorkoutContext {
  recentTrainingLoad: number
  daysSinceLastHard: number
  weeklyMileage: number
  longestRecentRun: number
  isRecoveryNeeded: boolean
  phase: 'base' | 'build' | 'peak' | 'taper'
  daysToRace: number
}

export async function generateTodaysWorkout(
  activities: SimpleActivity[],
  user: User
): Promise<WorkoutRecommendation> {
  console.log('🏃‍♂️ Generating today\'s workout recommendation...')
  
  const context = analyzeTrainingContext(activities, user)
  const paces = calculatePersonalizedTrainingPaces(activities, user)
  
  console.log('Training context:', context)
  console.log('Training paces:', paces)

  // Determine workout type based on context
  const workoutType = selectWorkoutType(context, activities)
  
  // Generate specific workout
  const workout = generateWorkout(workoutType, context, paces, user)
  
  console.log(`Generated ${workoutType} workout: ${workout.title}`)
  
  return workout
}

function analyzeTrainingContext(activities: SimpleActivity[], user: User): WorkoutContext {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  
  const recentActivities = activities.filter(a => 
    new Date(a.date || '') >= sevenDaysAgo
  ).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())

  const lastTwoWeeks = activities.filter(a => 
    new Date(a.date || '') >= fourteenDaysAgo
  )

  // Calculate training load (simplified TSS-like metric)
  const recentTrainingLoad = recentActivities.reduce((load, activity) => {
    const distance = (activity.distance || 0) / 1000
    const intensity = estimateIntensityFromPace(activity)
    return load + (distance * intensity)
  }, 0)

  // Find days since last hard workout
  let daysSinceLastHard = 7
  for (let i = 0; i < recentActivities.length; i++) {
    const activity = recentActivities[i]
    if (isHardWorkout(activity)) {
      daysSinceLastHard = Math.floor((now.getTime() - new Date(activity.date || '').getTime()) / (24 * 60 * 60 * 1000))
      break
    }
  }

  const weeklyMileage = recentActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
  const longestRecentRun = Math.max(...lastTwoWeeks.map(a => (a.distance || 0) / 1000))

  // Recovery assessment
  const isRecoveryNeeded = recentTrainingLoad > weeklyMileage * 1.5 || daysSinceLastHard <= 1

  // Training phase based on race date
  const daysToRace = user.raceDate ? 
    Math.ceil((new Date(user.raceDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 120

  let phase: 'base' | 'build' | 'peak' | 'taper'
  if (daysToRace > 84) phase = 'base'
  else if (daysToRace > 21) phase = 'build'
  else if (daysToRace > 7) phase = 'peak'
  else phase = 'taper'

  return {
    recentTrainingLoad,
    daysSinceLastHard,
    weeklyMileage,
    longestRecentRun,
    isRecoveryNeeded,
    phase,
    daysToRace
  }
}

function selectWorkoutType(context: WorkoutContext, activities: SimpleActivity[]): WorkoutType {
  const { daysSinceLastHard, isRecoveryNeeded, phase, daysToRace } = context
  
  // Recovery always takes priority
  if (isRecoveryNeeded) return 'recovery'
  
  // Taper phase logic
  if (phase === 'taper') {
    if (daysToRace <= 3) return 'recovery'
    if (daysToRace <= 7) return 'easy'
    return daysSinceLastHard >= 3 ? 'tempo' : 'easy'
  }

  // Regular training phases
  const dayOfWeek = new Date().getDay()
  
  // Tuesday/Thursday are typically workout days
  if ([2, 4].includes(dayOfWeek) && daysSinceLastHard >= 2) {
    if (phase === 'base') return Math.random() > 0.5 ? 'tempo' : 'easy'
    if (phase === 'build') return Math.random() > 0.3 ? 'interval' : 'tempo'
    if (phase === 'peak') return 'interval'
  }
  
  // Saturday/Sunday for long runs
  if ([6, 0].includes(dayOfWeek)) {
    return context.longestRecentRun < 20 ? 'long' : 'easy'
  }
  
  // Default to easy
  return 'easy'
}

function generateWorkout(
  type: WorkoutType, 
  context: WorkoutContext, 
  paces: any,
  user: User
): WorkoutRecommendation {
  const workoutId = `workout-${Date.now()}`
  const today = new Date().toISOString().split('T')[0]

  const baseWorkout = {
    id: workoutId,
    date: today,
    type,
    paceGuidance: {
      easy: paces?.easy ? formatPace(paces.easy) : '6:00-6:30/km',
      marathon: paces?.marathon ? formatPace(paces.marathon) : '5:45/km',
      tempo: paces?.tempo ? formatPace(paces.tempo) : '5:20/km',
      interval: paces?.interval ? formatPace(paces.interval) : '4:50/km'
    },
    heartRateGuidance: calculateHRZones(user)
  }

  switch (type) {
    case 'easy':
      return {
        ...baseWorkout,
        title: 'Easy Recovery Run',
        description: 'Comfortable aerobic pace to build base fitness and promote recovery',
        targetDistance: Math.min(8000, context.weeklyMileage * 100), // 6-8km typical
        reasoning: context.isRecoveryNeeded 
          ? 'Recovery needed after recent training load'
          : 'Building aerobic base with comfortable effort',
        priority: 'recommended' as const
      }

    case 'tempo':
      const tempoDistance = context.phase === 'build' ? 6000 : 4000
      return {
        ...baseWorkout,
        title: 'Tempo Run',
        description: 'Sustained effort at lactate threshold pace',
        targetDistance: 10000 + tempoDistance, // including warmup/cooldown
        intervals: {
          warmup: { distance: 2000, pace: baseWorkout.paceGuidance.easy! },
          mainSet: [{
            repetitions: 1,
            distance: tempoDistance,
            pace: baseWorkout.paceGuidance.tempo!,
            recovery: { duration: 0, type: 'rest' as const }
          }],
          cooldown: { distance: 2000, pace: baseWorkout.paceGuidance.easy! }
        },
        reasoning: 'Developing lactate threshold and race pace fitness',
        priority: 'essential' as const
      }

    case 'interval':
      return {
        ...baseWorkout,
        title: '5K Intervals',
        description: 'High-intensity intervals to develop VO2max and speed',
        targetDistance: 8000,
        intervals: {
          warmup: { distance: 2000, pace: baseWorkout.paceGuidance.easy! },
          mainSet: [{
            repetitions: 5,
            distance: 1000,
            pace: baseWorkout.paceGuidance.interval!,
            recovery: { duration: 180, type: 'active' as const }
          }],
          cooldown: { distance: 1000, pace: baseWorkout.paceGuidance.easy! }
        },
        reasoning: 'Building speed and neuromuscular power for race finishing kick',
        priority: 'essential' as const
      }

    case 'long':
      const longDistance = Math.min(32000, context.longestRecentRun * 1000 + 3000)
      return {
        ...baseWorkout,
        title: 'Long Run',
        description: 'Steady aerobic effort to build endurance and mental toughness',
        targetDistance: longDistance,
        reasoning: 'Building aerobic capacity and marathon-specific endurance',
        priority: 'essential' as const
      }

    case 'recovery':
      return {
        ...baseWorkout,
        title: 'Active Recovery',
        description: 'Very easy pace for active recovery and blood flow',
        targetDistance: 5000,
        targetDuration: 35,
        reasoning: 'Promoting recovery while maintaining running rhythm',
        priority: 'recommended' as const
      }

    default:
      return generateWorkout('easy', context, paces, user)
  }
}

// Helper functions

function estimateIntensityFromPace(activity: SimpleActivity): number {
  const pacePerKm = activity.duration! / (activity.distance! / 1000) / 60 // min/km
  
  // Rough intensity mapping based on pace
  if (pacePerKm < 5.0) return 4.0 // Very hard
  if (pacePerKm < 5.5) return 3.0 // Hard
  if (pacePerKm < 6.0) return 2.0 // Moderate
  if (pacePerKm < 7.0) return 1.5 // Easy-moderate
  return 1.0 // Easy
}

function isHardWorkout(activity: SimpleActivity): boolean {
  if (!activity.avgHr || !activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000) / 60
  const distance = activity.distance / 1000
  
  // Consider it hard if:
  // 1. Pace is fast (< 5:30/km) OR
  // 2. It's a medium distance (5-15km) with decent pace (< 6:00/km) OR
  // 3. HR suggests hard effort (> 80% max, approximated)
  return pacePerKm < 5.5 || 
         (distance >= 5 && distance <= 15 && pacePerKm < 6.0) ||
         (activity.avgHr && activity.avgHr > 150) // rough estimate
}

function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = Math.round(paceSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

function calculateHRZones(user: User) {
  if (!user.maxHeartRate) return undefined
  
  const maxHR = user.maxHeartRate
  const restingHR = user.restingHeartRate || 60
  
  // Using Karvonen method for more personalized zones
  const hrr = maxHR - restingHR // Heart Rate Reserve
  
  return {
    zone1: [restingHR + Math.round(hrr * 0.50), restingHR + Math.round(hrr * 0.60)] as [number, number],
    zone2: [restingHR + Math.round(hrr * 0.60), restingHR + Math.round(hrr * 0.70)] as [number, number],
    zone3: [restingHR + Math.round(hrr * 0.70), restingHR + Math.round(hrr * 0.80)] as [number, number],
    zone4: [restingHR + Math.round(hrr * 0.80), restingHR + Math.round(hrr * 0.90)] as [number, number],
    zone5: [restingHR + Math.round(hrr * 0.90), maxHR] as [number, number]
  }
}