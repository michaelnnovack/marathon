import type { SimpleActivity, PersonalRecord, RaceDistance } from '@/types'

// PR Distance Categories with tolerance ranges
export interface PRDistanceConfig {
  key: RaceDistance
  displayName: string
  meters: number
  tolerancePercent: number // percentage tolerance for distance matching
  icon: string
}

export const PR_DISTANCES: PRDistanceConfig[] = [
  {
    key: '5K',
    displayName: '5K',
    meters: 5000,
    tolerancePercent: 4, // 4.8K - 5.2K
    icon: '🏃'
  },
  {
    key: '10K',
    displayName: '10K', 
    meters: 10000,
    tolerancePercent: 4, // 9.6K - 10.4K
    icon: '🏃‍♂️'
  },
  {
    key: 'Half Marathon',
    displayName: 'Half Marathon',
    meters: 21097, // Official half marathon distance
    tolerancePercent: 2, // 20.7K - 21.5K
    icon: '🏃‍♀️'
  },
  {
    key: 'Marathon',
    displayName: 'Marathon',
    meters: 42195, // Official marathon distance
    tolerancePercent: 1, // 41.8K - 42.6K
    icon: '🏆'
  }
]

// Additional PR Types
export type PRType = 
  | 'fastest_1k'
  | 'fastest_5k' 
  | 'fastest_10k'
  | 'fastest_half_marathon'
  | 'fastest_marathon'
  | 'longest_run'
  | 'most_weekly_volume'
  | 'most_elevation_gain'

export interface PRData {
  id: string
  type: PRType
  distance: RaceDistance | 'longest_run' | 'weekly_volume' | 'elevation'
  value: number // seconds for time PRs, meters for distance, elevation
  pace?: number // seconds per km for time-based PRs
  date: string
  activityId?: string
  previousRecord?: number
  improvement?: number // seconds or meters improved
  improvementPercent?: number
  confidence: 'high' | 'medium' | 'low' // based on GPS accuracy, manual entry, etc.
  conditions?: {
    temperature?: number
    weather?: string
    course: 'flat' | 'hilly' | 'mixed' | 'unknown'
    surface?: 'road' | 'track' | 'trail' | 'treadmill'
  }
}

export interface PRHistory {
  type: PRType
  records: PRData[]
  currentPR?: PRData
  previousPR?: PRData
  improvement30Days?: number
  improvement90Days?: number
  improvementTrend: 'improving' | 'stable' | 'declining'
}

export interface PRAnalysis {
  recentPRs: PRData[] // PRs from last 90 days
  improvements: {
    count30Days: number
    count90Days: number
    averageImprovement: number
    significantImprovements: PRData[] // > 5% improvement
  }
  injuryRiskFactors: {
    rapidImprovement: boolean
    frequentPRs: boolean
    riskScore: number // 0-100
    warnings: string[]
  }
  potentialPRs: {
    activity: SimpleActivity
    estimatedPR: PRData
    confidence: number
  }[]
}

// Core PR Detection Functions

export function detectActivityPRs(
  activity: SimpleActivity,
  existingPRs: PRHistory[],
  allActivities?: SimpleActivity[]
): PRData[] {
  const detectedPRs: PRData[] = []
  
  if (!activity.distance || !activity.duration || !activity.date) {
    return detectedPRs
  }

  // Check distance-based PRs (5K, 10K, Half, Marathon)
  for (const distanceConfig of PR_DISTANCES) {
    const prType = `fastest_${distanceConfig.key.toLowerCase().replace(' ', '_')}` as PRType
    const isMatchingDistance = isDistanceMatch(activity.distance, distanceConfig)
    
    if (isMatchingDistance) {
      const existingHistory = existingPRs.find(pr => pr.type === prType)
      const currentBest = existingHistory?.currentPR?.value
      
      // Check if this is a new PR
      if (!currentBest || activity.duration < currentBest) {
        const improvement = currentBest ? currentBest - activity.duration : 0
        const improvementPercent = currentBest ? (improvement / currentBest) * 100 : 0
        
        const prData: PRData = {
          id: `${prType}_${activity.id}_${activity.date}`,
          type: prType,
          distance: distanceConfig.key,
          value: activity.duration,
          pace: activity.duration / (activity.distance / 1000), // seconds per km
          date: activity.date,
          activityId: activity.id,
          previousRecord: currentBest,
          improvement,
          improvementPercent,
          confidence: calculateConfidence(activity),
          conditions: extractConditions(activity)
        }
        
        detectedPRs.push(prData)
      }
    }
  }

  // Check for Fastest 1K (based on best 1K split if available, or estimate)
  const fastest1K = detectFastest1K(activity, existingPRs.find(pr => pr.type === 'fastest_1k'))
  if (fastest1K) {
    detectedPRs.push(fastest1K)
  }

  // Check for Longest Run
  const longestRun = detectLongestRun(activity, existingPRs.find(pr => pr.type === 'longest_run'))
  if (longestRun) {
    detectedPRs.push(longestRun)
  }

  // Check for Most Elevation Gain
  if (activity.elevationGain) {
    const elevationPR = detectMostElevation(activity, existingPRs.find(pr => pr.type === 'most_elevation_gain'))
    if (elevationPR) {
      detectedPRs.push(elevationPR)
    }
  }

  return detectedPRs
}

export function detectWeeklyVolumePR(
  weeklyActivities: SimpleActivity[],
  existingWeeklyPR?: PRHistory
): PRData | null {
  const weeklyDistance = weeklyActivities.reduce((total, activity) => {
    return total + (activity.distance || 0)
  }, 0)

  if (weeklyDistance === 0) return null

  const currentBest = existingWeeklyPR?.currentPR?.value || 0
  
  if (weeklyDistance > currentBest) {
    const improvement = weeklyDistance - currentBest
    const improvementPercent = currentBest > 0 ? (improvement / currentBest) * 100 : 0
    
    // Use the date of the last activity in the week
    const lastActivity = weeklyActivities
      .filter(a => a.date)
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
      .pop()

    return {
      id: `weekly_volume_${lastActivity?.date}_${Date.now()}`,
      type: 'most_weekly_volume',
      distance: 'weekly_volume',
      value: weeklyDistance,
      date: lastActivity?.date || new Date().toISOString(),
      previousRecord: currentBest,
      improvement,
      improvementPercent,
      confidence: 'high'
    }
  }

  return null
}

// Helper Functions

function isDistanceMatch(activityDistance: number, config: PRDistanceConfig): boolean {
  const tolerance = config.meters * (config.tolerancePercent / 100)
  return activityDistance >= (config.meters - tolerance) && 
         activityDistance <= (config.meters + tolerance)
}

function detectFastest1K(activity: SimpleActivity, existing1KPR?: PRHistory): PRData | null {
  if (!activity.duration || !activity.distance) return null
  
  // Estimate fastest 1K pace from overall activity pace
  // This is a rough estimate - ideally we'd have split data
  const estimatedPace = activity.duration / (activity.distance / 1000) // seconds per km
  const estimated1KTime = estimatedPace * 1000 / 1000 // normalize to 1K
  
  // Only consider activities >= 1K for 1K PR estimation
  if (activity.distance < 1000) return null
  
  const currentBest = existing1KPR?.currentPR?.value || Infinity
  
  if (estimated1KTime < currentBest) {
    const improvement = currentBest === Infinity ? 0 : currentBest - estimated1KTime
    const improvementPercent = currentBest === Infinity ? 0 : (improvement / currentBest) * 100
    
    return {
      id: `fastest_1k_${activity.id}_${activity.date}`,
      type: 'fastest_1k',
      distance: '5K', // Using 5K as the reference distance type
      value: estimated1KTime,
      pace: estimatedPace,
      date: activity.date!,
      activityId: activity.id,
      previousRecord: currentBest === Infinity ? undefined : currentBest,
      improvement: improvement || undefined,
      improvementPercent: improvementPercent || undefined,
      confidence: activity.distance >= 5000 ? 'medium' : 'low' // More confident with longer runs
    }
  }
  
  return null
}

function detectLongestRun(activity: SimpleActivity, existingLongestPR?: PRHistory): PRData | null {
  if (!activity.distance || !activity.date) return null
  
  const currentLongest = existingLongestPR?.currentPR?.value || 0
  
  if (activity.distance > currentLongest) {
    const improvement = activity.distance - currentLongest
    const improvementPercent = currentLongest > 0 ? (improvement / currentLongest) * 100 : 0
    
    return {
      id: `longest_run_${activity.id}_${activity.date}`,
      type: 'longest_run',
      distance: 'longest_run',
      value: activity.distance,
      date: activity.date,
      activityId: activity.id,
      previousRecord: currentLongest || undefined,
      improvement: improvement || undefined,
      improvementPercent: improvementPercent || undefined,
      confidence: 'high'
    }
  }
  
  return null
}

function detectMostElevation(activity: SimpleActivity, existingElevationPR?: PRHistory): PRData | null {
  if (!activity.elevationGain || !activity.date) return null
  
  const currentMost = existingElevationPR?.currentPR?.value || 0
  
  if (activity.elevationGain > currentMost) {
    const improvement = activity.elevationGain - currentMost
    const improvementPercent = currentMost > 0 ? (improvement / currentMost) * 100 : 0
    
    return {
      id: `elevation_${activity.id}_${activity.date}`,
      type: 'most_elevation_gain',
      distance: 'elevation',
      value: activity.elevationGain,
      date: activity.date,
      activityId: activity.id,
      previousRecord: currentMost || undefined,
      improvement: improvement || undefined,
      improvementPercent: improvementPercent || undefined,
      confidence: 'high'
    }
  }
  
  return null
}

function calculateConfidence(activity: SimpleActivity): 'high' | 'medium' | 'low' {
  // Factors that increase confidence:
  // - GPS track data available
  // - Reasonable pace (not too fast/slow)
  // - Complete data (duration, distance, etc.)
  
  let confidenceScore = 0
  
  // Has GPS data
  if (activity.trackPoints && activity.trackPoints.length > 0) {
    confidenceScore += 3
  }
  
  // Has complete basic data
  if (activity.distance && activity.duration && activity.date) {
    confidenceScore += 2
  }
  
  // Reasonable pace check (3:00-8:00 min/km for most running activities)
  if (activity.distance && activity.duration) {
    const paceMinPerKm = (activity.duration / 60) / (activity.distance / 1000)
    if (paceMinPerKm >= 3 && paceMinPerKm <= 8) {
      confidenceScore += 2
    }
  }
  
  // Heart rate data available
  if (activity.avgHr && activity.avgHr > 0) {
    confidenceScore += 1
  }
  
  if (confidenceScore >= 6) return 'high'
  if (confidenceScore >= 4) return 'medium'
  return 'low'
}

function extractConditions(activity: SimpleActivity): PRData['conditions'] {
  // Extract environmental conditions if available
  // This would need to be enhanced based on actual activity data structure
  return {
    course: 'unknown',
    surface: 'road' // default assumption
  }
}

// PR Analysis Functions

export function analyzePRProgress(prHistories: PRHistory[]): PRAnalysis {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  
  const recentPRs = prHistories.flatMap(history => 
    history.records.filter(record => new Date(record.date) >= ninetyDaysAgo)
  )
  
  const prs30Days = recentPRs.filter(pr => new Date(pr.date) >= thirtyDaysAgo)
  const significantImprovements = recentPRs.filter(pr => 
    pr.improvementPercent && pr.improvementPercent > 5
  )
  
  const averageImprovement = recentPRs.length > 0 
    ? recentPRs.reduce((sum, pr) => sum + (pr.improvementPercent || 0), 0) / recentPRs.length
    : 0
  
  // Injury risk assessment
  const rapidImprovement = significantImprovements.length >= 3 && prs30Days.length >= 2
  const frequentPRs = prs30Days.length >= 4
  
  let riskScore = 0
  const warnings: string[] = []
  
  if (rapidImprovement) {
    riskScore += 40
    warnings.push('Multiple significant improvements detected - monitor for overtraining')
  }
  
  if (frequentPRs) {
    riskScore += 30
    warnings.push('High frequency of PRs - ensure adequate recovery')
  }
  
  if (averageImprovement > 10) {
    riskScore += 30
    warnings.push('Very rapid pace improvements - risk of injury if not managed carefully')
  }
  
  return {
    recentPRs,
    improvements: {
      count30Days: prs30Days.length,
      count90Days: recentPRs.length,
      averageImprovement,
      significantImprovements
    },
    injuryRiskFactors: {
      rapidImprovement,
      frequentPRs,
      riskScore: Math.min(riskScore, 100),
      warnings
    },
    potentialPRs: [] // This would be filled by prediction algorithms
  }
}

export function buildPRHistories(allPRs: PRData[]): PRHistory[] {
  const histories = new Map<PRType, PRHistory>()
  
  // Group PRs by type
  for (const pr of allPRs) {
    if (!histories.has(pr.type)) {
      histories.set(pr.type, {
        type: pr.type,
        records: [],
        improvementTrend: 'stable'
      })
    }
    
    histories.get(pr.type)!.records.push(pr)
  }
  
  // Process each history
  for (const [type, history] of histories.entries()) {
    // Sort records by date
    history.records.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    // Set current and previous PRs
    history.currentPR = history.records[history.records.length - 1]
    history.previousPR = history.records.length > 1 ? history.records[history.records.length - 2] : undefined
    
    // Calculate improvement trends
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    
    const recent30 = history.records.filter(r => new Date(r.date) >= thirtyDaysAgo)
    const recent90 = history.records.filter(r => new Date(r.date) >= ninetyDaysAgo)
    
    history.improvement30Days = recent30.reduce((sum, r) => sum + (r.improvementPercent || 0), 0)
    history.improvement90Days = recent90.reduce((sum, r) => sum + (r.improvementPercent || 0), 0)
    
    // Determine trend
    if (history.improvement30Days > 2) {
      history.improvementTrend = 'improving'
    } else if (history.improvement30Days < -2) {
      history.improvementTrend = 'declining'
    } else {
      history.improvementTrend = 'stable'
    }
  }
  
  return Array.from(histories.values())
}

// Utility functions for display and formatting

export function formatPRTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.floor(secondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`
  } else {
    return `${meters}m`
  }
}

export function getPRIcon(type: PRType): string {
  switch (type) {
    case 'fastest_1k': return '⚡'
    case 'fastest_5k': return '🏃'
    case 'fastest_10k': return '🏃‍♂️'
    case 'fastest_half_marathon': return '🏃‍♀️'
    case 'fastest_marathon': return '🏆'
    case 'longest_run': return '🦌'
    case 'most_weekly_volume': return '📊'
    case 'most_elevation_gain': return '⛰️'
    default: return '🏅'
  }
}

export function getPRDisplayName(type: PRType): string {
  switch (type) {
    case 'fastest_1k': return 'Fastest 1K'
    case 'fastest_5k': return 'Fastest 5K'
    case 'fastest_10k': return 'Fastest 10K'
    case 'fastest_half_marathon': return 'Fastest Half Marathon'
    case 'fastest_marathon': return 'Fastest Marathon'
    case 'longest_run': return 'Longest Run'
    case 'most_weekly_volume': return 'Most Weekly Volume'
    case 'most_elevation_gain': return 'Most Elevation Gain'
    default: return 'Personal Record'
  }
}