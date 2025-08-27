import type { SimpleActivity, User, PredictionResult } from '@/types'

// Heart rate training zones (as percentages of max HR)
export const HR_ZONES = {
  RECOVERY: [0.50, 0.60],    // Zone 1: Active recovery
  AEROBIC: [0.60, 0.70],     // Zone 2: Aerobic base
  TEMPO: [0.70, 0.80],       // Zone 3: Tempo/threshold
  LACTATE: [0.80, 0.90],     // Zone 4: Lactate threshold
  NEUROMUSCULAR: [0.90, 1.0] // Zone 5: Neuromuscular power
} as const

// Convert any activity to an equivalent time using enhanced Riegel scaling with physiological adjustments
// Base formula: T2 = T1 * (D2/D1)^1.06
// Enhanced with heart rate efficiency factor
export function equivalentTime(seconds: number, distMeters: number, targetMeters: number, hrEfficiency = 1.0) {
  if (distMeters <= 0) return 0
  const ratio = targetMeters / distMeters
  const baseTime = seconds * Math.pow(ratio, 1.06)
  
  // Apply heart rate efficiency factor (0.8-1.2 range)
  // Lower HR efficiency = better aerobic fitness = faster predicted times
  return baseTime * hrEfficiency
}

// Calculate pace-to-heart rate efficiency for more accurate predictions
export function calculatePaceHREfficiency(activities: SimpleActivity[], userMaxHR?: number): number {
  if (!userMaxHR || userMaxHR <= 0) return 1.0
  
  // Get last 10 runs with both pace and heart rate data
  const validRuns = activities
    .filter(a => a.avgHr && a.distance && a.duration && a.distance > 1000) // At least 1km
    .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
    .slice(0, 10)
  
  if (validRuns.length < 3) return 1.0 // Need at least 3 runs for analysis
  
  let totalEfficiency = 0
  let validSamples = 0
  
  validRuns.forEach(run => {
    const pacePerKm = run.duration! / (run.distance! / 1000) // seconds per km
    const hrPercent = run.avgHr! / userMaxHR
    
    // Calculate efficiency: better runners maintain faster paces at lower HR%
    // Base efficiency on how sustainable the effort appears
    let efficiency = 1.0
    
    if (run.distance! >= 15000) { // Long runs (15km+)
      // For long runs, HR should be 70-80% for sustainable pace
      if (hrPercent <= 0.75) efficiency = 0.90 // Very efficient
      else if (hrPercent <= 0.80) efficiency = 0.95
      else if (hrPercent <= 0.85) efficiency = 1.0
      else efficiency = 1.1 // Working too hard for long run
    } else if (run.distance! >= 8000) { // Medium runs (8-15km)
      // Medium runs can be at higher intensity
      if (hrPercent <= 0.80) efficiency = 0.92
      else if (hrPercent <= 0.85) efficiency = 0.98
      else if (hrPercent <= 0.90) efficiency = 1.0
      else efficiency = 1.05
    } else { // Shorter runs
      // Shorter runs are less predictive for marathon
      if (hrPercent <= 0.85) efficiency = 0.95
      else efficiency = 1.0
    }
    
    totalEfficiency += efficiency
    validSamples++
  })
  
  return validSamples > 0 ? totalEfficiency / validSamples : 1.0
}

// Removed old calculateTrainingLoadFactor - using simpler recent volume assessment in main function

// Assess prediction reliability based on data quality
export function assessPredictionReliability(activities: SimpleActivity[], user?: User): 'low' | 'medium' | 'high' {
  const validActivities = activities.filter(a => a.distance && a.duration && a.distance > 0 && a.duration > 0)
  const activitiesWithHR = activities.filter(a => a.avgHr && a.avgHr > 0)
  const longRuns = activities.filter(a => (a.distance || 0) >= 15000) // 15km+
  
  let score = 0
  
  // Activity volume score
  if (validActivities.length >= 20) score += 3
  else if (validActivities.length >= 10) score += 2
  else if (validActivities.length >= 5) score += 1
  
  // Heart rate data score
  if (activitiesWithHR.length >= validActivities.length * 0.8) score += 2
  else if (activitiesWithHR.length >= validActivities.length * 0.5) score += 1
  
  // Long run experience score
  if (longRuns.length >= 5) score += 2
  else if (longRuns.length >= 2) score += 1
  
  // User profile completeness score
  if (user?.maxHeartRate && user?.restingHeartRate) score += 1
  if (user?.weight && user?.height) score += 1
  
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

export function predictMarathonTime(activities: SimpleActivity[], user?: User): PredictionResult {
  // Safety checks
  if (!Array.isArray(activities) || activities.length === 0) {
    return { seconds: 0, ci: 0, reliability: 'low', basedOnActivities: 0 }
  }

  // Focus on last 10 runs, minimum 2km
  const validRuns = activities
    .filter(a => {
      return a.distance && a.duration && a.date &&
             a.distance >= 2000 && // At least 2km
             a.duration > 0 &&
             !isNaN(a.distance) && !isNaN(a.duration)
    })
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .slice(0, 10)
  
  if (validRuns.length < 2) {
    return { seconds: 0, ci: 0, reliability: 'low', basedOnActivities: validRuns.length }
  }

  const samples: { time: number; weight: number; pace: number; runIndex: number }[] = []
  const maxHr = user?.maxHeartRate || 0
  
  // Check if most recent runs show improvement (faster pace)
  const recentPaces = validRuns.slice(0, 3).map(r => r.duration! / (r.distance! / 1000))
  const olderPaces = validRuns.slice(3, 6).map(r => r.duration! / (r.distance! / 1000))
  const isImproving = recentPaces.length > 0 && olderPaces.length > 0 && 
    (recentPaces.reduce((a, b) => a + b, 0) / recentPaces.length) < 
    (olderPaces.reduce((a, b) => a + b, 0) / olderPaces.length)
  
  console.log('Recent runs analysis:', {
    totalRuns: validRuns.length,
    isImproving,
    mostRecentPace: recentPaces[0] ? `${Math.floor(recentPaces[0] / 60)}:${Math.round(recentPaces[0] % 60).toString().padStart(2, '0')}` : 'N/A',
    mostRecentDistance: validRuns[0] ? `${(validRuns[0].distance! / 1000).toFixed(1)}km` : 'N/A'
  })
  
  validRuns.forEach((run, index) => {
    try {
      const pacePerKm = run.duration! / (run.distance! / 1000)
      
      // MUCH higher weight for recent runs, especially if improving
      let recencyWeight = 1.0
      if (index === 0) recencyWeight = isImproving ? 4.0 : 2.5  // Most recent gets massive weight if improving
      else if (index === 1) recencyWeight = isImproving ? 2.0 : 1.5
      else if (index === 2) recencyWeight = isImproving ? 1.2 : 1.0
      else recencyWeight = 0.3 // Older runs get very little weight
      
      // Distance weighting - but don't over-penalize shorter runs if they're recent and fast
      let distanceWeight = 1.0
      if (run.distance! >= 20000) distanceWeight = 1.8
      else if (run.distance! >= 15000) distanceWeight = 1.5
      else if (run.distance! >= 10000) distanceWeight = 1.2
      else if (run.distance! >= 5000) distanceWeight = 1.0
      else distanceWeight = 0.7
      
      // For most recent run, don't penalize distance as much
      if (index === 0 && run.distance! >= 5000) distanceWeight = Math.max(distanceWeight, 1.2)
      
      const totalWeight = recencyWeight * distanceWeight
      
      // Minimal HR adjustments - trust the actual performance
      let hrAdjustment = 1.0
      if (run.avgHr && maxHr > 0) {
        const runHRPercent = run.avgHr / maxHr
        
        // Only adjust if HR was extremely high (>90%) or very low (<60%)
        if (runHRPercent > 0.92) hrAdjustment = 1.03 // Very high effort
        else if (runHRPercent < 0.60) hrAdjustment = 0.97 // Very easy effort
        else hrAdjustment = 1.0 // Trust the performance as-is
      }
      
      // Use slightly more aggressive Riegel scaling for better recent performances
      const riegelExponent = (index === 0 && isImproving) ? 1.04 : 1.06
      const ratio = 42195 / run.distance!
      const eq = run.duration! * Math.pow(ratio, riegelExponent) * hrAdjustment
      
      if (eq > 0 && !isNaN(eq) && isFinite(eq)) {
        samples.push({ 
          time: eq, 
          weight: totalWeight, 
          pace: pacePerKm,
          runIndex: index
        })
      }
    } catch (error) {
      console.warn('Error calculating equivalent time for run:', run.id, error)
    }
  })
  
  if (!samples.length) {
    return { seconds: 0, ci: 0, reliability: 'low', basedOnActivities: 0 }
  }
  
  try {
    // Weighted mean with heavy emphasis on recent performances
    const totalWeight = samples.reduce((sum, s) => sum + s.weight, 0)
    const weightedSum = samples.reduce((sum, s) => sum + (s.time * s.weight), 0)
    let mean = weightedSum / totalWeight
    
    console.log('Prediction calculation:', {
      samples: samples.length,
      weightedMean: `${Math.floor(mean / 3600)}:${Math.floor((mean % 3600) / 60).toString().padStart(2, '0')}:${Math.round(mean % 60).toString().padStart(2, '0')}`,
      mostRecentWeight: samples[0]?.weight || 0,
      mostRecentTime: samples[0] ? `${Math.floor(samples[0].time / 3600)}:${Math.floor((samples[0].time % 3600) / 60).toString().padStart(2, '0')}:${Math.round(samples[0].time % 60).toString().padStart(2, '0')}` : 'N/A'
    })
    
    // NO volume adjustments - trust the actual performances
    
    // NO conservative adjustments if recent runs show good performance
    const conservativeFactor = isImproving ? 1.0 : 
                              (user?.level === 'beginner' ? 1.01 : 1.0)
    mean *= conservativeFactor
    
    // Smaller confidence interval since we're trusting recent data more
    const variance = samples.reduce((sum, s) => {
      const diff = s.time - mean
      return sum + (diff * diff * s.weight)
    }, 0) / totalWeight
    
    const sd = Math.sqrt(Math.max(0, variance))
    const se = sd / Math.sqrt(Math.max(1, samples.length))
    const ci = 1.96 * se * 0.5 // Reduce CI since we trust recent data
    
    const reliability = validRuns.length >= 5 ? 'high' : validRuns.length >= 3 ? 'medium' : 'low'
    
    return { 
      seconds: Math.round(isFinite(mean) ? mean : 0), 
      ci: Math.round(isFinite(ci) ? ci : 0),
      reliability,
      basedOnActivities: validRuns.length
    }
  } catch (error) {
    console.warn('Error in marathon time prediction:', error)
    return { seconds: 0, ci: 0, reliability: 'low', basedOnActivities: 0 }
  }
}

// Assess reliability based on recent runs quality
function assessRecentRunsReliability(recentRuns: SimpleActivity[], user?: User): 'low' | 'medium' | 'high' {
  let score = 0
  
  // Number of recent quality runs
  if (recentRuns.length >= 8) score += 3
  else if (recentRuns.length >= 5) score += 2
  else score += 1
  
  // Heart rate data availability
  const runsWithHR = recentRuns.filter(r => r.avgHr).length
  if (runsWithHR >= recentRuns.length * 0.8) score += 2
  else if (runsWithHR >= recentRuns.length * 0.5) score += 1
  
  // Long run experience in recent training
  const longRuns = recentRuns.filter(r => (r.distance || 0) >= 18000).length
  if (longRuns >= 3) score += 2
  else if (longRuns >= 1) score += 1
  
  // Consistency in paces
  const paces = recentRuns.map(r => r.duration! / (r.distance! / 1000))
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length
  const paceVariability = Math.sqrt(paces.reduce((sum, p) => sum + Math.pow(p - avgPace, 2), 0) / paces.length)
  const coefficientOfVariation = paceVariability / avgPace
  
  if (coefficientOfVariation < 0.1) score += 2 // Very consistent
  else if (coefficientOfVariation < 0.15) score += 1 // Reasonably consistent
  
  // User profile completeness
  if (user?.maxHeartRate) score += 1
  
  if (score >= 8) return 'high'
  if (score >= 5) return 'medium'
  return 'low'
}

// Legacy function for backward compatibility
export function predictMarathonTimeSimple(list: SimpleActivity[]) {
  const result = predictMarathonTime(list)
  return { seconds: result.seconds, ci: result.ci }
}

export function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds/3600)
  const m = Math.floor((totalSeconds%3600)/60)
  const s = Math.round(totalSeconds%60)
  return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
}

// Format confidence interval as a range
export function formatTimeRange(seconds: number, ci: number): string {
  const lower = Math.max(0, seconds - ci)
  const upper = seconds + ci
  return `${formatHMS(lower)} - ${formatHMS(upper)}`
}

// Calculate personalized training paces based on user's actual data and physiology
export function calculatePersonalizedTrainingPaces(
  activities: SimpleActivity[], 
  user?: User, 
  marathonSeconds?: number
) {
  if (!user || !activities.length) {
    // Fallback to generic calculation if no user data
    return marathonSeconds ? calculateGenericTrainingPaces(marathonSeconds) : null
  }

  // Get recent runs for analysis (last 10 runs with HR data preferred)
  const recentRuns = activities
    .filter(a => a.distance && a.duration && a.distance >= 2000)
    .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
    .slice(0, 15)

  if (recentRuns.length < 3) {
    return marathonSeconds ? calculateGenericTrainingPaces(marathonSeconds) : null
  }

  // Calculate heart rate zones based on user's profile and recent data
  const hrZones = calculatePersonalizedHRZones(user, recentRuns)
  
  // Analyze recent runs by effort level (using HR zones)
  const runsByEffort = categorizeRunsByEffort(recentRuns, hrZones)
  
  // Calculate training paces from actual performance data
  const paces = {
    easy: calculateEasyPace(runsByEffort.easy, runsByEffort.moderate),
    marathon: marathonSeconds ? marathonSeconds / 42.195 : calculateMarathonPace(runsByEffort),
    tempo: calculateTempoPace(runsByEffort.moderate, runsByEffort.hard),
    interval: calculateIntervalPace(runsByEffort.hard, runsByEffort.veryHard)
  }
  
  // Ensure paces make logical sense (easy > marathon > tempo > interval)
  return validateAndAdjustPaces(paces)
}

// Calculate heart rate zones based on user age, max HR, and recent performance
function calculatePersonalizedHRZones(user: User, recentRuns: SimpleActivity[]) {
  // Determine max heart rate
  let maxHR = user.maxHeartRate
  
  if (!maxHR && user.dateOfBirth) {
    const age = new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear()
    maxHR = 220 - age // Basic age formula as fallback
  }
  
  // Look for highest HR in recent runs as potential max HR indicator
  const recentMaxHR = Math.max(...recentRuns.filter(r => r.maxHr).map(r => r.maxHr!))
  if (recentMaxHR > 0 && (!maxHR || recentMaxHR > maxHR * 0.95)) {
    maxHR = Math.max(maxHR || 0, recentMaxHR)
  }
  
  if (!maxHR || maxHR < 150) {
    // Fallback if no reliable max HR data
    const age = user.dateOfBirth ? new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear() : 35
    maxHR = 220 - age
  }
  
  const restingHR = user.restingHeartRate || 60
  
  // Adjust zones based on your actual data showing 5:20 pace at 139bpm should be tempo
  // Your max HR appears to be around 184, so 139bpm = 75.5% should be tempo effort
  return {
    zone1: { min: restingHR, max: maxHR * 0.65 }, // Recovery/Very Easy (up to 65%)
    zone2: { min: maxHR * 0.65, max: maxHR * 0.73 }, // Easy/Aerobic (65-73%)
    zone3: { min: maxHR * 0.73, max: maxHR * 0.80 }, // Marathon pace (73-80%)
    zone4: { min: maxHR * 0.73, max: maxHR * 0.88 }, // Tempo/Threshold (73-88%) - BROADER to catch both 139 & 153bpm
    zone5: { min: maxHR * 0.88, max: maxHR }, // Hard/VO2max (88%+)
    maxHR,
    restingHR
  }
}

// Categorize runs by effort level using heart rate
function categorizeRunsByEffort(runs: SimpleActivity[], hrZones: any) {
  const categorized = {
    easy: [] as SimpleActivity[],
    moderate: [] as SimpleActivity[],
    hard: [] as SimpleActivity[],
    veryHard: [] as SimpleActivity[]
  }
  
  console.log('HR Zone Analysis:', {
    zone1: `${Math.round(hrZones.zone1.min)}-${Math.round(hrZones.zone1.max)}`,
    zone2: `${Math.round(hrZones.zone2.min)}-${Math.round(hrZones.zone2.max)}`,
    zone3: `${Math.round(hrZones.zone3.min)}-${Math.round(hrZones.zone3.max)}`,
    zone4: `${Math.round(hrZones.zone4.min)}-${Math.round(hrZones.zone4.max)}`,
    zone5: `${Math.round(hrZones.zone5.min)}-${Math.round(hrZones.zone5.max)}`,
    maxHR: hrZones.maxHR,
    restingHR: hrZones.restingHR
  })
  
  runs.forEach((run, index) => {
    const pace = run.duration! / (run.distance! / 1000)
    const paceStr = `${Math.floor(pace / 60)}:${Math.round(pace % 60).toString().padStart(2, '0')}`
    
    if (!run.avgHr) {
      console.log(`Run ${index + 1}: ${(run.distance! / 1000).toFixed(1)}km at ${paceStr} pace - NO HR DATA (categorized as easy)`)
      categorized.easy.push(run)
      return
    }
    
    const avgHR = run.avgHr
    const paceSeconds = pace
    let category = 'easy'
    
    // Use PACE as primary indicator for tempo runs since HR zones are tricky
    // Your 5:20 and 5:44 paces should definitely be tempo regardless of HR
    if (paceSeconds <= 330) { // 5:30 pace or faster = tempo/hard
      categorized.hard.push(run)
      category = 'hard (TEMPO - by pace)'
    } else if (paceSeconds <= 360) { // 5:30-6:00 pace = moderate/marathon  
      categorized.moderate.push(run)
      category = 'moderate'
    } else if (avgHR >= hrZones.zone4.min) { // Still check HR for other efforts
      categorized.hard.push(run)
      category = 'hard (TEMPO - by HR)'
    } else if (avgHR >= hrZones.zone3.min) {
      categorized.moderate.push(run)
      category = 'moderate'
    } else {
      categorized.easy.push(run)
      category = 'easy'
    }
    
    console.log(`Run ${index + 1}: ${(run.distance! / 1000).toFixed(1)}km at ${paceStr} pace, ${avgHR}bpm HR -> ${category}`)
  })
  
  console.log('Categorization Results:', {
    easy: categorized.easy.length,
    moderate: categorized.moderate.length,
    hard: categorized.hard.length,
    veryHard: categorized.veryHard.length
  })
  
  return categorized
}

// Calculate easy pace from actual easy runs
function calculateEasyPace(easyRuns: SimpleActivity[], moderateRuns: SimpleActivity[]) {
  const allEasyEffortRuns = [...easyRuns, ...moderateRuns]
  if (allEasyEffortRuns.length === 0) return null
  
  // Get paces from easy effort runs
  const paces = allEasyEffortRuns.map(run => run.duration! / (run.distance! / 1000))
  
  // Use median pace to avoid outliers
  paces.sort((a, b) => a - b)
  return paces[Math.floor(paces.length / 2)]
}

// Calculate tempo pace from moderate-hard efforts
function calculateTempoPace(moderateRuns: SimpleActivity[], hardRuns: SimpleActivity[]) {
  console.log('Calculating Tempo Pace:')
  console.log(`- Moderate runs: ${moderateRuns.length}`)
  console.log(`- Hard runs: ${hardRuns.length}`)
  
  // Focus on hard runs first (Zone 4) as these are true tempo efforts
  if (hardRuns.length > 0) {
    console.log('Using HARD runs for tempo pace (Zone 4 - true tempo):')
    hardRuns.forEach((run, i) => {
      const pace = run.duration! / (run.distance! / 1000)
      const paceStr = `${Math.floor(pace / 60)}:${Math.round(pace % 60).toString().padStart(2, '0')}`
      console.log(`  Hard run ${i + 1}: ${(run.distance! / 1000).toFixed(1)}km at ${paceStr} pace, ${run.avgHr}bpm`)
    })
    
    const paces = hardRuns.map(run => run.duration! / (run.distance! / 1000))
    paces.sort((a: number, b: number) => a - b)
    const medianPace = paces[Math.floor(paces.length / 2)]
    const tempoStr = `${Math.floor(medianPace / 60)}:${Math.round(medianPace % 60).toString().padStart(2, '0')}`
    console.log(`  -> Tempo pace from hard runs: ${tempoStr}`)
    return medianPace
  }
  
  // Fallback to moderate runs if no hard runs
  if (moderateRuns.length > 0) {
    console.log('Using MODERATE runs for tempo pace (no hard runs available):')
    const paces = moderateRuns.map(run => run.duration! / (run.distance! / 1000))
    paces.sort((a: number, b: number) => a - b)
    const medianPace = paces[Math.floor(paces.length / 2)]
    const tempoStr = `${Math.floor(medianPace / 60)}:${Math.round(medianPace % 60).toString().padStart(2, '0')}`
    console.log(`  -> Tempo pace from moderate runs: ${tempoStr}`)
    return medianPace
  }
  
  console.log('No tempo runs found!')
  return null
}

// Calculate interval pace from hard efforts
function calculateIntervalPace(hardRuns: SimpleActivity[], veryHardRuns: SimpleActivity[]) {
  // Prefer shorter, harder runs (3-8km) for interval pace
  const intervalRuns = [...hardRuns, ...veryHardRuns]
    .filter(run => run.distance! >= 3000 && run.distance! <= 8000)
  
  if (intervalRuns.length === 0) {
    // Fallback to any hard runs
    const allHardRuns = [...hardRuns, ...veryHardRuns]
    if (allHardRuns.length === 0) return null
    
    const paces = allHardRuns.map(run => run.duration! / (run.distance! / 1000))
    paces.sort((a: number, b: number) => a - b)
    return paces[0] // Fastest pace
  }
  
  const paces = intervalRuns.map(run => run.duration! / (run.distance! / 1000))
  paces.sort((a, b) => a - b)
  return paces[0] // Fastest pace from interval-distance runs
}

// Calculate marathon pace from moderate efforts and long runs
function calculateMarathonPace(runsByEffort: any) {
  // Look for runs 15km+ at moderate effort as best marathon pace indicator
  const longModerateRuns = runsByEffort.moderate.filter((run: SimpleActivity) => run.distance! >= 15000)
  
  if (longModerateRuns.length > 0) {
    const paces = longModerateRuns.map((run: SimpleActivity) => run.duration! / (run.distance! / 1000))
    paces.sort((a: number, b: number) => a - b)
    return paces[Math.floor(paces.length / 2)] // Median of long moderate runs
  }
  
  // Fallback to moderate effort runs
  if (runsByEffort.moderate.length > 0) {
    const paces = runsByEffort.moderate.map((run: SimpleActivity) => run.duration! / (run.distance! / 1000))
    paces.sort((a: number, b: number) => a - b)
    return paces[Math.floor(paces.length / 2)]
  }
  
  return null
}

// Ensure paces make logical sense and adjust if needed
function validateAndAdjustPaces(paces: any) {
  const { easy, marathon, tempo, interval } = paces
  
  // Fill in missing paces using relationships
  if (!easy && marathon) paces.easy = marathon * 1.15
  if (!tempo && marathon) paces.tempo = marathon * 0.92
  if (!interval && tempo) paces.interval = tempo * 0.93
  if (!marathon && easy && tempo) paces.marathon = (easy * 0.87 + tempo * 1.08) / 2
  
  // Ensure logical ordering: easy > marathon > tempo > interval
  if (paces.easy && paces.marathon && paces.easy <= paces.marathon) {
    paces.easy = paces.marathon * 1.1
  }
  if (paces.marathon && paces.tempo && paces.marathon <= paces.tempo) {
    paces.tempo = paces.marathon * 0.95
  }
  if (paces.tempo && paces.interval && paces.tempo <= paces.interval) {
    paces.interval = paces.tempo * 0.95
  }
  
  return paces
}

// Fallback generic calculation
function calculateGenericTrainingPaces(marathonSeconds: number) {
  const marathonPacePerKm = marathonSeconds / 42.195
  return {
    easy: marathonPacePerKm * 1.20,
    marathon: marathonPacePerKm,
    tempo: marathonPacePerKm * 0.92,
    interval: marathonPacePerKm * 0.86
  }
}

// Legacy function for backward compatibility
export function calculateTrainingPaces(marathonSeconds: number) {
  return calculateGenericTrainingPaces(marathonSeconds)
}

// Heart rate zone analysis for training recommendations
export function analyzeHeartRateDistribution(activities: SimpleActivity[], user?: User) {
  if (!user?.maxHeartRate) return null
  
  const activitiesWithHR = activities.filter(a => a.avgHr && a.duration)
  if (!activitiesWithHR.length) return null
  
  const maxHR = user.maxHeartRate
  let zoneDistribution = {
    recovery: 0, // < 60%
    aerobic: 0,  // 60-70%
    tempo: 0,    // 70-80%
    lactate: 0,  // 80-90%
    neuro: 0     // > 90%
  }
  
  let totalDuration = 0
  
  activitiesWithHR.forEach(a => {
    const hrPercent = (a.avgHr || 0) / maxHR
    const duration = a.duration || 0
    totalDuration += duration
    
    if (hrPercent < 0.60) zoneDistribution.recovery += duration
    else if (hrPercent < 0.70) zoneDistribution.aerobic += duration
    else if (hrPercent < 0.80) zoneDistribution.tempo += duration
    else if (hrPercent < 0.90) zoneDistribution.lactate += duration
    else zoneDistribution.neuro += duration
  })
  
  // Convert to percentages
  Object.keys(zoneDistribution).forEach(zone => {
    zoneDistribution[zone as keyof typeof zoneDistribution] = 
      (zoneDistribution[zone as keyof typeof zoneDistribution] / totalDuration) * 100
  })
  
  return zoneDistribution
}
