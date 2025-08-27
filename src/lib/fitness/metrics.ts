/**
 * Advanced Fitness Metrics Calculations
 * 
 * Implements Training Stress Score (TSS), Chronic Training Load (CTL),
 * Acute Training Load (ATL), and Training Stress Balance (TSB) calculations
 * for sophisticated coaching intelligence.
 * 
 * Based on industry-standard formulas used in TrainingPeaks and similar platforms.
 */

import type { SimpleActivity } from '@/types'
import { getActivities, calculateAndStoreFitnessMetrics, getFitnessMetrics, getCurrentFitnessState } from '@/lib/database/queries'

// ===== TRAINING STRESS SCORE (TSS) CALCULATIONS =====

export interface TrainingStressData {
  tss: number
  intensityFactor: number
  normalizedPower?: number
  averageHeartRate?: number
  duration: number // seconds
}

/**
 * Calculate Training Stress Score for an activity
 * TSS = (Duration in hours × IF² × 100)
 * 
 * For heart rate-based calculation:
 * IF = Average HR / Threshold HR
 */
export function calculateTrainingStressScore(
  activity: SimpleActivity,
  userThresholdHR = 170,
  userFTP?: number // Functional Threshold Power (if available)
): TrainingStressData {
  const durationHours = (activity.duration || 0) / 3600
  
  let intensityFactor = 0.7 // Default moderate intensity
  
  // Heart rate-based intensity factor
  if (activity.avgHr && activity.avgHr > 0 && userThresholdHR > 0) {
    intensityFactor = Math.min(activity.avgHr / userThresholdHR, 1.2) // Cap at 120% of threshold
  }
  // Pace-based intensity factor (rough estimation)
  else if (activity.avgPace && activity.avgPace > 0) {
    const paceMinPerKm = 1000 / activity.avgPace / 60
    
    // These are rough estimates and should be calibrated per individual
    if (paceMinPerKm < 3.5) intensityFactor = 1.0      // Very fast
    else if (paceMinPerKm < 4.0) intensityFactor = 0.95 // Fast
    else if (paceMinPerKm < 4.5) intensityFactor = 0.85 // Moderate-fast
    else if (paceMinPerKm < 5.0) intensityFactor = 0.75 // Moderate
    else if (paceMinPerKm < 5.5) intensityFactor = 0.65 // Easy-moderate
    else intensityFactor = 0.55                         // Easy
  }
  
  const tss = durationHours * intensityFactor * intensityFactor * 100
  
  return {
    tss,
    intensityFactor,
    averageHeartRate: activity.avgHr,
    duration: activity.duration || 0
  }
}

/**
 * Calculate TSS for multiple activities (batch processing)
 */
export function calculateTSSBatch(
  activities: SimpleActivity[],
  userThresholdHR = 170
): Map<string, TrainingStressData> {
  const results = new Map<string, TrainingStressData>()
  
  for (const activity of activities) {
    if (!activity.date || !activity.duration) continue
    
    const tssData = calculateTrainingStressScore(activity, userThresholdHR)
    results.set(activity.date, tssData)
  }
  
  return results
}

// ===== FITNESS CURVE CALCULATIONS (CTL/ATL/TSB) =====

export interface FitnessCurveData {
  date: string
  ctl: number // Chronic Training Load (42-day exponentially weighted average)
  atl: number // Acute Training Load (7-day exponentially weighted average)  
  tsb: number // Training Stress Balance (CTL - ATL)
  dailyTSS: number
  fitnessLevel: number // 0-100 scale
  fatigueLevel: number // 0-100 scale
  formLevel: number    // -100 to +100 scale
}

/**
 * Calculate fitness curves using exponential moving averages
 * 
 * CTL (Chronic Training Load): 42-day exponentially weighted average of TSS
 * - Represents fitness/endurance capacity
 * - Alpha = 2/(42+1) = 0.047
 * 
 * ATL (Acute Training Load): 7-day exponentially weighted average of TSS  
 * - Represents fatigue/recent training stress
 * - Alpha = 2/(7+1) = 0.25
 * 
 * TSB (Training Stress Balance): CTL - ATL
 * - Positive = fresh/peaked, Negative = fatigued
 */
export async function calculateFitnessCurves(
  startDate: string,
  endDate: string,
  userThresholdHR = 170
): Promise<FitnessCurveData[]> {
  // Get activities for the date range
  const activities = await getActivities({
    startDate,
    endDate,
    limit: 1000 // Get enough data for accurate calculations
  })
  
  // Calculate daily TSS
  const dailyTSS = new Map<string, number>()
  
  for (const activity of activities) {
    const date = activity.date?.split('T')[0]
    if (!date) continue
    
    const tssData = calculateTrainingStressScore(activity, userThresholdHR)
    const existing = dailyTSS.get(date) || 0
    dailyTSS.set(date, existing + tssData.tss)
  }
  
  // Create date range array
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }
  
  // Calculate exponential moving averages
  const ctlAlpha = 2 / (42 + 1) // 42-day EMA smoothing factor
  const atlAlpha = 2 / (7 + 1)  // 7-day EMA smoothing factor
  
  let ctl = 0
  let atl = 0
  const results: FitnessCurveData[] = []
  
  for (const date of dates) {
    const tss = dailyTSS.get(date) || 0
    
    // Update exponential moving averages
    // EMA formula: new_value = (today * alpha) + (previous * (1 - alpha))
    ctl = (tss * ctlAlpha) + (ctl * (1 - ctlAlpha))
    atl = (tss * atlAlpha) + (atl * (1 - atlAlpha))
    
    const tsb = ctl - atl
    
    results.push({
      date,
      ctl,
      atl,
      tsb,
      dailyTSS: tss,
      fitnessLevel: Math.min(ctl, 100), // Scale CTL to 0-100
      fatigueLevel: Math.min(atl, 100), // Scale ATL to 0-100
      formLevel: Math.max(Math.min(tsb, 50), -50) // Scale TSB to +/-50
    })
  }
  
  return results
}

/**
 * Get current fitness state (most recent metrics)
 */
export async function getCurrentFitnessMetrics(): Promise<FitnessCurveData | null> {
  try {
    const current = await getCurrentFitnessState()
    
    if (!current) return null
    
    return {
      date: current.date,
      ctl: current.chronic_training_load,
      atl: current.acute_training_load,
      tsb: current.training_stress_balance,
      dailyTSS: current.daily_training_stress,
      fitnessLevel: current.fitness_level || Math.min(current.chronic_training_load, 100),
      fatigueLevel: current.fatigue_level || Math.min(current.acute_training_load, 100),
      formLevel: current.form_level || Math.max(Math.min(current.training_stress_balance, 50), -50)
    }
  } catch (error) {
    console.error('Failed to get current fitness metrics:', error)
    return null
  }
}

// ===== COACHING RECOMMENDATIONS BASED ON FITNESS =====

export interface CoachingRecommendation {
  type: 'easy' | 'tempo' | 'interval' | 'long' | 'recovery' | 'rest'
  reason: string
  confidence: number // 0-1
  targetDuration?: number // minutes
  targetIntensity?: number // 0-1 scale
  warnings?: string[]
}

/**
 * Generate workout recommendations based on current fitness state
 */
export function getWorkoutRecommendation(
  currentFitness: FitnessCurveData,
  recentActivities: SimpleActivity[] = [],
  daysSinceLastRest = 0
): CoachingRecommendation {
  const { ctl, atl, tsb, fitnessLevel, fatigueLevel } = currentFitness
  
  // Safety checks
  const warnings: string[] = []
  
  // High fatigue indicators
  if (fatigueLevel > 80) {
    warnings.push('High fatigue detected - consider easier training')
  }
  
  // Very low fitness
  if (fitnessLevel < 20) {
    warnings.push('Building base fitness - focus on consistency over intensity')
  }
  
  // Too many days without rest
  if (daysSinceLastRest > 6) {
    warnings.push('Overdue for rest day')
  }
  
  // Decision logic based on TSB and other factors
  
  // Rest day conditions
  if (tsb < -30 || fatigueLevel > 85 || daysSinceLastRest > 6) {
    return {
      type: 'rest',
      reason: tsb < -30 
        ? 'High negative TSB indicates accumulated fatigue'
        : daysSinceLastRest > 6
        ? 'Overdue for recovery'
        : 'Very high acute training load',
      confidence: 0.9,
      warnings
    }
  }
  
  // Recovery run conditions
  if (tsb < -15 || fatigueLevel > 70) {
    return {
      type: 'recovery',
      reason: 'Moderate fatigue - active recovery recommended',
      confidence: 0.8,
      targetDuration: 30,
      targetIntensity: 0.6,
      warnings
    }
  }
  
  // Easy run conditions  
  if (tsb < 0 || fitnessLevel < 40) {
    return {
      type: 'easy',
      reason: fitnessLevel < 40 
        ? 'Building aerobic base with easy effort'
        : 'Slight fatigue - easy pace recommended',
      confidence: 0.7,
      targetDuration: 45,
      targetIntensity: 0.7,
      warnings
    }
  }
  
  // Peak form conditions (positive TSB)
  if (tsb > 15 && fitnessLevel > 60) {
    return {
      type: 'interval',
      reason: 'Great form detected - ready for high-intensity work',
      confidence: 0.8,
      targetDuration: 60,
      targetIntensity: 0.9,
      warnings
    }
  }
  
  // Moderate form conditions
  if (tsb > 5 && fitnessLevel > 45) {
    return {
      type: 'tempo',
      reason: 'Good fitness with manageable fatigue - tempo effort appropriate',
      confidence: 0.7,
      targetDuration: 50,
      targetIntensity: 0.8,
      warnings
    }
  }
  
  // Default to easy run
  return {
    type: 'easy',
    reason: 'Balanced training load - maintaining aerobic fitness',
    confidence: 0.6,
    targetDuration: 45,
    targetIntensity: 0.7,
    warnings
  }
}

/**
 * Batch calculate and store fitness metrics for a date range
 */
export async function updateFitnessMetrics(
  startDate: string,
  endDate: string,
  userThresholdHR = 170
): Promise<void> {
  try {
    console.log(`Calculating fitness metrics from ${startDate} to ${endDate}`)
    
    // Calculate and store metrics in database
    await calculateAndStoreFitnessMetrics(startDate, endDate)
    
    console.log('Fitness metrics updated successfully')
  } catch (error) {
    console.error('Failed to update fitness metrics:', error)
    throw error
  }
}

/**
 * Get weekly fitness summary for dashboard/analysis
 */
export async function getWeeklyFitnessSummary(weeks = 12): Promise<{
  week: string
  avgCTL: number
  avgATL: number
  avgTSB: number
  weeklyTSS: number
  weeklyKm: number
  daysWithData: number
}[]> {
  try {
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (weeks * 7))
    
    const metrics = await getFitnessMetrics(
      startDate.toISOString().split('T')[0],
      endDate
    )
    
    // Group by week
    const weeklyData = new Map<string, {
      ctlSum: number
      atlSum: number  
      tsbSum: number
      tssSum: number
      kmSum: number
      count: number
    }>()
    
    for (const metric of metrics) {
      const date = new Date(metric.date)
      const mondayOfWeek = new Date(date)
      const day = mondayOfWeek.getDay()
      const diff = mondayOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
      mondayOfWeek.setDate(diff)
      
      const weekKey = mondayOfWeek.toISOString().split('T')[0]
      
      const existing = weeklyData.get(weekKey) || {
        ctlSum: 0, atlSum: 0, tsbSum: 0, tssSum: 0, kmSum: 0, count: 0
      }
      
      existing.ctlSum += metric.chronic_training_load
      existing.atlSum += metric.acute_training_load
      existing.tsbSum += metric.training_stress_balance
      existing.tssSum += metric.daily_training_stress
      existing.kmSum += metric.daily_distance / 1000
      existing.count += 1
      
      weeklyData.set(weekKey, existing)
    }
    
    // Convert to final format
    return Array.from(weeklyData.entries())
      .map(([week, data]) => ({
        week,
        avgCTL: Math.round(data.ctlSum / data.count * 10) / 10,
        avgATL: Math.round(data.atlSum / data.count * 10) / 10,
        avgTSB: Math.round(data.tsbSum / data.count * 10) / 10,
        weeklyTSS: Math.round(data.tssSum * 10) / 10,
        weeklyKm: Math.round(data.kmSum * 10) / 10,
        daysWithData: data.count
      }))
      .sort((a, b) => b.week.localeCompare(a.week))
      .slice(0, weeks)
      
  } catch (error) {
    console.error('Failed to get weekly fitness summary:', error)
    return []
  }
}

// ===== PERFORMANCE INSIGHTS =====

/**
 * Analyze training consistency and provide insights
 */
export function analyzeTrainingConsistency(
  weeklyData: { weeklyTSS: number; weeklyKm: number; daysWithData: number; week: string }[]
): {
  consistencyScore: number // 0-100
  insights: string[]
  recommendations: string[]
} {
  if (weeklyData.length < 4) {
    return {
      consistencyScore: 0,
      insights: ['Not enough data for consistency analysis'],
      recommendations: ['Continue logging activities for better insights']
    }
  }
  
  const insights: string[] = []
  const recommendations: string[] = []
  
  // Calculate consistency metrics
  const weeklyTSS = weeklyData.map(w => w.weeklyTSS)
  const weeklyKm = weeklyData.map(w => w.weeklyKm)
  const weeklyDays = weeklyData.map(w => w.daysWithData)
  
  const avgTSS = weeklyTSS.reduce((a, b) => a + b, 0) / weeklyTSS.length
  const avgKm = weeklyKm.reduce((a, b) => a + b, 0) / weeklyKm.length
  const avgDays = weeklyDays.reduce((a, b) => a + b, 0) / weeklyDays.length
  
  // Standard deviation for variability
  const tssStdDev = Math.sqrt(weeklyTSS.reduce((sq, n) => sq + Math.pow(n - avgTSS, 2), 0) / weeklyTSS.length)
  const kmStdDev = Math.sqrt(weeklyKm.reduce((sq, n) => sq + Math.pow(n - avgKm, 2), 0) / weeklyKm.length)
  
  // Consistency score (lower variability = higher consistency)
  const tssConsistency = Math.max(0, 100 - (tssStdDev / avgTSS * 100))
  const kmConsistency = Math.max(0, 100 - (kmStdDev / avgKm * 100))
  const frequencyConsistency = (avgDays / 7) * 100
  
  const consistencyScore = Math.round((tssConsistency + kmConsistency + frequencyConsistency) / 3)
  
  // Generate insights
  if (consistencyScore > 80) {
    insights.push('Excellent training consistency')
  } else if (consistencyScore > 60) {
    insights.push('Good training consistency with room for improvement')
  } else {
    insights.push('Training consistency needs attention')
  }
  
  if (avgDays < 3) {
    insights.push('Training frequency is quite low')
    recommendations.push('Try to increase training frequency to 3-4 days per week')
  }
  
  if (tssStdDev / avgTSS > 0.5) {
    insights.push('High week-to-week training load variability')
    recommendations.push('Consider more consistent weekly training loads')
  }
  
  return {
    consistencyScore,
    insights,
    recommendations
  }
}