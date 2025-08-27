import type { SimpleActivity, User, RaceReadinessScore } from '@/types'

/**
 * Race Readiness Assessment System
 * Evaluates marathon readiness across 5 key dimensions
 */

export async function assessRaceReadiness(
  activities: SimpleActivity[],
  user: User
): Promise<RaceReadinessScore> {
  console.log('🎯 Assessing race readiness across 5 dimensions...')
  
  const now = new Date()
  const raceDate = user.raceDate ? new Date(user.raceDate) : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const daysToRace = Math.ceil((raceDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  
  // Get relevant training windows
  const last12Weeks = getActivitiesInWindow(activities, 84) // 12 weeks
  const last6Weeks = getActivitiesInWindow(activities, 42) // 6 weeks
  const last4Weeks = getActivitiesInWindow(activities, 28) // 4 weeks
  
  const components = {
    aerobicBase: assessAerobicBase(last12Weeks, user),
    lactateThreshold: assessLactateThreshold(last6Weeks, user),
    neuromuscularPower: assessNeuromuscularPower(last4Weeks, user),
    strengthMobility: assessStrengthMobility(last12Weeks, user),
    mentalPreparation: assessMentalPreparation(last12Weeks, user, daysToRace)
  }
  
  const overall = calculateOverallScore(components, daysToRace)
  const recommendations = generateRecommendations(components, daysToRace)
  
  console.log('Race readiness scores:', {
    overall: Math.round(overall),
    ...Object.fromEntries(Object.entries(components).map(([k, v]) => [k, Math.round(v)]))
  })
  
  return {
    overall: Math.round(overall),
    components: {
      aerobicBase: Math.round(components.aerobicBase),
      lactateThreshold: Math.round(components.lactateThreshold),
      neuromuscularPower: Math.round(components.neuromuscularPower),
      strengthMobility: Math.round(components.strengthMobility),
      mentalPreparation: Math.round(components.mentalPreparation)
    },
    recommendations,
    lastCalculated: now.toISOString()
  }
}

function getActivitiesInWindow(activities: SimpleActivity[], days: number): SimpleActivity[] {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return activities
    .filter(a => a.date && new Date(a.date) >= cutoff)
    .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
}

/**
 * Aerobic Base Assessment (0-100)
 * Based on weekly mileage trends, long run consistency, and easy pace development
 */
function assessAerobicBase(activities: SimpleActivity[], user: User): number {
  if (activities.length === 0) return 0
  
  let score = 0
  const maxScore = 100
  
  // 1. Weekly Mileage Consistency (40 points)
  const weeklyMileages = calculateWeeklyMileages(activities, 12)
  const avgWeeklyMileage = weeklyMileages.reduce((sum, w) => sum + w, 0) / weeklyMileages.length
  const mileageStability = calculateStability(weeklyMileages)
  
  // Target based on user level
  const targetMileage = getTargetMileage(user.level)
  const mileageScore = Math.min(40, (avgWeeklyMileage / targetMileage) * 30 + mileageStability * 10)
  score += mileageScore
  
  // 2. Long Run Development (30 points)
  const longRuns = activities.filter(a => (a.distance || 0) >= 15000) // 15km+
  const longestRun = Math.max(...activities.map(a => (a.distance || 0) / 1000))
  
  const longRunFrequency = longRuns.length / 12 // per week average
  const longRunDistance = Math.min(30, longestRun) / 30 // max 30km for full score
  
  score += longRunFrequency * 15 + longRunDistance * 15
  
  // 3. Easy Pace Development (30 points)
  const easyRuns = activities.filter(a => isEasyEffort(a, user))
  const easyPaceProgression = analyzeEasyPaceProgression(easyRuns)
  
  score += Math.min(30, easyRuns.length / activities.length * 40 + easyPaceProgression * 10)
  
  return Math.min(maxScore, Math.max(0, score))
}

/**
 * Lactate Threshold Assessment (0-100)
 * Based on tempo work frequency, threshold pace development, and race pace confidence
 */
function assessLactateThreshold(activities: SimpleActivity[], user: User): number {
  if (activities.length === 0) return 0
  
  let score = 0
  const maxScore = 100
  
  // 1. Tempo/Threshold Work Frequency (50 points)
  const tempoRuns = activities.filter(a => isTempoEffort(a, user))
  const tempoFrequency = tempoRuns.length / 6 // per week over 6 weeks
  score += Math.min(25, tempoFrequency * 12.5) // 2 tempo sessions/week = max
  
  // 2. Threshold Pace Development (30 points)
  const tempoPaceProgression = analyzeTempoPaceProgression(tempoRuns)
  score += tempoPaceProgression * 30
  
  // 3. Marathon Pace Confidence (20 points)
  const marathonPaceRuns = activities.filter(a => isMarathonPaceEffort(a, user))
  const marathonPaceConfidence = marathonPaceRuns.length >= 4 ? 20 : marathonPaceRuns.length * 5
  score += marathonPaceConfidence
  
  return Math.min(maxScore, Math.max(0, score))
}

/**
 * Neuromuscular Power Assessment (0-100) 
 * Based on speed work, interval training, and finishing speed development
 */
function assessNeuromuscularPower(activities: SimpleActivity[], user: User): number {
  if (activities.length === 0) return 0
  
  let score = 0
  const maxScore = 100
  
  // 1. Speed Work Frequency (40 points)
  const speedRuns = activities.filter(a => isSpeedWork(a, user))
  const speedFrequency = speedRuns.length / 4 // per week over 4 weeks
  score += Math.min(30, speedFrequency * 15) // 2 sessions/week = max
  
  // 2. Interval Performance (40 points)
  const intervalRuns = activities.filter(a => isIntervalWork(a, user))
  if (intervalRuns.length > 0) {
    const intervalPaceProgression = analyzeIntervalProgression(intervalRuns)
    score += intervalPaceProgression * 40
  } else {
    score += 10 // minimal score for no intervals
  }
  
  // 3. Speed Endurance (20 points)
  const speedEnduranceRuns = activities.filter(a => 
    (a.distance || 0) >= 5000 && (a.distance || 0) <= 10000 && isTempoEffort(a, user)
  )
  score += Math.min(20, speedEnduranceRuns.length * 5)
  
  return Math.min(maxScore, Math.max(0, score))
}

/**
 * Strength & Mobility Assessment (0-100)
 * Based on training consistency, injury history, and progression sustainability
 */
function assessStrengthMobility(activities: SimpleActivity[], user: User): number {
  let score = 0
  const maxScore = 100
  
  // 1. Training Consistency (50 points)
  const weeklyConsistency = calculateTrainingConsistency(activities, 12)
  score += weeklyConsistency * 50
  
  // 2. Injury Risk Factors (30 points)
  const injuryRisk = assessTrainingLoadProgression(activities)
  score += (1 - injuryRisk) * 30 // inverse of risk
  
  // 3. Volume Progression (20 points)
  const progressionScore = assessVolumeProgression(activities)
  score += progressionScore * 20
  
  return Math.min(maxScore, Math.max(0, score))
}

/**
 * Mental Preparation Assessment (0-100)
 * Based on long run experience, race simulation, and confidence building
 */
function assessMentalPreparation(activities: SimpleActivity[], user: User, daysToRace: number): number {
  let score = 0
  const maxScore = 100
  
  // 1. Long Run Experience (40 points)
  const longRuns = activities.filter(a => (a.distance || 0) >= 20000) // 20km+
  const veryLongRuns = activities.filter(a => (a.distance || 0) >= 28000) // 28km+
  
  score += Math.min(25, longRuns.length * 3) // up to 8 long runs
  score += Math.min(15, veryLongRuns.length * 5) // up to 3 very long runs
  
  // 2. Race Pace Experience (30 points)
  const racePaceExperience = activities.filter(a => 
    (a.distance || 0) >= 15000 && isMarathonPaceEffort(a, user)
  )
  score += Math.min(30, racePaceExperience.length * 7.5)
  
  // 3. Tapering Appropriateness (30 points)
  if (daysToRace <= 21) {
    const taperScore = assessTaperingQuality(activities, daysToRace)
    score += taperScore * 30
  } else {
    score += 20 // not in taper yet, assume good
  }
  
  return Math.min(maxScore, Math.max(0, score))
}

// Helper functions

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

function calculateStability(values: number[]): number {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const cv = Math.sqrt(variance) / mean // coefficient of variation
  
  return Math.max(0, 1 - cv) // stability = 1 - variability
}

function getTargetMileage(level: string): number {
  switch (level) {
    case 'beginner': return 40
    case 'intermediate': return 60
    case 'advanced': return 80
    default: return 50
  }
}

function isEasyEffort(activity: SimpleActivity, user: User): boolean {
  if (!activity.avgHr || !user.maxHeartRate) return false
  const hrPercent = activity.avgHr / user.maxHeartRate
  return hrPercent <= 0.75 // Zone 1-2
}

function isTempoEffort(activity: SimpleActivity, user: User): boolean {
  if (!activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000)
  const paceMinPerKm = pacePerKm / 60
  
  // Rough tempo pace range (will be refined with actual data)
  return paceMinPerKm >= 5.0 && paceMinPerKm <= 5.8
}

function isMarathonPaceEffort(activity: SimpleActivity, user: User): boolean {
  if (!activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000)
  const paceMinPerKm = pacePerKm / 60
  
  // Rough marathon pace range
  return paceMinPerKm >= 5.3 && paceMinPerKm <= 6.0
}

function isSpeedWork(activity: SimpleActivity, user: User): boolean {
  if (!activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000)
  const paceMinPerKm = pacePerKm / 60
  
  return paceMinPerKm < 5.0 || // Fast pace
         (activity.distance! <= 8000 && paceMinPerKm < 5.5) // Short fast runs
}

function isIntervalWork(activity: SimpleActivity, user: User): boolean {
  return (activity.distance || 0) >= 3000 && 
         (activity.distance || 0) <= 8000 && 
         isSpeedWork(activity, user)
}

function analyzeEasyPaceProgression(activities: SimpleActivity[]): number {
  if (activities.length < 4) return 0
  
  // Simple linear regression to detect improvement
  const paces = activities.map(a => a.duration! / (a.distance! / 1000))
  const recent = paces.slice(0, Math.floor(activities.length / 2))
  const older = paces.slice(Math.floor(activities.length / 2))
  
  const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length
  const olderAvg = older.reduce((sum, p) => sum + p, 0) / older.length
  
  // Improvement = getting faster (lower pace values)
  return olderAvg > recentAvg ? 1 : 0.5
}

function analyzeTempoPaceProgression(activities: SimpleActivity[]): number {
  if (activities.length < 2) return 0.3
  
  return analyzeEasyPaceProgression(activities) // Same logic for now
}

function analyzeIntervalProgression(activities: SimpleActivity[]): number {
  if (activities.length < 2) return 0.2
  
  return analyzeEasyPaceProgression(activities) // Same logic for now
}

function calculateTrainingConsistency(activities: SimpleActivity[], weeks: number): number {
  const weeklyActivities = calculateWeeklyMileages(activities, weeks)
  const weeksWithTraining = weeklyActivities.filter(w => w > 0).length
  
  return weeksWithTraining / weeks
}

function assessTrainingLoadProgression(activities: SimpleActivity[]): number {
  const weeklyMileages = calculateWeeklyMileages(activities, 8)
  
  let riskScore = 0
  for (let i = 1; i < weeklyMileages.length; i++) {
    const increase = (weeklyMileages[i] - weeklyMileages[i-1]) / weeklyMileages[i-1]
    if (increase > 0.15) riskScore += 0.2 // >15% increase is risky
    if (increase > 0.25) riskScore += 0.3 // >25% is very risky
  }
  
  return Math.min(1, riskScore)
}

function assessVolumeProgression(activities: SimpleActivity[]): number {
  const weeklyMileages = calculateWeeklyMileages(activities, 12)
  const firstHalf = weeklyMileages.slice(0, 6)
  const secondHalf = weeklyMileages.slice(6)
  
  const firstAvg = firstHalf.reduce((sum, w) => sum + w, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, w) => sum + w, 0) / secondHalf.length
  
  const progression = (secondAvg - firstAvg) / firstAvg
  
  // Ideal progression is 5-15% over 6 weeks
  if (progression >= 0.05 && progression <= 0.15) return 1
  if (progression >= 0 && progression <= 0.25) return 0.7
  return 0.3
}

function assessTaperingQuality(activities: SimpleActivity[], daysToRace: number): number {
  const recentWeekMileage = calculateWeeklyMileages(activities, 1)[0]
  const baselineMileage = calculateWeeklyMileages(activities, 8).slice(2, 6) // weeks 3-6 back
  const avgBaseline = baselineMileage.reduce((sum, w) => sum + w, 0) / baselineMileage.length
  
  const taperRatio = recentWeekMileage / avgBaseline
  
  // Good taper is 60-80% of baseline volume
  if (taperRatio >= 0.6 && taperRatio <= 0.8) return 1
  if (taperRatio >= 0.5 && taperRatio <= 0.9) return 0.7
  return 0.3
}

function calculateOverallScore(components: Record<string, number>, daysToRace: number): number {
  const { aerobicBase, lactateThreshold, neuromuscularPower, strengthMobility, mentalPreparation } = components
  
  // Weights change based on race proximity
  let weights
  if (daysToRace > 84) { // Base phase
    weights = { aerobicBase: 0.4, lactateThreshold: 0.2, neuromuscularPower: 0.1, strengthMobility: 0.2, mentalPreparation: 0.1 }
  } else if (daysToRace > 28) { // Build phase
    weights = { aerobicBase: 0.3, lactateThreshold: 0.3, neuromuscularPower: 0.2, strengthMobility: 0.1, mentalPreparation: 0.1 }
  } else if (daysToRace > 7) { // Peak phase
    weights = { aerobicBase: 0.2, lactateThreshold: 0.25, neuromuscularPower: 0.2, strengthMobility: 0.15, mentalPreparation: 0.2 }
  } else { // Taper phase
    weights = { aerobicBase: 0.2, lactateThreshold: 0.2, neuromuscularPower: 0.15, strengthMobility: 0.2, mentalPreparation: 0.25 }
  }
  
  return aerobicBase * weights.aerobicBase +
         lactateThreshold * weights.lactateThreshold +
         neuromuscularPower * weights.neuromuscularPower +
         strengthMobility * weights.strengthMobility +
         mentalPreparation * weights.mentalPreparation
}

function generateRecommendations(components: Record<string, number>, daysToRace: number): string[] {
  const recommendations: string[] = []
  const threshold = 70 // Score below this triggers recommendations
  
  if (components.aerobicBase < threshold) {
    recommendations.push('Focus on building weekly mileage with easy-paced runs')
    recommendations.push('Include one long run per week, building by 2-3km each time')
  }
  
  if (components.lactateThreshold < threshold) {
    recommendations.push('Add 1-2 tempo runs per week at threshold pace')
    recommendations.push('Practice marathon pace during long runs')
  }
  
  if (components.neuromuscularPower < threshold && daysToRace > 21) {
    recommendations.push('Include weekly interval training (4-6x 1km at 5K pace)')
    recommendations.push('Add strides to easy runs to maintain leg turnover')
  }
  
  if (components.strengthMobility < threshold) {
    recommendations.push('Focus on consistent training without dramatic mileage jumps')
    recommendations.push('Consider strength training and injury prevention work')
  }
  
  if (components.mentalPreparation < threshold) {
    if (daysToRace > 28) {
      recommendations.push('Schedule long runs of 28-32km to build confidence')
      recommendations.push('Practice race-day nutrition and pacing strategies')
    } else {
      recommendations.push('Trust your training and focus on race day execution')
      recommendations.push('Visualize race success and prepare mentally for challenges')
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Excellent preparation! Maintain current training approach')
    recommendations.push('Focus on staying healthy and executing race strategy')
  }
  
  return recommendations
}