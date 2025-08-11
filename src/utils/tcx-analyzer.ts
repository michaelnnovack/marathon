/**
 * Advanced TCX Analysis Tool for Running Performance
 * Provides detailed running analytics including pace, HR zones, elevation, and marathon insights
 */

export interface TCXTrackPoint {
  timestamp: Date
  lat?: number
  lng?: number
  altitude?: number
  heartRate?: number
  distanceFromStart: number // Calculated haversine distance
  speed?: number // m/s calculated from GPS
  grade?: number // Percentage grade
}

export interface KilometerSplit {
  km: number
  time: number // seconds for this km
  pace: number // min/km
  avgHR?: number
  elevationGain: number
  elevationLoss: number
  avgGrade: number
}

export interface HeartRateZoneTime {
  zone: number
  name: string
  minHR: number
  maxHR: number
  timeSeconds: number
  percentage: number
}

export interface PaceDriftAnalysis {
  firstHalfAvgPace: number // min/km
  secondHalfAvgPace: number // min/km
  paceDecline: number // seconds per km slower
  firstHalfAvgHR: number
  secondHalfAvgHR: number
  hrDrift: number // BPM increase
  efficiencyLoss: number // HR increase per pace decline
}

export interface TCXAnalysis {
  // Basic metrics
  totalDistance: number // km
  totalDuration: number // seconds
  avgPace: number // min/km
  avgHR?: number
  maxHR?: number
  
  // Detailed analysis
  trackPoints: TCXTrackPoint[]
  kilometerSplits: KilometerSplit[]
  heartRateZones: HeartRateZoneTime[]
  paceDrift: PaceDriftAnalysis
  
  // Elevation
  totalElevationGain: number // meters
  totalElevationLoss: number // meters
  gradeAdjustedPace: number // min/km (estimated)
  
  // Performance metrics
  negativeSplit: boolean
  paceConsistency: number // CV of km splits
  estimatedTSS: number // Training Stress Score
  
  // Marathon insights
  marathonInsights: {
    targetMarathonPace?: number // min/km if provided
    paceComparison?: string
    enduranceAssessment: string
    pacingControl: string
    fatigueIndicators: string[]
    recommendations: string[]
  }
}

/**
 * Calculate haversine distance between two GPS coordinates
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lng2 - lng1) * Math.PI / 180

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c
}

/**
 * Calculate grade percentage between two points
 */
function calculateGrade(elevationGain: number, distance: number): number {
  if (distance === 0) return 0
  return (elevationGain / distance) * 100
}

/**
 * Estimate grade-adjusted pace using a simplified model
 * Uphill: +10s per km per 1% grade, Downhill: -5s per km per 1% grade
 */
function gradeAdjustPace(paceSeconds: number, grade: number): number {
  if (grade > 0) {
    // Uphill - add time
    return paceSeconds + (grade * 10)
  } else {
    // Downhill - subtract time (but less benefit)
    return paceSeconds + (grade * 5) // grade is negative, so this subtracts
  }
}

/**
 * Calculate heart rate zones based on max HR
 */
function calculateHRZones(maxHR: number): Array<{zone: number, name: string, min: number, max: number}> {
  return [
    { zone: 1, name: 'Recovery', min: Math.round(maxHR * 0.5), max: Math.round(maxHR * 0.6) },
    { zone: 2, name: 'Aerobic Base', min: Math.round(maxHR * 0.6), max: Math.round(maxHR * 0.7) },
    { zone: 3, name: 'Aerobic', min: Math.round(maxHR * 0.7), max: Math.round(maxHR * 0.8) },
    { zone: 4, name: 'Lactate Threshold', min: Math.round(maxHR * 0.8), max: Math.round(maxHR * 0.9) },
    { zone: 5, name: 'VO2 Max', min: Math.round(maxHR * 0.9), max: maxHR }
  ]
}

/**
 * Estimate Training Stress Score (TSS) from heart rate and duration
 * Simplified model based on HR zones and time
 */
function calculateTSS(heartRateZones: HeartRateZoneTime[], durationHours: number): number {
  const zoneMultipliers = [0.5, 0.65, 0.8, 1.0, 1.2] // TSS multiplier for each zone
  
  let totalTSS = 0
  heartRateZones.forEach((zone, index) => {
    const zoneHours = zone.timeSeconds / 3600
    const zoneTSS = zoneHours * 100 * zoneMultipliers[index] // 100 = normalized TSS per hour at threshold
    totalTSS += zoneTSS
  })
  
  return Math.round(totalTSS)
}

/**
 * Parse TCX file and perform comprehensive analysis
 */
export async function analyzeTCX(file: File, targetMarathonPace?: number): Promise<TCXAnalysis> {
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')
  
  const trackPoints: TCXTrackPoint[] = []
  const points = doc.querySelectorAll('Trackpoint')
  
  // Parse all track points
  points.forEach((point, index) => {
    const timeEl = point.querySelector('Time')
    const posEl = point.querySelector('Position')
    const altEl = point.querySelector('AltitudeMeters')
    const hrEl = point.querySelector('HeartRateBpm Value')
    
    if (!timeEl) return
    
    const trackPoint: TCXTrackPoint = {
      timestamp: new Date(timeEl.textContent!),
      distanceFromStart: 0,
      lat: posEl?.querySelector('LatitudeDegrees')?.textContent ? 
        parseFloat(posEl.querySelector('LatitudeDegrees')!.textContent!) : undefined,
      lng: posEl?.querySelector('LongitudeDegrees')?.textContent ? 
        parseFloat(posEl.querySelector('LongitudeDegrees')!.textContent!) : undefined,
      altitude: altEl?.textContent ? parseFloat(altEl.textContent) : undefined,
      heartRate: hrEl?.textContent ? parseInt(hrEl.textContent) : undefined
    }
    
    // Calculate distance from previous point
    if (index > 0 && trackPoint.lat && trackPoint.lng) {
      const prevPoint = trackPoints[trackPoints.length - 1]
      if (prevPoint.lat && prevPoint.lng) {
        const distance = haversineDistance(
          prevPoint.lat, prevPoint.lng,
          trackPoint.lat, trackPoint.lng
        )
        trackPoint.distanceFromStart = prevPoint.distanceFromStart + distance
        
        // Calculate speed (m/s) and grade
        const timeDiff = (trackPoint.timestamp.getTime() - prevPoint.timestamp.getTime()) / 1000
        if (timeDiff > 0) {
          trackPoint.speed = distance / timeDiff
          
          if (trackPoint.altitude && prevPoint.altitude) {
            const elevationDiff = trackPoint.altitude - prevPoint.altitude
            trackPoint.grade = calculateGrade(elevationDiff, distance)
          }
        }
      }
    }
    
    trackPoints.push(trackPoint)
  })
  
  if (trackPoints.length < 2) {
    throw new Error('Insufficient track points for analysis')
  }
  
  // Calculate basic metrics
  const totalDistance = trackPoints[trackPoints.length - 1].distanceFromStart / 1000 // km
  const totalDuration = (trackPoints[trackPoints.length - 1].timestamp.getTime() - 
                        trackPoints[0].timestamp.getTime()) / 1000 // seconds
  const avgPace = (totalDuration / 60) / totalDistance // min/km
  
  const heartRates = trackPoints.filter(p => p.heartRate).map(p => p.heartRate!)
  const avgHR = heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : undefined
  const maxHR = heartRates.length > 0 ? Math.max(...heartRates) : undefined
  
  // Generate kilometer splits
  const kilometerSplits: KilometerSplit[] = []
  for (let km = 1; km <= Math.floor(totalDistance); km++) {
    const kmStart = trackPoints.find(p => p.distanceFromStart >= (km - 1) * 1000)
    const kmEnd = trackPoints.find(p => p.distanceFromStart >= km * 1000)
    
    if (kmStart && kmEnd) {
      const splitDuration = (kmEnd.timestamp.getTime() - kmStart.timestamp.getTime()) / 1000
      const splitPace = splitDuration / 60 // min/km
      
      // Calculate HR and elevation for this split
      const splitPoints = trackPoints.filter(p => 
        p.distanceFromStart >= (km - 1) * 1000 && p.distanceFromStart < km * 1000
      )
      
      const splitHRs = splitPoints.filter(p => p.heartRate).map(p => p.heartRate!)
      const splitAvgHR = splitHRs.length > 0 ? splitHRs.reduce((a, b) => a + b, 0) / splitHRs.length : undefined
      
      // Elevation analysis
      let elevationGain = 0
      let elevationLoss = 0
      let totalGrade = 0
      let gradeCount = 0
      
      for (let i = 1; i < splitPoints.length; i++) {
        if (splitPoints[i].altitude && splitPoints[i-1].altitude) {
          const elevDiff = splitPoints[i].altitude! - splitPoints[i-1].altitude!
          if (elevDiff > 0) elevationGain += elevDiff
          else elevationLoss += Math.abs(elevDiff)
          
          if (splitPoints[i].grade) {
            totalGrade += splitPoints[i].grade!
            gradeCount++
          }
        }
      }
      
      kilometerSplits.push({
        km,
        time: splitDuration,
        pace: splitPace,
        avgHR: splitAvgHR,
        elevationGain,
        elevationLoss,
        avgGrade: gradeCount > 0 ? totalGrade / gradeCount : 0
      })
    }
  }
  
  // Heart rate zone analysis
  let heartRateZones: HeartRateZoneTime[] = []
  if (maxHR) {
    const zones = calculateHRZones(maxHR)
    const zoneTimes = new Array(5).fill(0)
    
    // Count time in each zone
    for (let i = 1; i < trackPoints.length; i++) {
      const point = trackPoints[i]
      const prevPoint = trackPoints[i - 1]
      
      if (point.heartRate && prevPoint.heartRate) {
        const timeDiff = (point.timestamp.getTime() - prevPoint.timestamp.getTime()) / 1000
        const avgHR = (point.heartRate + prevPoint.heartRate) / 2
        
        const zoneIndex = zones.findIndex(z => avgHR >= z.min && avgHR <= z.max)
        if (zoneIndex >= 0) {
          zoneTimes[zoneIndex] += timeDiff
        }
      }
    }
    
    heartRateZones = zones.map((zone, index) => ({
      zone: zone.zone,
      name: zone.name,
      minHR: zone.min,
      maxHR: zone.max,
      timeSeconds: zoneTimes[index],
      percentage: (zoneTimes[index] / totalDuration) * 100
    }))
  }
  
  // Pace drift analysis
  const midpoint = Math.floor(kilometerSplits.length / 2)
  const firstHalf = kilometerSplits.slice(0, midpoint)
  const secondHalf = kilometerSplits.slice(midpoint)
  
  const firstHalfAvgPace = firstHalf.reduce((sum, split) => sum + split.pace, 0) / firstHalf.length
  const secondHalfAvgPace = secondHalf.reduce((sum, split) => sum + split.pace, 0) / secondHalf.length
  
  const firstHalfHRs = firstHalf.filter(s => s.avgHR).map(s => s.avgHR!)
  const secondHalfHRs = secondHalf.filter(s => s.avgHR).map(s => s.avgHR!)
  
  const firstHalfAvgHR = firstHalfHRs.length > 0 ? 
    firstHalfHRs.reduce((a, b) => a + b, 0) / firstHalfHRs.length : 0
  const secondHalfAvgHR = secondHalfHRs.length > 0 ? 
    secondHalfHRs.reduce((a, b) => a + b, 0) / secondHalfHRs.length : 0
  
  const paceDrift: PaceDriftAnalysis = {
    firstHalfAvgPace,
    secondHalfAvgPace,
    paceDecline: (secondHalfAvgPace - firstHalfAvgPace) * 60, // seconds per km
    firstHalfAvgHR,
    secondHalfAvgHR,
    hrDrift: secondHalfAvgHR - firstHalfAvgHR,
    efficiencyLoss: firstHalfAvgHR > 0 ? 
      (secondHalfAvgHR - firstHalfAvgHR) / Math.max(0.1, (secondHalfAvgPace - firstHalfAvgPace) * 60) : 0
  }
  
  // Elevation calculations
  const totalElevationGain = kilometerSplits.reduce((sum, split) => sum + split.elevationGain, 0)
  const totalElevationLoss = kilometerSplits.reduce((sum, split) => sum + split.elevationLoss, 0)
  
  // Grade-adjusted pace (simplified)
  const avgGrade = kilometerSplits.reduce((sum, split) => sum + Math.abs(split.avgGrade), 0) / kilometerSplits.length
  const gradeAdjustedPace = avgPace - (avgGrade * 0.1) // Rough adjustment: 6s per km per 1% grade
  
  // Performance metrics
  const negativeSplit = secondHalfAvgPace < firstHalfAvgPace
  const paceCV = kilometerSplits.length > 0 ? 
    Math.sqrt(kilometerSplits.reduce((sum, split) => sum + Math.pow(split.pace - avgPace, 2), 0) / kilometerSplits.length) / avgPace : 0
  
  const estimatedTSS = calculateTSS(heartRateZones, totalDuration / 3600)
  
  // Generate marathon insights
  const marathonInsights = generateMarathonInsights({
    totalDistance,
    avgPace,
    targetMarathonPace,
    paceDrift,
    kilometerSplits,
    heartRateZones,
    negativeSplit,
    paceConsistency: paceCV,
    totalElevationGain
  })
  
  return {
    totalDistance,
    totalDuration,
    avgPace,
    avgHR,
    maxHR,
    trackPoints,
    kilometerSplits,
    heartRateZones,
    paceDrift,
    totalElevationGain,
    totalElevationLoss,
    gradeAdjustedPace,
    negativeSplit,
    paceConsistency: paceCV,
    estimatedTSS,
    marathonInsights
  }
}

/**
 * Generate marathon-specific coaching insights
 */
function generateMarathonInsights(data: {
  totalDistance: number
  avgPace: number
  targetMarathonPace?: number
  paceDrift: PaceDriftAnalysis
  kilometerSplits: KilometerSplit[]
  heartRateZones: HeartRateZoneTime[]
  negativeSplit: boolean
  paceConsistency: number
  totalElevationGain: number
}): TCXAnalysis['marathonInsights'] {
  const insights = {
    enduranceAssessment: '',
    pacingControl: '',
    fatigueIndicators: [] as string[],
    recommendations: [] as string[]
  }
  
  // Pace comparison with marathon target
  let paceComparison = ''
  if (data.targetMarathonPace) {
    const paceSeconds = data.avgPace * 60
    const targetSeconds = data.targetMarathonPace * 60
    const diff = paceSeconds - targetSeconds
    
    if (Math.abs(diff) < 5) {
      paceComparison = `Perfect! Average pace within 5s of target marathon pace`
    } else if (diff < -15) {
      paceComparison = `Too fast! ${Math.abs(diff)}s per km faster than target - risk of burning out`
    } else if (diff > 30) {
      paceComparison = `Too slow! ${diff}s per km slower than target - may need fitness work`
    } else {
      paceComparison = `Close to target (${diff > 0 ? '+' : ''}${Math.round(diff)}s/km)`
    }
  }
  
  // Endurance assessment based on HR drift and pace consistency
  if (data.paceDrift.hrDrift < 5) {
    insights.enduranceAssessment = 'Excellent endurance - HR remained stable throughout'
  } else if (data.paceDrift.hrDrift < 10) {
    insights.enduranceAssessment = 'Good endurance - minimal HR drift observed'
  } else if (data.paceDrift.hrDrift < 15) {
    insights.enduranceAssessment = 'Moderate endurance - noticeable HR drift in second half'
  } else {
    insights.enduranceAssessment = 'Endurance needs work - significant HR drift (>15 BPM)'
  }
  
  // Pacing control assessment
  if (data.paceConsistency < 0.05) {
    insights.pacingControl = 'Exceptional pacing control - very consistent splits'
  } else if (data.paceConsistency < 0.1) {
    insights.pacingControl = 'Good pacing control - reasonably consistent'
  } else {
    insights.pacingControl = 'Poor pacing control - inconsistent splits'
  }
  
  // Fatigue indicators
  if (data.paceDrift.paceDecline > 15) {
    insights.fatigueIndicators.push('Significant pace decline in second half')
  }
  if (data.paceDrift.hrDrift > 10) {
    insights.fatigueIndicators.push('Heart rate drift indicates fatigue')
  }
  if (data.paceDrift.efficiencyLoss > 2) {
    insights.fatigueIndicators.push('Poor running efficiency in later stages')
  }
  
  // Recommendations
  if (data.paceDrift.hrDrift > 10) {
    insights.recommendations.push('Focus on aerobic base building to improve endurance')
  }
  if (data.paceConsistency > 0.1) {
    insights.recommendations.push('Practice even pacing in training runs')
  }
  if (!data.negativeSplit && data.paceDrift.paceDecline > 10) {
    insights.recommendations.push('Start more conservatively to maintain pace in second half')
  }
  if (data.totalElevationGain > 100) {
    insights.recommendations.push('Include hill training to improve strength on elevation')
  }
  
  return {
    targetMarathonPace: data.targetMarathonPace,
    paceComparison,
    ...insights
  }
}

/**
 * Format pace from min/km to MM:SS format
 */
export function formatPace(paceMinPerKm: number): string {
  const minutes = Math.floor(paceMinPerKm)
  const seconds = Math.round((paceMinPerKm - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format time from seconds to HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
}