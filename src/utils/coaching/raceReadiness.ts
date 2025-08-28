import type { SimpleActivity, User, RaceReadinessScore, PRAnalysis, TrainingStressBalance } from '@/types'
import { getCurrentFitnessMetrics, calculateTrainingStressScore } from '@/lib/fitness/metrics'
import { predictMarathonTime, calculatePersonalizedTrainingPaces, analyzeHeartRateDistribution } from '@/utils/predict'
import {
  analyzeSpeedWorkProgression,
  analyzeRunningEconomy,
  assessNeuromuscularReadiness,
  calculateEnhancedTrainingConsistency,
  assessTrainingLoadManagement,
  assessComprehensiveInjuryRisk,
  assessRecoveryPatterns
} from './raceReadinessHelpers'
import {
  estimateTrainingAdherence,
  estimateWorkoutCompletion,
  assessLongRunExperience,
  assessRaceSimulationQuality,
  assessMentalReadiness
} from './mentalPreparationHelpers'

/**
 * Enhanced Race Readiness Assessment System
 * 
 * Evaluates marathon readiness across 5 research-based dimensions:
 * 1. Aerobic Base (40% weight) - CTL, volume consistency, easy pace efficiency, aerobic decoupling
 * 2. Lactate Threshold (25% weight) - tempo progression, threshold power, race pace confidence  
 * 3. Neuromuscular Power (15% weight) - speed work frequency, running economy, interval progression
 * 4. Strength & Mobility (10% weight) - injury history, training load progression, consistency
 * 5. Mental Preparation (10% weight) - training adherence, race experience, long run confidence
 * 
 * Uses actual intervals.icu training data for evidence-based scoring.
 */

export async function assessRaceReadiness(
  activities: SimpleActivity[],
  user: User,
  prAnalysis?: PRAnalysis,
  targetTrainingPlan?: { adherenceRate?: number; completionRate?: number }
): Promise<RaceReadinessScore> {
  console.log('🎯 Assessing race readiness across 5 research-based dimensions...')
  
  const now = new Date()
  const raceDate = user.raceDate ? new Date(user.raceDate) : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
  const daysToRace = Math.ceil((raceDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  
  // Get relevant training windows
  const last16Weeks = getActivitiesInWindow(activities, 112) // 16 weeks for base building analysis
  const last12Weeks = getActivitiesInWindow(activities, 84) // 12 weeks
  const last8Weeks = getActivitiesInWindow(activities, 56) // 8 weeks
  const last6Weeks = getActivitiesInWindow(activities, 42) // 6 weeks
  const last4Weeks = getActivitiesInWindow(activities, 28) // 4 weeks
  
  // Get current fitness metrics for CTL/ATL analysis
  const currentFitness = await getCurrentFitnessMetrics()
  
  // Calculate training stress data
  const tssData = calculateTSSForActivities(activities, user)
  
  console.log(`📊 Training data: ${activities.length} activities, ${daysToRace} days to race`)
  
  const components = {
    aerobicBase: await assessAerobicBase(last16Weeks, last12Weeks, user, currentFitness, tssData, prAnalysis),
    lactateThreshold: await assessLactateThreshold(last8Weeks, last6Weeks, user, tssData, prAnalysis),
    neuromuscularPower: await assessNeuromuscularPower(last6Weeks, last4Weeks, user, prAnalysis),
    strengthMobility: await assessStrengthMobility(last12Weeks, user, currentFitness, prAnalysis),
    mentalPreparation: await assessMentalPreparation(last12Weeks, user, daysToRace, targetTrainingPlan)
  }
  
  const overall = calculateOverallScore(components, daysToRace)
  const recommendations = generateRecommendations(components, daysToRace, prAnalysis)
  
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
 * Enhanced Aerobic Base Assessment (0-100)
 * Research-based scoring using:
 * - Chronic Training Load (CTL) trends (30 points)
 * - Weekly volume consistency and progression (25 points) 
 * - Easy pace efficiency and aerobic decoupling (25 points)
 * - Long run development and aerobic capacity (20 points)
 */
async function assessAerobicBase(
  activities16weeks: SimpleActivity[], 
  activities12weeks: SimpleActivity[], 
  user: User,
  currentFitness: any,
  tssData: Map<string, number>,
  prAnalysis?: PRAnalysis
): Promise<number> {
  if (activities12weeks.length === 0) return 0
  
  let score = 0
  const maxScore = 100
  
  console.log('🏃‍♂️ Aerobic Base Assessment:')
  
  // 1. Chronic Training Load (CTL) Analysis (30 points)
  let ctlScore = 0
  if (currentFitness?.ctl) {
    const ctl = currentFitness.ctl
    const targetCTL = getTargetCTL(user.level)
    
    // CTL adequacy (15 points)
    ctlScore += Math.min(15, (ctl / targetCTL) * 15)
    
    // CTL progression over 12 weeks (15 points)
    const ctlProgression = analyzeCTLProgression(tssData, 12)
    ctlScore += ctlProgression * 15
    
    console.log(`  CTL: ${Math.round(ctl)} (target: ${targetCTL}) -> ${Math.round(ctlScore)} points`)
  } else {
    // Fallback to volume analysis if no CTL data
    const weeklyMileages = calculateWeeklyMileages(activities12weeks, 12)
    const avgWeeklyMileage = weeklyMileages.reduce((sum, w) => sum + w, 0) / weeklyMileages.length
    const targetMileage = getTargetMileage(user.level)
    ctlScore = Math.min(30, (avgWeeklyMileage / targetMileage) * 30)
    
    console.log(`  Volume: ${Math.round(avgWeeklyMileage)}km/week (target: ${targetMileage}) -> ${Math.round(ctlScore)} points`)
  }
  score += ctlScore
  
  // 2. Weekly Volume Consistency and Progression (25 points)
  const weeklyMileages = calculateWeeklyMileages(activities12weeks, 12)
  const mileageConsistency = calculateMileageConsistency(weeklyMileages)
  const mileageProgression = calculateMileageProgression(weeklyMileages)
  
  const volumeScore = mileageConsistency * 15 + mileageProgression * 10
  score += volumeScore
  
  console.log(`  Volume consistency: ${Math.round(mileageConsistency * 100)}%, progression: ${Math.round(mileageProgression * 100)}% -> ${Math.round(volumeScore)} points`)
  
  // 3. Easy Pace Efficiency and Aerobic Decoupling (25 points)
  const aerobicEfficiencyScore = await analyzeAerobicEfficiency(activities12weeks, user)
  score += aerobicEfficiencyScore * 25
  
  console.log(`  Aerobic efficiency: ${Math.round(aerobicEfficiencyScore * 100)}% -> ${Math.round(aerobicEfficiencyScore * 25)} points`)
  
  // 4. Long Run Development and Aerobic Capacity (20 points)
  const longRunScore = assessLongRunDevelopment(activities12weeks, user)
  score += longRunScore
  
  console.log(`  Long run development: ${Math.round(longRunScore)} points`)
  
  const finalScore = Math.min(maxScore, Math.max(0, score))
  console.log(`  🎯 Aerobic Base Total: ${Math.round(finalScore)}/100`)
  
  return finalScore
}

/**
 * Enhanced Lactate Threshold Assessment (0-100)
 * Research-based scoring using:
 * - Tempo work frequency and quality (40 points)
 * - Threshold pace progression and consistency (35 points) 
 * - Marathon pace confidence and execution (25 points)
 */
async function assessLactateThreshold(
  activities8weeks: SimpleActivity[],
  activities6weeks: SimpleActivity[], 
  user: User,
  tssData: Map<string, number>,
  prAnalysis?: PRAnalysis
): Promise<number> {
  if (activities6weeks.length === 0) return 0
  
  let score = 0
  const maxScore = 100
  
  console.log('🔥 Lactate Threshold Assessment:')
  
  // 1. Tempo Work Frequency and Quality (40 points)
  const tempoRuns = activities8weeks.filter(a => isTempoEffort(a, user))
  const intervalRuns = activities8weeks.filter(a => isIntervalWork(a, user))
  const thresholdRuns = [...tempoRuns, ...intervalRuns]
  
  // Frequency score (20 points) - target 1-2 threshold sessions per week
  const weeklyThresholdFreq = thresholdRuns.length / 8
  const frequencyScore = Math.min(20, weeklyThresholdFreq * 12) // 1.67/week = max
  score += frequencyScore
  
  // Quality score (20 points) - based on workout duration and intensity
  const qualityScore = assessThresholdWorkoutQuality(thresholdRuns, user)
  score += qualityScore
  
  console.log(`  Threshold frequency: ${Math.round(weeklyThresholdFreq * 10) / 10}/week, quality: ${Math.round(qualityScore)} -> ${Math.round(frequencyScore + qualityScore)} points`)
  
  // 2. Threshold Pace Progression and Consistency (35 points)
  const paceProgression = analyzeThresholdPaceProgression(thresholdRuns, user)
  const paceConsistency = analyzeThresholdPaceConsistency(thresholdRuns, user)
  
  const paceScore = paceProgression * 20 + paceConsistency * 15
  score += paceScore
  
  console.log(`  Pace progression: ${Math.round(paceProgression * 100)}%, consistency: ${Math.round(paceConsistency * 100)}% -> ${Math.round(paceScore)} points`)
  
  // 3. Marathon Pace Confidence and Execution (25 points)
  const marathonPaceScore = assessMarathonPaceConfidence(activities8weeks, user)
  score += marathonPaceScore
  
  console.log(`  Marathon pace confidence: ${Math.round(marathonPaceScore)} points`)
  
  const finalScore = Math.min(maxScore, Math.max(0, score))
  console.log(`  🎯 Lactate Threshold Total: ${Math.round(finalScore)}/100`)
  
  return finalScore
}

/**
 * Enhanced Neuromuscular Power Assessment (0-100)
 * Research-based scoring using:
 * - Speed work frequency and progression (40 points)
 * - Running economy and efficiency trends (35 points)
 * - Neuromuscular readiness and power development (25 points)
 */
async function assessNeuromuscularPower(
  activities6weeks: SimpleActivity[],
  activities4weeks: SimpleActivity[],
  user: User,
  prAnalysis?: PRAnalysis
): Promise<number> {
  if (activities4weeks.length === 0) return 0
  
  let score = 0
  const maxScore = 100
  
  console.log('⚡ Neuromuscular Power Assessment:')
  
  // 1. Speed Work Frequency and Progression (40 points)
  const speedRuns = activities6weeks.filter(a => isSpeedWork(a, user))
  const recentSpeedRuns = activities4weeks.filter(a => isSpeedWork(a, user))
  
  // Frequency score (20 points)
  const weeklySpeedFreq = speedRuns.length / 6
  const frequencyScore = Math.min(20, weeklySpeedFreq * 20) // 1/week = max
  score += frequencyScore
  
  // Progression score (20 points)
  const speedProgression = analyzeSpeedWorkProgression(speedRuns)
  score += speedProgression * 20
  
  console.log(`  Speed frequency: ${Math.round(weeklySpeedFreq * 10) / 10}/week, progression: ${Math.round(speedProgression * 100)}% -> ${Math.round(frequencyScore + speedProgression * 20)} points`)
  
  // 2. Running Economy and Efficiency Trends (35 points)
  const economyScore = await analyzeRunningEconomy(activities6weeks, user)
  score += economyScore * 35
  
  console.log(`  Running economy: ${Math.round(economyScore * 100)}% -> ${Math.round(economyScore * 35)} points`)
  
  // 3. Neuromuscular Readiness and Power (25 points)
  const powerScore = assessNeuromuscularReadiness(recentSpeedRuns, user)
  score += powerScore
  
  console.log(`  Neuromuscular power: ${Math.round(powerScore)} points`)
  
  const finalScore = Math.min(maxScore, Math.max(0, score))
  console.log(`  🎯 Neuromuscular Power Total: ${Math.round(finalScore)}/100`)
  
  return finalScore
}

/**
 * Enhanced Strength & Mobility Assessment (0-100)
 * Research-based scoring using:
 * - Training consistency and load management (40 points)
 * - Injury risk factors and progression sustainability (35 points)
 * - Recovery patterns and training stress balance (25 points)
 */
async function assessStrengthMobility(
  activities: SimpleActivity[], 
  user: User,
  currentFitness: any,
  prAnalysis?: PRAnalysis
): Promise<number> {
  let score = 0
  const maxScore = 100
  
  console.log('💪 Strength & Mobility Assessment:')
  
  // 1. Training Consistency and Load Management (40 points)
  const consistency = calculateEnhancedTrainingConsistency(activities, 12)
  const loadManagement = assessTrainingLoadManagement(activities, currentFitness)
  
  const consistencyScore = consistency * 25 + loadManagement * 15
  score += consistencyScore
  
  console.log(`  Consistency: ${Math.round(consistency * 100)}%, load management: ${Math.round(loadManagement * 100)}% -> ${Math.round(consistencyScore)} points`)
  
  // 2. Injury Risk Factors and Progression Sustainability (35 points)
  const injuryRisk = assessComprehensiveInjuryRisk(activities, currentFitness, prAnalysis)
  const sustainabilityScore = (1 - injuryRisk) * 35
  score += sustainabilityScore
  
  console.log(`  Injury risk: ${Math.round(injuryRisk * 100)}% -> ${Math.round(sustainabilityScore)} points`)
  
  // 3. Recovery Patterns and Training Stress Balance (25 points)
  const recoveryScore = assessRecoveryPatterns(activities, currentFitness)
  score += recoveryScore * 25
  
  console.log(`  Recovery patterns: ${Math.round(recoveryScore * 100)}% -> ${Math.round(recoveryScore * 25)} points`)
  
  const finalScore = Math.min(maxScore, Math.max(0, score))
  console.log(`  🎯 Strength & Mobility Total: ${Math.round(finalScore)}/100`)
  
  return finalScore
}

/**
 * Enhanced Mental Preparation Assessment (0-100)
 * Research-based scoring using:
 * - Training plan adherence and completion rates (40 points)
 * - Long run experience and race simulation (35 points)
 * - Mental readiness and confidence indicators (25 points)
 */
async function assessMentalPreparation(
  activities: SimpleActivity[], 
  user: User, 
  daysToRace: number,
  targetTrainingPlan?: { adherenceRate?: number; completionRate?: number }
): Promise<number> {
  let score = 0
  const maxScore = 100
  
  console.log('🧠 Mental Preparation Assessment:')
  
  // 1. Training Plan Adherence and Completion Rates (40 points)
  let adherenceScore = 0
  if (targetTrainingPlan?.adherenceRate !== undefined) {
    adherenceScore = Math.min(25, targetTrainingPlan.adherenceRate * 25)
  } else {
    // Fallback: estimate adherence from activity consistency
    const estimatedAdherence = estimateTrainingAdherence(activities)
    adherenceScore = estimatedAdherence * 25
  }
  
  let completionScore = 0
  if (targetTrainingPlan?.completionRate !== undefined) {
    completionScore = Math.min(15, targetTrainingPlan.completionRate * 15)
  } else {
    // Fallback: estimate completion from workout quality
    const estimatedCompletion = estimateWorkoutCompletion(activities, user)
    completionScore = estimatedCompletion * 15
  }
  
  const adherenceTotal = adherenceScore + completionScore
  score += adherenceTotal
  
  console.log(`  Adherence: ${Math.round((adherenceScore / 25) * 100)}%, completion: ${Math.round((completionScore / 15) * 100)}% -> ${Math.round(adherenceTotal)} points`)
  
  // 2. Long Run Experience and Race Simulation (35 points)
  const longRunExperience = assessLongRunExperience(activities, user)
  const raceSimulation = assessRaceSimulationQuality(activities, user)
  
  const experienceScore = longRunExperience * 20 + raceSimulation * 15
  score += experienceScore
  
  console.log(`  Long run experience: ${Math.round(longRunExperience * 100)}%, race simulation: ${Math.round(raceSimulation * 100)}% -> ${Math.round(experienceScore)} points`)
  
  // 3. Mental Readiness and Confidence Indicators (25 points)
  const mentalReadiness = assessMentalReadiness(activities, user, daysToRace)
  score += mentalReadiness * 25
  
  console.log(`  Mental readiness: ${Math.round(mentalReadiness * 100)}% -> ${Math.round(mentalReadiness * 25)} points`)
  
  const finalScore = Math.min(maxScore, Math.max(0, score))
  console.log(`  🎯 Mental Preparation Total: ${Math.round(finalScore)}/100`)
  
  return finalScore
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

/**
 * Assess injury risk based on PR improvement patterns
 * Returns risk score from 0 (low risk) to 1 (high risk)
 */
function assessPRInjuryRisk(prAnalysis?: PRAnalysis): number {
  if (!prAnalysis) return 0.2 // Low baseline risk without PR data
  
  let riskScore = 0
  const maxRisk = 1.0
  
  // Factor 1: Frequency of PRs (30% weight)
  const prFrequency30Days = prAnalysis.improvements.count30Days
  const prFrequency90Days = prAnalysis.improvements.count90Days
  
  if (prFrequency30Days >= 4) riskScore += 0.25 // Very high frequency
  else if (prFrequency30Days >= 3) riskScore += 0.15 // High frequency
  else if (prFrequency30Days >= 2) riskScore += 0.05 // Moderate frequency
  
  if (prFrequency90Days >= 8) riskScore += 0.05 // Sustained high PR activity
  
  // Factor 2: Magnitude of improvements (40% weight)
  const avgImprovement = prAnalysis.improvements.averageImprovement
  const significantImprovements = prAnalysis.improvements.significantImprovements.length
  
  if (avgImprovement > 15) riskScore += 0.30 // Very large improvements
  else if (avgImprovement > 10) riskScore += 0.20 // Large improvements
  else if (avgImprovement > 5) riskScore += 0.10 // Moderate improvements
  
  if (significantImprovements >= 3) riskScore += 0.10 // Multiple big improvements
  
  // Factor 3: Recent PR clustering (30% weight)
  const recentPRs = prAnalysis.recentPRs.filter(pr => {
    const prDate = new Date(pr.date)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return prDate >= thirtyDaysAgo
  })
  
  // Multiple PRs in short time window increases risk
  if (recentPRs.length >= 3) {
    const prDates = recentPRs.map(pr => new Date(pr.date).getTime()).sort()
    const timeSpan = prDates[prDates.length - 1] - prDates[0]
    const daysSpan = timeSpan / (24 * 60 * 60 * 1000)
    
    if (daysSpan <= 7) riskScore += 0.25 // PRs clustered in 1 week
    else if (daysSpan <= 14) riskScore += 0.15 // PRs clustered in 2 weeks
    else if (daysSpan <= 21) riskScore += 0.05 // PRs clustered in 3 weeks
  }
  
  // Use the existing analysis risk score as a baseline
  const analysisRisk = prAnalysis.injuryRiskFactors.riskScore / 100
  riskScore = Math.max(riskScore, analysisRisk)
  
  return Math.min(maxRisk, riskScore)
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

function generateRecommendations(components: Record<string, number>, daysToRace: number, prAnalysis?: PRAnalysis): string[] {
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
    
    // Add PR-specific injury risk recommendations
    if (prAnalysis) {
      const prRisk = prAnalysis.injuryRiskFactors.riskScore
      if (prRisk > 60) {
        recommendations.push('CAUTION: Multiple recent PRs detected - prioritize recovery and easy running')
        recommendations.push('Consider reducing training intensity for 1-2 weeks to prevent overuse injury')
      } else if (prRisk > 40) {
        recommendations.push('Recent performance improvements noted - monitor for signs of overtraining')
        recommendations.push('Ensure adequate sleep and nutrition to support recovery')
      }
      
      // Add specific warnings from PR analysis
      prAnalysis.injuryRiskFactors.warnings.forEach(warning => {
        recommendations.push(`⚠️ ${warning}`)
      })
    }
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

// Enhanced Helper Functions for Research-Based Assessments

// Training Stress Score calculations for activities
function calculateTSSForActivities(activities: SimpleActivity[], user: User): Map<string, number> {
  const tssMap = new Map<string, number>()
  const thresholdHR = user.maxHeartRate ? user.maxHeartRate * 0.85 : 170
  
  activities.forEach(activity => {
    if (activity.date) {
      const tssData = calculateTrainingStressScore(activity, thresholdHR)
      const date = activity.date.split('T')[0]
      const existing = tssMap.get(date) || 0
      tssMap.set(date, existing + tssData.tss)
    }
  })
  
  return tssMap
}

// CTL progression analysis
function analyzeCTLProgression(tssData: Map<string, number>, weeks: number): number {
  const dates = Array.from(tssData.keys()).sort()
  if (dates.length < weeks * 3) return 0.3 // Not enough data
  
  const recentDates = dates.slice(-weeks * 7)
  const olderDates = dates.slice(-weeks * 14, -weeks * 7)
  
  if (olderDates.length === 0) return 0.5
  
  const recentAvg = recentDates.reduce((sum, date) => sum + (tssData.get(date) || 0), 0) / recentDates.length
  const olderAvg = olderDates.reduce((sum, date) => sum + (tssData.get(date) || 0), 0) / olderDates.length
  
  if (olderAvg === 0) return 0.5
  
  const progression = (recentAvg - olderAvg) / olderAvg
  // Ideal progression is 5-15% improvement
  if (progression >= 0.05 && progression <= 0.15) return 1.0
  if (progression >= 0 && progression <= 0.25) return 0.8
  if (progression >= -0.05 && progression < 0) return 0.6
  return 0.3
}

// Target CTL based on user level
function getTargetCTL(level: string): number {
  switch (level) {
    case 'beginner': return 40
    case 'intermediate': return 65
    case 'advanced': return 85
    default: return 55
  }
}

// Enhanced mileage consistency analysis
function calculateMileageConsistency(weeklyMileages: number[]): number {
  if (weeklyMileages.length < 4) return 0
  
  const nonZeroWeeks = weeklyMileages.filter(w => w > 0)
  if (nonZeroWeeks.length < 3) return 0
  
  const mean = nonZeroWeeks.reduce((sum, w) => sum + w, 0) / nonZeroWeeks.length
  const variance = nonZeroWeeks.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) / nonZeroWeeks.length
  const cv = Math.sqrt(variance) / mean // coefficient of variation
  
  // Consistency score: lower CV = higher consistency
  return Math.max(0, 1 - Math.min(cv, 1))
}

// Mileage progression analysis
function calculateMileageProgression(weeklyMileages: number[]): number {
  if (weeklyMileages.length < 6) return 0.5
  
  const firstHalf = weeklyMileages.slice(0, Math.floor(weeklyMileages.length / 2))
  const secondHalf = weeklyMileages.slice(Math.floor(weeklyMileages.length / 2))
  
  const firstAvg = firstHalf.reduce((sum, w) => sum + w, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, w) => sum + w, 0) / secondHalf.length
  
  if (firstAvg === 0) return 0.5
  
  const progression = (secondAvg - firstAvg) / firstAvg
  
  // Ideal progression is 5-20% over time period
  if (progression >= 0.05 && progression <= 0.20) return 1.0
  if (progression >= 0 && progression <= 0.30) return 0.8
  if (progression >= -0.05 && progression < 0) return 0.6
  return 0.3
}

function assessLongRunDevelopment(activities: SimpleActivity[], user: User): number {
  const longRuns = activities.filter(a => (a.distance || 0) >= 15000) // 15km+
  const veryLongRuns = activities.filter(a => (a.distance || 0) >= 25000) // 25km+
  const longestRun = Math.max(0, ...activities.map(a => (a.distance || 0) / 1000))
  
  let score = 0
  
  // Long run frequency (8 points) - target 1 per week
  const weeklyLongRunFreq = longRuns.length / 12
  score += Math.min(8, weeklyLongRunFreq * 8)
  
  // Very long run experience (6 points) - marathon-specific
  score += Math.min(6, veryLongRuns.length * 2)
  
  // Longest run distance (6 points) - up to 32km for full points
  score += Math.min(6, (longestRun / 32) * 6)
  
  return score
}

// Helper function to analyze aerobic efficiency
async function analyzeAerobicEfficiency(activities: SimpleActivity[], user: User): Promise<number> {
  const easyRuns = activities.filter(a => isEasyEffort(a, user) && a.distance && a.duration && (a.distance || 0) >= 5000)
  
  if (easyRuns.length < 5) return 0.3 // Minimal score if insufficient data
  
  // Analyze pace progression at easy effort
  const easyPaceProgression = analyzeEasyPaceProgression(easyRuns)
  
  // Analyze aerobic decoupling in long runs
  const aerobicDecoupling = analyzeAerobicDecoupling(easyRuns, user)
  
  // Heart rate efficiency trend
  const hrEfficiency = analyzeHeartRateEfficiency(easyRuns, user)
  
  // Weighted combination
  return (easyPaceProgression * 0.4) + (aerobicDecoupling * 0.4) + (hrEfficiency * 0.2)
}

// Analyze aerobic decoupling in long runs
function analyzeAerobicDecoupling(activities: SimpleActivity[], user: User): number {
  const longEasyRuns = activities.filter(a => 
    (a.distance || 0) >= 15000 && // 15km+ runs
    a.avgHr && a.maxHr && a.duration && a.distance &&
    isEasyEffort(a, user)
  )
  
  if (longEasyRuns.length < 3) return 0.4 // Insufficient data
  
  let totalDecouplingScore = 0
  let validRuns = 0
  
  longEasyRuns.forEach(run => {
    // Estimate decoupling (simplified - in reality would need split data)
    const hrRange = (run.maxHr! - (run.avgHr! * 0.9)) / run.avgHr!
    const decouplingScore = Math.max(0, 1 - hrRange) // Lower HR drift = better aerobic efficiency
    
    totalDecouplingScore += decouplingScore
    validRuns++
  })
  
  return validRuns > 0 ? totalDecouplingScore / validRuns : 0.4
}

// Analyze heart rate efficiency trends
function analyzeHeartRateEfficiency(activities: SimpleActivity[], user: User): number {
  const runsWithHR = activities.filter(a => 
    a.avgHr && a.duration && a.distance && 
    (a.distance || 0) >= 3000 // 3km+ for meaningful data
  )
  
  if (runsWithHR.length < 4 || !user.maxHeartRate) return 0.5
  
  // Calculate pace/HR efficiency for each run
  const efficiencyScores = runsWithHR.map(run => {
    const pace = run.duration! / (run.distance! / 1000) // sec/km
    const hrPercent = run.avgHr! / user.maxHeartRate!
    
    // Lower pace (faster) at lower HR% = better efficiency
    return (400 - pace) / (hrPercent * 500) // Normalized efficiency score
  })
  
  // Analyze trend
  const recent = efficiencyScores.slice(0, Math.floor(efficiencyScores.length / 2))
  const older = efficiencyScores.slice(Math.floor(efficiencyScores.length / 2))
  
  const recentAvg = recent.reduce((sum, e) => sum + e, 0) / recent.length
  const olderAvg = older.reduce((sum, e) => sum + e, 0) / older.length
  
  // Improvement = higher efficiency score
  const improvement = (recentAvg - olderAvg) / olderAvg
  
  if (improvement > 0.05) return 1.0
  if (improvement > 0.02) return 0.8
  if (improvement > -0.02) return 0.6
  return 0.3
}

// Assess threshold workout quality
function assessThresholdWorkoutQuality(runs: SimpleActivity[], user: User): number {
  if (runs.length === 0) return 0
  
  let totalQuality = 0
  
  runs.forEach(run => {
    let quality = 0
    
    // Duration quality (0-0.4)
    const durationMinutes = (run.duration || 0) / 60
    if (durationMinutes >= 45) quality += 0.4
    else if (durationMinutes >= 30) quality += 0.3
    else if (durationMinutes >= 20) quality += 0.2
    else quality += 0.1
    
    // Intensity quality (0-0.4)
    if (run.avgHr && user.maxHeartRate) {
      const hrPercent = run.avgHr / user.maxHeartRate
      if (hrPercent >= 0.85 && hrPercent <= 0.92) quality += 0.4 // Perfect threshold zone
      else if (hrPercent >= 0.80 && hrPercent <= 0.95) quality += 0.3
      else if (hrPercent >= 0.75 && hrPercent <= 0.98) quality += 0.2
      else quality += 0.1
    } else {
      quality += 0.2 // Default if no HR data
    }
    
    // Distance quality (0-0.2)
    const distance = run.distance || 0
    if (distance >= 8000) quality += 0.2
    else if (distance >= 5000) quality += 0.15
    else if (distance >= 3000) quality += 0.1
    else quality += 0.05
    
    totalQuality += quality
  })
  
  const avgQuality = totalQuality / runs.length
  return Math.min(20, avgQuality * 20) // Scale to 20 points max
}

// Analyze threshold pace progression
function analyzeThresholdPaceProgression(runs: SimpleActivity[], user: User): number {
  if (runs.length < 3) return 0.3
  
  const sortedRuns = runs
    .filter(r => r.date && r.duration && r.distance)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
  
  const paces = sortedRuns.map(r => r.duration! / (r.distance! / 1000))
  
  if (paces.length < 3) return 0.3
  
  // Compare recent vs older paces
  const recentPaces = paces.slice(0, Math.ceil(paces.length / 2))
  const olderPaces = paces.slice(Math.ceil(paces.length / 2))
  
  const recentAvg = recentPaces.reduce((sum, p) => sum + p, 0) / recentPaces.length
  const olderAvg = olderPaces.reduce((sum, p) => sum + p, 0) / olderPaces.length
  
  const improvement = (olderAvg - recentAvg) / olderAvg
  
  if (improvement > 0.03) return 1.0 // 3%+ improvement
  if (improvement > 0.01) return 0.8 // 1-3% improvement  
  if (improvement > -0.01) return 0.6 // Stable
  return 0.3 // Getting slower
}

// Analyze threshold pace consistency
function analyzeThresholdPaceConsistency(runs: SimpleActivity[], user: User): number {
  if (runs.length < 3) return 0.3
  
  const paces = runs
    .filter(r => r.duration && r.distance)
    .map(r => r.duration! / (r.distance! / 1000))
  
  if (paces.length < 3) return 0.3
  
  const mean = paces.reduce((sum, p) => sum + p, 0) / paces.length
  const variance = paces.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / paces.length
  const cv = Math.sqrt(variance) / mean
  
  // Lower coefficient of variation = higher consistency
  if (cv < 0.05) return 1.0 // Very consistent (within 5%)
  if (cv < 0.08) return 0.8 // Good consistency  
  if (cv < 0.12) return 0.6 // Moderate consistency
  return 0.3 // Poor consistency
}

// Assess marathon pace confidence
function assessMarathonPaceConfidence(activities: SimpleActivity[], user: User): number {
  const marathonPaceRuns = activities.filter(a => 
    (a.distance || 0) >= 8000 && // 8km+ for meaningful marathon pace work
    isMarathonPaceEffort(a, user)
  )
  
  let score = 0
  
  // Frequency score (15 points) - target 4+ marathon pace runs
  const frequencyScore = Math.min(15, marathonPaceRuns.length * 3)
  score += frequencyScore
  
  if (marathonPaceRuns.length > 0) {
    // Long marathon pace runs (5 points) - 15km+ at marathon pace
    const longMarathonRuns = marathonPaceRuns.filter(r => (r.distance || 0) >= 15000)
    score += Math.min(5, longMarathonRuns.length * 2.5)
    
    // Consistency score (5 points)
    const paces = marathonPaceRuns.map(r => r.duration! / (r.distance! / 1000))
    const mean = paces.reduce((sum, p) => sum + p, 0) / paces.length
    const cv = Math.sqrt(paces.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / paces.length) / mean
    
    if (cv < 0.04) score += 5 // Very consistent
    else if (cv < 0.06) score += 3 // Good consistency
    else if (cv < 0.08) score += 1 // Moderate consistency
  }
  
  return Math.min(25, score)
}