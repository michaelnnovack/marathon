import type { SimpleActivity, User } from '@/types'

/**
 * Helper functions for mental preparation assessment
 */

// Training adherence estimation
export function estimateTrainingAdherence(activities: SimpleActivity[]): number {
  const weeklyData = calculateWeeklyTrainingData(activities, 12)
  
  if (weeklyData.length === 0) return 0
  
  // Target: 4 runs per week, 50km per week
  const targetRuns = 4
  const targetDistance = 50
  
  let adherenceScore = 0
  let validWeeks = 0
  
  weeklyData.forEach(week => {
    if (week.distance > 0) {
      validWeeks++
      
      // Run frequency adherence (70%)
      const runScore = Math.min(1, week.activities / targetRuns)
      
      // Volume adherence (30%)
      const volumeScore = Math.min(1, week.distance / targetDistance)
      
      adherenceScore += runScore * 0.7 + volumeScore * 0.3
    }
  })
  
  return validWeeks > 0 ? adherenceScore / validWeeks : 0
}

// Workout completion estimation
export function estimateWorkoutCompletion(activities: SimpleActivity[], user: User): number {
  const qualityWorkouts = activities.filter(a => 
    isTempoEffort(a, user) || isSpeedWork(a, user) || (a.distance || 0) >= 15000
  )
  
  if (qualityWorkouts.length === 0) return 0.5 // Default if no quality workouts
  
  let completionScore = 0
  
  qualityWorkouts.forEach(workout => {
    let score = 0.5 // Base score for attempting the workout
    
    // Duration completion score
    const duration = (workout.duration || 0) / 60 // minutes
    if (duration >= 45) score += 0.3
    else if (duration >= 30) score += 0.2
    else if (duration >= 20) score += 0.1
    
    // Intensity completion score (if HR data available)
    if (workout.avgHr && user.maxHeartRate) {
      const hrPercent = workout.avgHr / user.maxHeartRate
      if (hrPercent >= 0.75) score += 0.2 // Good effort maintained
      else if (hrPercent >= 0.65) score += 0.1
    } else {
      score += 0.1 // Default if no HR data
    }
    
    completionScore += Math.min(1, score)
  })
  
  return completionScore / qualityWorkouts.length
}

// Assess long run experience
export function assessLongRunExperience(activities: SimpleActivity[], user: User): number {
  const longRuns = activities.filter(a => (a.distance || 0) >= 20000) // 20km+
  const veryLongRuns = activities.filter(a => (a.distance || 0) >= 28000) // 28km+
  const ultraLongRuns = activities.filter(a => (a.distance || 0) >= 32000) // 32km+
  
  let score = 0
  
  // Long run frequency and progression (60%)
  score += Math.min(0.35, longRuns.length * 0.04) // Up to ~9 long runs
  score += Math.min(0.15, veryLongRuns.length * 0.05) // Up to 3 very long runs
  score += Math.min(0.10, ultraLongRuns.length * 0.10) // Up to 1 ultra long run
  
  // Long run quality (40%)
  if (longRuns.length > 0) {
    const avgLongRunPace = longRuns.reduce((sum, r) => sum + (r.duration! / (r.distance! / 1000)), 0) / longRuns.length
    
    // Quality based on sustainable long run pacing
    if (avgLongRunPace >= 360 && avgLongRunPace <= 420) score += 0.4 // 6:00-7:00/km - good long run pace
    else if (avgLongRunPace >= 330 && avgLongRunPace <= 450) score += 0.3 // 5:30-7:30/km - acceptable
    else if (avgLongRunPace >= 300 && avgLongRunPace <= 480) score += 0.2 // 5:00-8:00/km - wide range
    else score += 0.1 // Outside optimal range
  }
  
  return Math.min(1, score)
}

// Assess race simulation quality
export function assessRaceSimulationQuality(activities: SimpleActivity[], user: User): number {
  // Look for runs that simulate race conditions
  const raceSimRuns = activities.filter(a => {
    const distance = (a.distance || 0) / 1000
    return distance >= 15 && // 15km+ for meaningful simulation
           isMarathonPaceEffort(a, user) // At race pace
  })
  
  const longRaceSimRuns = raceSimRuns.filter(a => (a.distance || 0) >= 25000) // 25km+ at race pace
  
  let score = 0
  
  // Frequency of race simulation (70%)
  score += Math.min(0.5, raceSimRuns.length * 0.1) // Up to 5 race sim runs
  score += Math.min(0.2, longRaceSimRuns.length * 0.1) // Up to 2 long race sim runs
  
  // Quality of race simulations (30%)
  if (raceSimRuns.length > 0) {
    // Check pace consistency in race simulations
    const paces = raceSimRuns.map(r => r.duration! / (r.distance! / 1000))
    const mean = paces.reduce((sum, p) => sum + p, 0) / paces.length
    const cv = paces.length > 1 ? 
      Math.sqrt(paces.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / paces.length) / mean : 0
    
    if (cv < 0.03) score += 0.3 // Very consistent race pace
    else if (cv < 0.05) score += 0.2 // Good consistency
    else if (cv < 0.08) score += 0.1 // Moderate consistency
  }
  
  return Math.min(1, score)
}

// Assess mental readiness
export function assessMentalReadiness(activities: SimpleActivity[], user: User, daysToRace: number): number {
  let score = 0
  
  // Confidence from recent performance (40%)
  const recentRuns = activities.slice(0, 10) // Last 10 runs
  if (recentRuns.length > 0) {
    const completedRuns = recentRuns.filter(r => (r.duration || 0) > 600) // At least 10 minutes
    const completionRate = completedRuns.length / recentRuns.length
    score += completionRate * 0.4
  }
  
  // Tapering appropriateness (30%)
  if (daysToRace <= 21) {
    const taperQuality = assessTaperingQuality(activities, daysToRace)
    score += taperQuality * 0.3
  } else {
    score += 0.25 // Not in taper yet - assume good
  }
  
  // Training momentum (30%)
  const last4WeeksVolume = calculateWeeklyMileages(activities, 4).reduce((sum, w) => sum + w, 0)
  const targetVolume = getTargetMileage(user.level) * 4
  const volumeMomentum = Math.min(1, last4WeeksVolume / targetVolume)
  score += volumeMomentum * 0.3
  
  return Math.min(1, score)
}

// Enhanced tapering quality assessment
export function assessTaperingQuality(activities: SimpleActivity[], daysToRace: number): number {
  if (daysToRace > 21) return 1 // Not in taper period yet
  
  const recentWeekMileage = calculateWeeklyMileages(activities, 1)[0] || 0
  const baselineMileage = calculateWeeklyMileages(activities, 8).slice(2, 6) // weeks 3-6 back
  const avgBaseline = baselineMileage.length > 0 ? 
    baselineMileage.reduce((sum, w) => sum + w, 0) / baselineMileage.length : 0
  
  if (avgBaseline === 0) return 0.5 // Can't assess without baseline
  
  const taperRatio = recentWeekMileage / avgBaseline
  
  // Taper quality based on days to race
  if (daysToRace <= 7) {
    // Race week: should be 40-60% of baseline
    if (taperRatio >= 0.4 && taperRatio <= 0.6) return 1.0
    if (taperRatio >= 0.3 && taperRatio <= 0.7) return 0.8
    return 0.4
  } else if (daysToRace <= 14) {
    // 2 weeks out: should be 60-80% of baseline
    if (taperRatio >= 0.6 && taperRatio <= 0.8) return 1.0
    if (taperRatio >= 0.5 && taperRatio <= 0.9) return 0.8
    return 0.4
  } else {
    // 3 weeks out: should be 70-90% of baseline
    if (taperRatio >= 0.7 && taperRatio <= 0.9) return 1.0
    if (taperRatio >= 0.6 && taperRatio <= 1.0) return 0.8
    return 0.4
  }
}

// Helper functions

function calculateWeeklyTrainingData(activities: SimpleActivity[], weeks: number): { distance: number; activities: number; avgIntensity: number }[] {
  const weeklyData: { distance: number; activities: number; avgIntensity: number }[] = []
  const now = new Date()
  
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    
    const weekActivities = activities.filter(a => {
      const date = new Date(a.date || '')
      return date >= weekStart && date < weekEnd
    })
    
    const distance = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
    const avgIntensity = weekActivities.length > 0 
      ? weekActivities.reduce((sum, a) => sum + (a.avgHr || 0), 0) / weekActivities.length
      : 0
    
    weeklyData.push({
      distance,
      activities: weekActivities.length,
      avgIntensity
    })
  }
  
  return weeklyData.reverse() // chronological order
}

function calculateWeeklyMileages(activities: SimpleActivity[], weeks: number): number[] {
  const mileages: number[] = []
  const now = new Date()
  
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    
    const weekActivities = activities.filter(a => {
      const date = new Date(a.date || '')
      return date >= weekStart && date < weekEnd
    })
    
    const weeklyDistance = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000
    mileages.push(weeklyDistance)
  }
  
  return mileages.reverse() // chronological order
}

function getTargetMileage(level: string): number {
  switch (level) {
    case 'beginner': return 40
    case 'intermediate': return 65
    case 'advanced': return 85
    default: return 55
  }
}

function isTempoEffort(activity: SimpleActivity, user: User): boolean {
  if (!activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000)
  const paceMinPerKm = pacePerKm / 60
  
  // Rough tempo pace range (will be refined with actual data)
  return paceMinPerKm >= 5.0 && paceMinPerKm <= 5.8
}

function isSpeedWork(activity: SimpleActivity, user: User): boolean {
  if (!activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000)
  const paceMinPerKm = pacePerKm / 60
  
  return paceMinPerKm < 5.0 || // Fast pace
         (activity.distance! <= 8000 && paceMinPerKm < 5.5) // Short fast runs
}

function isMarathonPaceEffort(activity: SimpleActivity, user: User): boolean {
  if (!activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000)
  const paceMinPerKm = pacePerKm / 60
  
  // Rough marathon pace range
  return paceMinPerKm >= 5.3 && paceMinPerKm <= 6.0
}