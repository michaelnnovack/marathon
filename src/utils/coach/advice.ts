import type { SimpleActivity, User } from '@/types'

export interface CoachingAdvice {
  weeklyFocus: string
  motivation: string
  tips: string[]
  warnings?: string[]
  nextGoals: string[]
}

export interface DailyWorkout {
  type: string
  distance: string
  pace: string
  reasoning: string
}

export interface IntervalSet {
  repetitions: number
  distance?: number // meters
  duration?: number // seconds
  pace: string
  recovery: {
    distance?: number // meters
    duration?: number // seconds
    type: 'active' | 'rest'
    pace?: string
  }
  description?: string
}

export interface DetailedWorkout {
  type: string
  title: string
  description: string
  totalDistance: number // meters
  estimatedDuration: number // minutes
  warmup?: {
    distance?: number // meters
    duration?: number // minutes
    pace: string
    description: string
  }
  mainSet: IntervalSet[]
  cooldown?: {
    distance?: number // meters
    duration?: number // minutes
    pace: string
    description: string
  }
  paceGuidance: {
    easy: string
    marathon: string
    tempo: string
    interval: string
    recovery: string
  }
  heartRateGuidance?: {
    easy: string
    tempo: string
    interval: string
  }
  reasoning: string
  keyPoints: string[]
  difficulty: 1 | 2 | 3 | 4 | 5
}

export function weeklyFocus(weeksToRace: number): string {
  if (weeksToRace > 12) return 'Base building: Focus on aerobic capacity with easy-paced runs and gradual mileage increases.'
  if (weeksToRace > 8) return 'Build phase: Introduce tempo runs and longer workouts. Build your lactate threshold.'
  if (weeksToRace > 4) return 'Peak training: Sharp interval sessions and race-pace workouts. This is your hardest training block.'
  if (weeksToRace > 2) return 'Taper time: Reduce volume by 40-50% while maintaining some intensity. Stay loose and confident.'
  return 'Race week: Minimal easy running, perfect nutrition, hydration, and sleep. Trust your training!'
}

export function achievement(distanceKm: number) {
  if (distanceKm >= 42.195) return 'Marathon distance achieved! 🎉'
  if (distanceKm >= 21.097) return 'Half marathon milestone reached! 💪'
  if (distanceKm >= 10) return '10K milestone hit! ✅'
  return null
}

export function getCoachingAdvice(
  user: User,
  activities: SimpleActivity[],
  weeksToRace: number
): CoachingAdvice {
  const weeklyKm = activities.slice(-7).reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  
  const advice: CoachingAdvice = {
    weeklyFocus: weeklyFocus(weeksToRace),
    motivation: getMotivation(user, activities),
    tips: getPersonalizedTips(user, activities, weeklyKm),
    nextGoals: getNextGoals(user, activities),
    warnings: getTrainingWarnings(activities, weeklyKm)
  }
  
  return advice
}

function getMotivation(user: User, activities: SimpleActivity[]): string {
  const totalKm = activities.reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  const streak = user.stats.currentStreak
  
  if (streak >= 14) {
    return `🔥 Amazing ${streak}-day streak, ${user.name}! Your consistency is paying off big time.`
  }
  
  if (totalKm >= 500) {
    return `💪 You've covered ${Math.round(totalKm)}km total - that's serious dedication! Keep building on this strong foundation.`
  }
  
  if (activities.length >= 50) {
    return `🏆 ${activities.length} workouts logged! You're developing into a true runner. Every session makes you stronger.`
  }
  
  return `🌟 Great work staying committed to your training, ${user.name}! Every run is building your fitness.`
}

function getPersonalizedTips(user: User, activities: SimpleActivity[], weeklyKm: number): string[] {
  const tips: string[] = []
  const hasHeartRateData = activities.some(a => a.avgHr && a.avgHr > 0)
  
  // Level-specific tips
  if (user.level === 'beginner') {
    tips.push('Focus on building your aerobic base with easy-paced runs')
    if (weeklyKm < 20) {
      tips.push('Gradually increase weekly mileage by 10% each week')
    }
    tips.push('Listen to your body and take rest days seriously')
  } else if (user.level === 'intermediate') {
    tips.push('Incorporate one tempo run and one interval session per week')
    tips.push('Practice race-day nutrition and pacing during long runs')
    if (!hasHeartRateData) {
      tips.push('Consider using a heart rate monitor to optimize training zones')
    }
  } else if (user.level === 'advanced') {
    tips.push('Focus on specificity - train at goal marathon pace regularly')
    tips.push('Include negative split long runs and progressive workouts')
    tips.push('Fine-tune your fueling and hydration strategy')
  }
  
  // Training focus specific tips
  user.trainingFocus.forEach((focus: string) => {
    switch (focus) {
      case 'speed':
        tips.push('Include strides 2-3 times per week after easy runs')
        break
      case 'endurance':
        tips.push('Prioritize consistent weekly long runs, building duration gradually')
        break
      case 'strength':
        tips.push('Add hill repeats and strength training to build power')
        break
      case 'recovery':
        tips.push('Prioritize sleep, nutrition, and active recovery sessions')
        break
    }
  })
  
  return tips.slice(0, 3) // Limit to top 3 tips
}

function getNextGoals(user: User, activities: SimpleActivity[]): string[] {
  const goals: string[] = []
  const totalKm = activities.reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  const longestRun = Math.max(...activities.map(a => (a.distance || 0) / 1000), 0)
  
  if (longestRun < 10) {
    goals.push('Complete a 10K distance run')
  } else if (longestRun < 21) {
    goals.push('Build up to a half marathon distance')
  } else if (longestRun < 32) {
    goals.push('Complete a 32K long run (marathon training milestone)')
  }
  
  if (user.stats.currentStreak < 7) {
    goals.push('Build a 7-day training streak')
  } else if (user.stats.currentStreak < 21) {
    goals.push('Extend your streak to 3 weeks')
  }
  
  if (totalKm < 100) {
    goals.push('Reach 100K total distance')
  } else if (totalKm < 500) {
    goals.push('Hit the 500K total distance milestone')
  }
  
  return goals.slice(0, 2) // Limit to top 2 goals
}

function getTrainingWarnings(activities: SimpleActivity[], weeklyKm: number): string[] {
  const warnings: string[] = []
  const recentRuns = activities.slice(-7)
  
  // Check for sudden volume increases
  const previousWeekKm = activities.slice(-14, -7).reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  if (previousWeekKm > 0 && weeklyKm > previousWeekKm * 1.3) {
    warnings.push('⚠️ Volume increased >30% this week. Consider scaling back to prevent injury.')
  }
  
  // Check for lack of easy runs
  const hardRuns = recentRuns.filter(a => {
    if (!a.avgHr || !a.maxHr) return false
    return a.avgHr > (a.maxHr * 0.8) // Rough threshold for hard efforts
  }).length
  
  if (hardRuns >= 4) {
    warnings.push('⚠️ Too many hard efforts this week. Include more easy-paced recovery runs.')
  }
  
  // Check for consecutive hard days
  for (let i = 0; i < recentRuns.length - 1; i++) {
    const today = recentRuns[i]
    const tomorrow = recentRuns[i + 1]
    if (today.avgHr && tomorrow.avgHr && today.maxHr && tomorrow.maxHr) {
      const todayHard = today.avgHr > (today.maxHr * 0.8)
      const tomorrowHard = tomorrow.avgHr > (tomorrow.maxHr * 0.8)
      if (todayHard && tomorrowHard) {
        warnings.push('⚠️ Back-to-back hard sessions detected. Consider adding easy days between quality workouts.')
        break
      }
    }
  }
  
  return warnings
}

export function riskAssessment(load7: number, load28: number): string {
  if (load28 === 0) return 'Insufficient data for injury risk assessment.'
  const ratio = load7 / (load28 / 4) // Compare weekly average
  if (ratio > 1.5) return '🔴 Elevated injury risk: consider a cutback week with reduced intensity.'
  if (ratio < 0.6) return '🟡 Training load quite low: gradually increase volume and consistency.'
  return '🟢 Training load appears well-managed. Good job maintaining consistency!'
}

// Supporting functions for enhanced workout generation

function calculatePersonalizedPaces(user: User, activities: SimpleActivity[]) {
  let marathonPaceSeconds = 330 // Default 5:30/km
  
  // Calculate based on goal time if available
  if (user.goalTime) {
    const [h, m, s] = user.goalTime.split(':').map(Number)
    const goalSeconds = h * 3600 + m * 60 + s
    marathonPaceSeconds = goalSeconds / 42.195
  } else {
    // Estimate from recent performances
    const recentRuns = activities.slice(-10).filter(a => a.distance && a.duration)
    if (recentRuns.length > 0) {
      const avgPaceSeconds = recentRuns.reduce((sum, a) => {
        const pacePerKm = a.duration! / (a.distance! / 1000)
        return sum + pacePerKm
      }, 0) / recentRuns.length
      
      // Marathon pace is typically 15-30 seconds slower per km than recent training pace
      marathonPaceSeconds = avgPaceSeconds + 20
    }
  }
  
  const marathonMinutes = Math.floor(marathonPaceSeconds / 60)
  const marathonSeconds = Math.round(marathonPaceSeconds % 60)
  
  return {
    easy: formatPace(marathonPaceSeconds + 60), // 1:00 slower than marathon pace
    recovery: formatPace(marathonPaceSeconds + 90), // 1:30 slower than marathon pace
    marathon: formatPace(marathonPaceSeconds),
    tempo: formatPace(marathonPaceSeconds - 15), // 15 seconds faster than marathon pace
    interval: formatPace(marathonPaceSeconds - 45) // 45 seconds faster than marathon pace
  }
}

function calculateHeartRateGuidance(user: User) {
  if (!user.maxHeartRate) return undefined
  
  const maxHR = user.maxHeartRate
  const restingHR = user.restingHeartRate || 60
  const hrr = maxHR - restingHR
  
  return {
    easy: `${restingHR + Math.round(hrr * 0.65)}-${restingHR + Math.round(hrr * 0.75)} bpm`,
    tempo: `${restingHR + Math.round(hrr * 0.80)}-${restingHR + Math.round(hrr * 0.88)} bpm`,
    interval: `${restingHR + Math.round(hrr * 0.90)}-${maxHR} bpm`
  }
}

function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = Math.round(paceSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

function getTrainingPhase(weeksToRace: number): 'base' | 'build' | 'peak' | 'taper' {
  if (weeksToRace > 12) return 'base'
  if (weeksToRace > 4) return 'build'
  if (weeksToRace > 1) return 'peak'
  return 'taper'
}

function assessFatigueLevel(activities: SimpleActivity[], user: User): 'low' | 'moderate' | 'high' {
  const recentActivities = activities.slice(-7)
  const weeklyKm = recentActivities.reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  const previousWeekKm = activities.slice(-14, -7).reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  
  // High fatigue indicators
  const volumeIncrease = previousWeekKm > 0 ? (weeklyKm - previousWeekKm) / previousWeekKm : 0
  const hardWorkouts = recentActivities.filter(a => isHardWorkout(a)).length
  
  if (volumeIncrease > 0.3 || hardWorkouts >= 4 || weeklyKm > 80) return 'high'
  if (volumeIncrease > 0.15 || hardWorkouts >= 3 || weeklyKm > 50) return 'moderate'
  return 'low'
}

function isHardWorkout(activity: SimpleActivity): boolean {
  if (!activity.avgHr || !activity.duration || !activity.distance) return false
  
  const pacePerKm = activity.duration / (activity.distance / 1000)
  const distance = activity.distance / 1000
  
  // Consider it hard if pace is fast or HR is high
  return pacePerKm < 360 || // Faster than 6:00/km
         (activity.avgHr > 160) || // High heart rate
         (distance >= 15 && pacePerKm < 420) // Long run with decent pace
}

function getDaysSinceLastHardWorkout(activities: SimpleActivity[]): number {
  const now = new Date()
  const recentActivities = activities.slice(-14)
    .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
  
  for (let i = 0; i < recentActivities.length; i++) {
    const activity = recentActivities[i]
    if (isHardWorkout(activity)) {
      const activityDate = new Date(activity.date || '')
      return Math.floor((now.getTime() - activityDate.getTime()) / (24 * 60 * 60 * 1000))
    }
  }
  
  return 7 // Default if no hard workout found
}

function calculateWeeklyIntensityRatio(activities: SimpleActivity[]): number {
  if (activities.length === 0) return 0
  
  const hardWorkouts = activities.filter(a => isHardWorkout(a)).length
  return hardWorkouts / activities.length
}

function determineOptimalWorkoutType(context: {
  dayOfWeek: number
  trainingPhase: 'base' | 'build' | 'peak' | 'taper'
  weeksToRace: number
  daysSinceLastHard: number
  weeklyKm: number
  longestRecent: number
  userLevel: 'beginner' | 'intermediate' | 'advanced'
  trainingFocus: string[]
}): 'easy' | 'tempo' | 'intervals' | 'long' | 'progression' {
  const { dayOfWeek, trainingPhase, daysSinceLastHard, weeklyKm, userLevel } = context
  
  // Long run days (Saturday/Sunday)
  if ([0, 6].includes(dayOfWeek) && daysSinceLastHard >= 1) {
    return 'long'
  }
  
  // Quality workout days (Tuesday/Thursday)
  if ([2, 4].includes(dayOfWeek) && daysSinceLastHard >= 2) {
    if (trainingPhase === 'base') {
      return Math.random() > 0.6 ? 'tempo' : 'easy'
    } else if (trainingPhase === 'build') {
      return dayOfWeek === 2 ? 'intervals' : 'tempo'
    } else if (trainingPhase === 'peak') {
      return dayOfWeek === 2 ? 'intervals' : 'progression'
    }
  }
  
  // Friday progression runs for advanced athletes in build/peak
  if (dayOfWeek === 5 && userLevel === 'advanced' && ['build', 'peak'].includes(trainingPhase)) {
    return 'progression'
  }
  
  // Default to easy
  return 'easy'
}

// Detailed workout generators

function generateRecoveryWorkout(paceGuidance: any, hrGuidance: any, fatigueLevel: string): DetailedWorkout {
  const distance = fatigueLevel === 'high' ? 4000 : 5000
  
  return {
    type: 'Recovery Run',
    title: 'Active Recovery',
    description: 'Very easy pace for active recovery and improved blood flow',
    totalDistance: distance,
    estimatedDuration: Math.round(distance * 0.006), // Rough estimate at recovery pace
    mainSet: [{
      repetitions: 1,
      distance: distance,
      pace: paceGuidance.recovery,
      recovery: { duration: 0, type: 'rest' as const },
      description: 'Maintain conversational pace throughout'
    }],
    paceGuidance,
    heartRateGuidance: hrGuidance,
    reasoning: fatigueLevel === 'high' 
      ? 'High fatigue detected. This easy run promotes recovery while maintaining movement patterns.'
      : 'Recovery run to facilitate adaptation and prepare for the next quality session.',
    keyPoints: [
      'Should feel very comfortable and conversational',
      'Focus on relaxed running form',
      'Stop early if feeling overly fatigued'
    ],
    difficulty: 1
  }
}

function generateTempoWorkout(
  phase: string, 
  user: User, 
  paceGuidance: any, 
  hrGuidance: any, 
  weeksToRace: number
): DetailedWorkout {
  const isAdvanced = user.level === 'advanced'
  const tempoDistance = phase === 'peak' ? (isAdvanced ? 8000 : 6000) : 
                       phase === 'build' ? (isAdvanced ? 6000 : 4000) : 3000
  
  const warmupDistance = isAdvanced ? 3000 : 2000
  const cooldownDistance = isAdvanced ? 2000 : 1500
  
  return {
    type: 'Tempo Run',
    title: `${Math.round(tempoDistance / 1000)}K Tempo`,
    description: 'Sustained effort at lactate threshold - comfortably hard pace you could maintain for 1 hour',
    totalDistance: warmupDistance + tempoDistance + cooldownDistance,
    estimatedDuration: Math.round((warmupDistance * 0.007) + (tempoDistance * 0.0055) + (cooldownDistance * 0.007)),
    warmup: {
      distance: warmupDistance,
      duration: Math.round(warmupDistance * 0.007),
      pace: paceGuidance.easy,
      description: 'Start easy, gradually build to tempo effort over final 800m'
    },
    mainSet: [{
      repetitions: 1,
      distance: tempoDistance,
      pace: paceGuidance.tempo,
      recovery: { duration: 0, type: 'rest' as const },
      description: `Sustained ${Math.round(tempoDistance / 1000)}K at lactate threshold pace`
    }],
    cooldown: {
      distance: cooldownDistance,
      duration: Math.round(cooldownDistance * 0.007),
      pace: paceGuidance.easy,
      description: 'Gradual return to easy pace, focus on relaxation'
    },
    paceGuidance,
    heartRateGuidance: hrGuidance,
    reasoning: phase === 'peak' 
      ? 'Tempo runs improve lactate clearance and race pace confidence for marathon success.'
      : 'Building lactate threshold - the cornerstone of marathon performance.',
    keyPoints: [
      'Target effort: 7-8/10 - comfortably hard but sustainable',
      'Should feel challenging but controlled throughout',
      'Focus on smooth, efficient running form',
      'If pace drops significantly, end the tempo segment'
    ],
    difficulty: phase === 'peak' ? 4 : 3
  }
}

function generateIntervalWorkout(
  phase: string,
  user: User,
  paceGuidance: any,
  hrGuidance: any,
  weeksToRace: number
): DetailedWorkout {
  const isAdvanced = user.level === 'advanced'
  
  // Different interval structures based on phase and level
  let intervals: IntervalSet[]
  let title: string
  let description: string
  
  if (phase === 'peak' && weeksToRace <= 6) {
    // Race-specific intervals
    intervals = [{
      repetitions: isAdvanced ? 6 : 5,
      distance: 1000,
      pace: paceGuidance.interval,
      recovery: { duration: 90, type: 'active' as const, pace: paceGuidance.easy },
      description: '1K repeats at 5K race pace'
    }]
    title = `${intervals[0].repetitions} × 1K Intervals`
    description = 'High-intensity 1K repeats to develop VO2max and speed endurance'
  } else if (phase === 'build') {
    // Build phase variety
    if (user.trainingFocus.includes('speed')) {
      intervals = [{
        repetitions: isAdvanced ? 8 : 6,
        distance: 400,
        pace: paceGuidance.interval,
        recovery: { duration: 90, type: 'active' as const, pace: paceGuidance.easy },
        description: '400m repeats for neuromuscular power'
      }]
      title = `${intervals[0].repetitions} × 400m`
      description = 'Short intervals to develop neuromuscular power and speed'
    } else {
      intervals = [{
        repetitions: isAdvanced ? 5 : 4,
        distance: 1200,
        pace: paceGuidance.interval,
        recovery: { duration: 120, type: 'active' as const, pace: paceGuidance.easy },
        description: '1200m repeats for aerobic power'
      }]
      title = `${intervals[0].repetitions} × 1200m`
      description = 'Medium intervals to build aerobic power and VO2max'
    }
  } else {
    // Base phase - shorter intervals
    intervals = [{
      repetitions: isAdvanced ? 6 : 5,
      distance: 800,
      pace: paceGuidance.interval,
      recovery: { duration: 120, type: 'active' as const, pace: paceGuidance.easy },
      description: '800m repeats for aerobic development'
    }]
    title = `${intervals[0].repetitions} × 800m`
    description = 'Classic 800m intervals to build aerobic capacity'
  }
  
  const warmupDistance = isAdvanced ? 3000 : 2000
  const cooldownDistance = 2000
  const totalIntervalDistance = intervals[0].repetitions * intervals[0].distance!
  
  return {
    type: 'Intervals',
    title,
    description,
    totalDistance: warmupDistance + totalIntervalDistance + cooldownDistance,
    estimatedDuration: Math.round(
      (warmupDistance * 0.007) + 
      (intervals[0].repetitions * ((intervals[0].distance! * 0.0048) + (intervals[0].recovery.duration! / 60))) +
      (cooldownDistance * 0.007)
    ),
    warmup: {
      distance: warmupDistance,
      duration: Math.round(warmupDistance * 0.007),
      pace: paceGuidance.easy,
      description: 'Easy pace with 4-6 strides in final kilometer to prepare for fast running'
    },
    mainSet: intervals,
    cooldown: {
      distance: cooldownDistance,
      duration: Math.round(cooldownDistance * 0.007),
      pace: paceGuidance.easy,
      description: 'Easy cool-down to promote recovery'
    },
    paceGuidance,
    heartRateGuidance: hrGuidance,
    reasoning: 'Interval training develops VO2max, speed, and neuromuscular efficiency - key components for strong marathon finishing.',
    keyPoints: [
      'Target effort: 9/10 - should feel hard but sustainable for the full set',
      'Focus on consistent splits across all repetitions',
      'Recovery should be active jogging, not complete rest',
      'If pace drops significantly, end the session early'
    ],
    difficulty: 5
  }
}

function generateLongRunWorkout(
  phase: string,
  user: User,
  paceGuidance: any,
  hrGuidance: any,
  weeksToRace: number,
  longestRecent: number
): DetailedWorkout {
  const isAdvanced = user.level === 'advanced'
  const baseDistance = Math.max(longestRecent * 1000, 12000) // At least 12K
  
  let longRunDistance = Math.min(baseDistance + 3000, 35000) // Progressive but capped
  let mainSet: IntervalSet[]
  let title: string
  let description: string
  
  // Adjust based on training phase
  if (phase === 'peak' && weeksToRace > 3) {
    // Marathon pace segments
    const mpSegments = isAdvanced ? 3 : 2
    const mpDistance = isAdvanced ? 5000 : 3000
    
    mainSet = [
      {
        repetitions: 1,
        distance: Math.round(longRunDistance * 0.4),
        pace: paceGuidance.easy,
        recovery: { duration: 0, type: 'rest' as const },
        description: 'Easy aerobic running'
      },
      {
        repetitions: mpSegments,
        distance: mpDistance,
        pace: paceGuidance.marathon,
        recovery: { duration: 120, type: 'active' as const, pace: paceGuidance.easy },
        description: `${Math.round(mpDistance / 1000)}K at marathon pace`
      },
      {
        repetitions: 1,
        distance: Math.round(longRunDistance * 0.3),
        pace: paceGuidance.easy,
        recovery: { duration: 0, type: 'rest' as const },
        description: 'Easy finish'
      }
    ]
    
    title = `${Math.round(longRunDistance / 1000)}K with Marathon Pace`
    description = 'Long run with marathon pace segments to practice race-day effort and fueling'
  } else if (phase === 'build') {
    // Progressive long run
    mainSet = [
      {
        repetitions: 1,
        distance: Math.round(longRunDistance * 0.6),
        pace: paceGuidance.easy,
        recovery: { duration: 0, type: 'rest' as const },
        description: 'Relaxed aerobic pace'
      },
      {
        repetitions: 1,
        distance: Math.round(longRunDistance * 0.4),
        pace: paceGuidance.tempo,
        recovery: { duration: 0, type: 'rest' as const },
        description: 'Progressive to tempo effort'
      }
    ]
    
    title = `${Math.round(longRunDistance / 1000)}K Progressive`
    description = 'Long run starting easy and progressing to tempo effort'
  } else {
    // Standard aerobic long run
    mainSet = [{
      repetitions: 1,
      distance: longRunDistance,
      pace: paceGuidance.easy,
      recovery: { duration: 0, type: 'rest' as const },
      description: 'Steady aerobic effort throughout'
    }]
    
    title = `${Math.round(longRunDistance / 1000)}K Long Run`
    description = 'Steady aerobic long run to build endurance and mental toughness'
  }
  
  return {
    type: 'Long Run',
    title,
    description,
    totalDistance: longRunDistance,
    estimatedDuration: Math.round(longRunDistance * 0.0065), // Conservative estimate
    mainSet,
    paceGuidance,
    heartRateGuidance: hrGuidance,
    reasoning: 'Long runs build aerobic capacity, fat oxidation, and mental resilience - the foundation of marathon success.',
    keyPoints: [
      'Start conservatively and build into the run',
      'Practice race-day fueling and hydration',
      'Focus on maintaining form as fatigue sets in',
      'Listen to your body - better to finish strong than struggle'
    ],
    difficulty: phase === 'peak' ? 4 : 3
  }
}

function generateProgressionWorkout(
  phase: string,
  user: User,
  paceGuidance: any,
  hrGuidance: any
): DetailedWorkout {
  const isAdvanced = user.level === 'advanced'
  const totalDistance = isAdvanced ? 12000 : 10000
  
  const segments = [
    { distance: Math.round(totalDistance * 0.4), pace: paceGuidance.easy, description: 'Easy warm-up phase' },
    { distance: Math.round(totalDistance * 0.3), pace: paceGuidance.marathon, description: 'Marathon pace phase' },
    { distance: Math.round(totalDistance * 0.3), pace: paceGuidance.tempo, description: 'Tempo finish' }
  ]
  
  const mainSet: IntervalSet[] = segments.map((segment, index) => ({
    repetitions: 1,
    distance: segment.distance,
    pace: segment.pace,
    recovery: { duration: 0, type: 'rest' as const },
    description: segment.description
  }))
  
  return {
    type: 'Progression Run',
    title: `${Math.round(totalDistance / 1000)}K Progression`,
    description: 'Progressive effort building from easy to tempo pace',
    totalDistance,
    estimatedDuration: Math.round(totalDistance * 0.0058), // Faster average pace
    mainSet,
    paceGuidance,
    heartRateGuidance: hrGuidance,
    reasoning: 'Progression runs teach pacing discipline and simulate negative-split race strategy.',
    keyPoints: [
      'Each segment should feel progressively harder',
      'Resist going too fast in early segments',
      'Focus on smooth transitions between pace zones',
      'Should finish feeling strong and controlled'
    ],
    difficulty: 3
  }
}

function generateEasyRunWorkout(
  phase: string,
  user: User,
  paceGuidance: any,
  hrGuidance: any,
  dayOfWeek: number
): DetailedWorkout {
  const isAdvanced = user.level === 'advanced'
  
  // Vary distance based on day and level
  let distance: number
  if (dayOfWeek === 6) { // Saturday - pre-long run
    distance = isAdvanced ? 6000 : 5000
  } else if (dayOfWeek === 1) { // Monday - recovery
    distance = isAdvanced ? 8000 : 6000
  } else {
    distance = isAdvanced ? 10000 : 8000
  }
  
  return {
    type: 'Easy Run',
    title: `${Math.round(distance / 1000)}K Easy`,
    description: 'Comfortable aerobic pace for base building and recovery',
    totalDistance: distance,
    estimatedDuration: Math.round(distance * 0.007),
    mainSet: [{
      repetitions: 1,
      distance: distance,
      pace: paceGuidance.easy,
      recovery: { duration: 0, type: 'rest' as const },
      description: 'Conversational pace throughout'
    }],
    paceGuidance,
    heartRateGuidance: hrGuidance,
    reasoning: dayOfWeek === 6 
      ? 'Easy run to prepare legs for tomorrow\'s long run while maintaining weekly volume.'
      : 'Easy aerobic running builds capillary density, mitochondrial efficiency, and aerobic enzymes.',
    keyPoints: [
      'Should feel comfortable and conversational',
      'Focus on relaxed, efficient form',
      'Can include 4-6 strides at the end if feeling good',
      'Cut short if feeling overly fatigued'
    ],
    difficulty: 1
  }
}

export function getTodaysWorkout(
  user: User,
  activities: SimpleActivity[],
  weeksToRace: number
): DailyWorkout {
  // Legacy function - use getDetailedWorkout for enhanced coaching
  const detailed = getDetailedWorkout(user, activities, weeksToRace)
  return {
    type: detailed.type,
    distance: `${Math.round(detailed.totalDistance / 1000)}K`,
    pace: detailed.mainSet[0]?.pace || detailed.paceGuidance.easy,
    reasoning: detailed.reasoning
  }
}

export function getDetailedWorkout(
  user: User,
  activities: SimpleActivity[],
  weeksToRace: number
): DetailedWorkout {
  const recentActivities = activities.slice(-7)
  const yesterdayActivity = recentActivities[recentActivities.length - 1]
  const weeklyKm = recentActivities.reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  const last14Days = activities.slice(-14)
  const longestRecent = Math.max(...last14Days.map(a => (a.distance || 0) / 1000), 0)
  
  // Calculate personalized training paces
  const paceGuidance = calculatePersonalizedPaces(user, activities)
  const hrGuidance = calculateHeartRateGuidance(user)

  const dayOfWeek = new Date().getDay() // 0 = Sunday, 1 = Monday, etc.
  const trainingPhase = getTrainingPhase(weeksToRace)
  
  // Advanced fatigue assessment
  const fatigueLevel = assessFatigueLevel(activities, user)
  const yesterdayWasHard = yesterdayActivity && isHardWorkout(yesterdayActivity)
  const daysSinceLastHard = getDaysSinceLastHardWorkout(activities)
  const weeklyIntensityRatio = calculateWeeklyIntensityRatio(recentActivities)
  
  // Recovery day logic
  if (fatigueLevel === 'high' || yesterdayWasHard || weeklyIntensityRatio > 0.3) {
    return generateRecoveryWorkout(paceGuidance, hrGuidance, fatigueLevel)
  }
  
  // Determine workout type using sophisticated logic
  const workoutType = determineOptimalWorkoutType({
    dayOfWeek,
    trainingPhase,
    weeksToRace,
    daysSinceLastHard,
    weeklyKm,
    longestRecent,
    userLevel: user.level,
    trainingFocus: user.trainingFocus
  })

  // Generate detailed workout based on type
  switch (workoutType) {
    case 'tempo':
      return generateTempoWorkout(trainingPhase, user, paceGuidance, hrGuidance, weeksToRace)
    
    case 'intervals':
      return generateIntervalWorkout(trainingPhase, user, paceGuidance, hrGuidance, weeksToRace)
    
    case 'long':
      return generateLongRunWorkout(trainingPhase, user, paceGuidance, hrGuidance, weeksToRace, longestRecent)
    
    case 'progression':
      return generateProgressionWorkout(trainingPhase, user, paceGuidance, hrGuidance)
    
    case 'easy':
    default:
      return generateEasyRunWorkout(trainingPhase, user, paceGuidance, hrGuidance, dayOfWeek)
  }
}
