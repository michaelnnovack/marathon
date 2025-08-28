import type { SimpleActivity, User } from '@/types'

/**
 * Additional helper functions for race readiness assessment
 * Separated to keep the main file manageable
 */

// Speed work progression analysis
export function analyzeSpeedWorkProgression(runs: SimpleActivity[]): number {
  if (runs.length < 3) return 0.3
  
  const sortedRuns = runs
    .filter(r => r.date && r.duration && r.distance)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  
  const paces = sortedRuns.map(r => r.duration! / (r.distance! / 1000))
  
  // Compare recent vs older speed work paces
  const recentPaces = paces.slice(0, Math.ceil(paces.length / 2))
  const olderPaces = paces.slice(Math.ceil(paces.length / 2))
  
  if (recentPaces.length === 0 || olderPaces.length === 0) return 0.3
  
  const recentAvg = recentPaces.reduce((sum, p) => sum + p, 0) / recentPaces.length
  const olderAvg = olderPaces.reduce((sum, p) => sum + p, 0) / olderPaces.length
  
  const improvement = (olderAvg - recentAvg) / olderAvg
  
  if (improvement > 0.02) return 1.0 // 2%+ improvement
  if (improvement > 0.005) return 0.8 // 0.5-2% improvement
  if (improvement > -0.005) return 0.6 // Stable
  return 0.3 // Getting slower
}

// Analyze running economy
export async function analyzeRunningEconomy(activities: SimpleActivity[], user: User): Promise<number> {
  const qualityRuns = activities.filter(a => 
    a.avgHr && a.duration && a.distance &&
    (a.distance || 0) >= 3000 && // 3km+ for meaningful data
    a.avgHr > 120 // Exclude very easy recovery runs
  )
  
  if (qualityRuns.length < 5 || !user.maxHeartRate) return 0.4
  
  // Calculate economy scores for each run (pace relative to heart rate effort)
  const economyScores = qualityRuns.map(run => {
    const pace = run.duration! / (run.distance! / 1000)
    const hrPercent = run.avgHr! / user.maxHeartRate!
    const distance = (run.distance || 0) / 1000
    
    // Economy = faster pace at same relative effort
    // Normalize by distance (longer runs naturally slower)
    const distanceFactor = Math.pow(distance / 10, 0.05) // Very small distance adjustment
    const adjustedPace = pace * distanceFactor
    
    // Lower adjusted pace at lower HR% = better economy
    return (400 - adjustedPace) / (hrPercent * 500)
  })
  
  // Analyze trend over time
  const sortedByDate = qualityRuns
    .map((run, index) => ({ run, economy: economyScores[index] }))
    .sort((a, b) => new Date(a.run.date!).getTime() - new Date(b.run.date!).getTime())
  
  const recent = sortedByDate.slice(-Math.ceil(sortedByDate.length / 2))
  const older = sortedByDate.slice(0, Math.floor(sortedByDate.length / 2))
  
  if (recent.length === 0 || older.length === 0) return 0.4
  
  const recentEconomy = recent.reduce((sum, item) => sum + item.economy, 0) / recent.length
  const olderEconomy = older.reduce((sum, item) => sum + item.economy, 0) / older.length
  
  const improvement = (recentEconomy - olderEconomy) / Math.abs(olderEconomy)
  
  if (improvement > 0.05) return 1.0 // 5%+ improvement
  if (improvement > 0.02) return 0.8 // 2-5% improvement
  if (improvement > -0.02) return 0.6 // Stable
  return 0.3 // Declining
}

// Assess neuromuscular readiness
export function assessNeuromuscularReadiness(recentSpeedRuns: SimpleActivity[], user: User): number {
  let score = 0
  
  // Recent speed work frequency (10 points)
  const weeklySpeedFreq = recentSpeedRuns.length / 4 // Over 4 weeks
  score += Math.min(10, weeklySpeedFreq * 10) // 1/week = max
  
  // Speed work variety (8 points)
  const shortRuns = recentSpeedRuns.filter(r => (r.distance || 0) < 5000)
  const mediumRuns = recentSpeedRuns.filter(r => (r.distance || 0) >= 5000 && (r.distance || 0) < 8000)
  const varietyScore = (shortRuns.length > 0 ? 4 : 0) + (mediumRuns.length > 0 ? 4 : 0)
  score += varietyScore
  
  // Recent performance quality (7 points)
  if (recentSpeedRuns.length > 0) {
    const avgPace = recentSpeedRuns.reduce((sum, r) => sum + (r.duration! / (r.distance! / 1000)), 0) / recentSpeedRuns.length
    // Score based on pace quality (this is simplified - would need user-specific targets)
    if (avgPace < 240) score += 7 // Sub-4:00/km
    else if (avgPace < 270) score += 5 // 4:00-4:30/km
    else if (avgPace < 300) score += 3 // 4:30-5:00/km
    else score += 1
  }
  
  return Math.min(25, score)
}

// Enhanced training consistency calculation
export function calculateEnhancedTrainingConsistency(activities: SimpleActivity[], weeks: number): number {
  const weeklyData = calculateWeeklyTrainingData(activities, weeks)
  
  if (weeklyData.length === 0) return 0
  
  let consistencyScore = 0
  
  // Week frequency consistency (40%)
  const weeksWithTraining = weeklyData.filter(w => w.activities > 0).length
  const frequencyConsistency = weeksWithTraining / weeks
  consistencyScore += frequencyConsistency * 0.4
  
  // Weekly activity frequency consistency (30%)
  const avgActivitiesPerWeek = weeklyData.reduce((sum, w) => sum + w.activities, 0) / weeklyData.length
  const targetFrequency = 4 // Target 4 runs per week
  const activityConsistency = Math.min(1, avgActivitiesPerWeek / targetFrequency)
  consistencyScore += activityConsistency * 0.3
  
  // Volume consistency (30%)
  const nonZeroWeeks = weeklyData.filter(w => w.distance > 0)
  if (nonZeroWeeks.length > 1) {
    const volumes = nonZeroWeeks.map(w => w.distance)
    const mean = volumes.reduce((sum, v) => sum + v, 0) / volumes.length
    const cv = Math.sqrt(volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length) / mean
    const volumeConsistency = Math.max(0, 1 - cv)
    consistencyScore += volumeConsistency * 0.3
  }
  
  return Math.min(1, consistencyScore)
}

// Calculate weekly training data
export function calculateWeeklyTrainingData(activities: SimpleActivity[], weeks: number): { distance: number; activities: number; avgIntensity: number }[] {
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

// Assess training load management
export function assessTrainingLoadManagement(activities: SimpleActivity[], currentFitness: any): number {
  if (!currentFitness) return 0.5 // Default if no fitness data
  
  const { tsb, atl, ctl } = currentFitness
  let score = 0
  
  // TSB analysis (50%)
  if (tsb >= -15 && tsb <= 10) score += 0.5 // Good TSB range
  else if (tsb >= -25 && tsb <= 20) score += 0.3 // Acceptable range
  else score += 0.1 // Poor TSB
  
  // ATL/CTL ratio (30%)
  if (ctl > 0) {
    const ratio = atl / ctl
    if (ratio >= 0.8 && ratio <= 1.2) score += 0.3 // Good ratio
    else if (ratio >= 0.6 && ratio <= 1.4) score += 0.2 // Acceptable
    else score += 0.1 // Poor ratio
  } else {
    score += 0.15 // Default if no CTL
  }
  
  // Recent load progression (20%)
  const weeklyMileages = calculateWeeklyMileages(activities, 4)
  if (weeklyMileages.length >= 3) {
    let goodProgression = true
    for (let i = 1; i < weeklyMileages.length; i++) {
      if (weeklyMileages[i-1] > 0) {
        const increase = (weeklyMileages[i] - weeklyMileages[i-1]) / weeklyMileages[i-1]
        if (increase > 0.20) goodProgression = false // >20% weekly increase is risky
      }
    }
    score += goodProgression ? 0.2 : 0.05
  }
  
  return Math.min(1, score)
}

// Calculate weekly mileages (needed by above function)
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

// Comprehensive injury risk assessment
export function assessComprehensiveInjuryRisk(activities: SimpleActivity[], currentFitness: any, prAnalysis?: any): number {
  let riskScore = 0
  
  // 1. Volume progression risk (30%)
  const volumeRisk = assessVolumeProgressionRisk(activities)
  riskScore += volumeRisk * 0.3
  
  // 2. Training intensity distribution risk (25%)
  const intensityRisk = assessIntensityDistributionRisk(activities)
  riskScore += intensityRisk * 0.25
  
  // 3. Recovery adequacy risk (25%)
  const recoveryRisk = assessRecoveryRisk(currentFitness)
  riskScore += recoveryRisk * 0.25
  
  // 4. Training consistency risk (20%)
  const consistencyRisk = assessConsistencyRisk(activities)
  riskScore += consistencyRisk * 0.2
  
  return Math.min(1, riskScore)
}

// Volume progression risk
export function assessVolumeProgressionRisk(activities: SimpleActivity[]): number {
  const weeklyMileages = calculateWeeklyMileages(activities, 8)
  
  let riskScore = 0
  let violations = 0
  
  for (let i = 1; i < weeklyMileages.length; i++) {
    if (weeklyMileages[i-1] > 0) {
      const increase = (weeklyMileages[i] - weeklyMileages[i-1]) / weeklyMileages[i-1]
      if (increase > 0.15) { // >15% increase
        violations++
        if (increase > 0.25) riskScore += 0.2 // >25% is high risk
        else riskScore += 0.1 // 15-25% is moderate risk
      }
    }
  }
  
  // Penalty for frequent violations
  if (violations > 2) riskScore += 0.2
  
  return Math.min(1, riskScore)
}

// Intensity distribution risk
export function assessIntensityDistributionRisk(activities: SimpleActivity[]): number {
  const runsWithHR = activities.filter(a => a.avgHr && a.duration)
  
  if (runsWithHR.length < 5) return 0.3 // Default moderate risk if insufficient data
  
  // Calculate time in each intensity zone
  let easyTime = 0, moderateTime = 0, hardTime = 0
  const totalTime = runsWithHR.reduce((sum, a) => sum + (a.duration || 0), 0)
  
  runsWithHR.forEach(run => {
    const duration = run.duration || 0
    // Simple classification based on average HR percentage
    // This is a simplified version - in reality would use user's max HR
    if (run.avgHr! < 140) easyTime += duration
    else if (run.avgHr! < 160) moderateTime += duration
    else hardTime += duration
  })
  
  const easyPercent = easyTime / totalTime
  const hardPercent = hardTime / totalTime
  
  // 80/20 rule: 80% easy, 20% moderate/hard
  let riskScore = 0
  if (easyPercent < 0.7) riskScore += 0.3 // Too much intensity
  if (hardPercent > 0.25) riskScore += 0.3 // Way too much hard work
  
  return Math.min(1, riskScore)
}

// Recovery risk assessment
export function assessRecoveryRisk(currentFitness: any): number {
  if (!currentFitness) return 0.5
  
  const { tsb, atl } = currentFitness
  let riskScore = 0
  
  // Negative TSB indicates fatigue
  if (tsb < -20) riskScore += 0.5 // High fatigue
  else if (tsb < -10) riskScore += 0.3 // Moderate fatigue
  
  // High acute training load
  if (atl > 80) riskScore += 0.3
  else if (atl > 60) riskScore += 0.2
  
  return Math.min(1, riskScore)
}

// Consistency risk (paradoxically, inconsistency is risky)
export function assessConsistencyRisk(activities: SimpleActivity[]): number {
  const consistency = calculateEnhancedTrainingConsistency(activities, 8)
  return Math.max(0, 1 - consistency) // High consistency = low risk
}

// Assess recovery patterns
export function assessRecoveryPatterns(activities: SimpleActivity[], currentFitness: any): number {
  let score = 0
  
  // Current fitness state (40%)
  if (currentFitness) {
    const { tsb, atl, ctl } = currentFitness
    
    // TSB in good range
    if (tsb >= -10 && tsb <= 5) score += 0.25
    else if (tsb >= -20 && tsb <= 10) score += 0.15
    else score += 0.05
    
    // Reasonable ATL/CTL balance
    if (ctl > 0) {
      const ratio = atl / ctl
      if (ratio >= 0.7 && ratio <= 1.1) score += 0.15
      else if (ratio >= 0.5 && ratio <= 1.3) score += 0.1
      else score += 0.05
    }
  } else {
    score += 0.2 // Default if no fitness data
  }
  
  // Training frequency patterns (30%)
  const weeklyFrequency = calculateWeeklyFrequency(activities, 4)
  const avgFrequency = weeklyFrequency.reduce((sum, f) => sum + f, 0) / weeklyFrequency.length
  
  // Good frequency is 3-5 runs per week
  if (avgFrequency >= 3 && avgFrequency <= 5) score += 0.3
  else if (avgFrequency >= 2 && avgFrequency <= 6) score += 0.2
  else score += 0.1
  
  // Recovery day patterns (30%) - look for easy days after hard days
  const recoveryPatternScore = assessRecoveryDayPatterns(activities)
  score += recoveryPatternScore * 0.3
  
  return Math.min(1, score)
}

// Calculate weekly training frequency
export function calculateWeeklyFrequency(activities: SimpleActivity[], weeks: number): number[] {
  const frequencies: number[] = []
  const now = new Date()
  
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    
    const weekActivities = activities.filter(a => {
      const date = new Date(a.date || '')
      return date >= weekStart && date < weekEnd
    })
    
    frequencies.push(weekActivities.length)
  }
  
  return frequencies.reverse()
}

// Assess recovery day patterns
export function assessRecoveryDayPatterns(activities: SimpleActivity[]): number {
  const sortedActivities = activities
    .filter(a => a.date && a.duration && a.distance)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
  
  if (sortedActivities.length < 10) return 0.5 // Not enough data
  
  let goodPatterns = 0
  let totalPatterns = 0
  
  for (let i = 1; i < sortedActivities.length - 1; i++) {
    const prev = sortedActivities[i - 1]
    const curr = sortedActivities[i]
    const next = sortedActivities[i + 1]
    
    // Check if current run is hard effort
    if (isHardEffort(curr)) {
      totalPatterns++
      
      // Check if next run is easier (recovery pattern)
      if (next && isEasyEffort(next)) {
        goodPatterns++
      }
    }
  }
  
  return totalPatterns > 0 ? goodPatterns / totalPatterns : 0.5
}

// Check if run is hard effort
function isHardEffort(activity: SimpleActivity): boolean {
  if (!activity.avgHr) return false
  return activity.avgHr > 160 // Simplified threshold
}

// Check if run is easy effort (simplified version)
function isEasyEffort(activity: SimpleActivity): boolean {
  if (!activity.avgHr) return false
  return activity.avgHr < 140 // Simplified threshold
}