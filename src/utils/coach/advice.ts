import type { SimpleActivity, UserLevel } from '@/types'
import type { UserProfile } from '@/store/user'

export interface CoachingAdvice {
  weeklyFocus: string
  motivation: string
  tips: string[]
  warnings?: string[]
  nextGoals: string[]
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
  user: UserProfile,
  activities: SimpleActivity[],
  weeksToRace: number
): CoachingAdvice {
  const recentActivities = activities.slice(-14) // Last 14 activities
  const weeklyKm = activities.slice(-7).reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  const monthlyKm = activities.slice(-28).reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0)
  
  const advice: CoachingAdvice = {
    weeklyFocus: weeklyFocus(weeksToRace),
    motivation: getMotivation(user, activities),
    tips: getPersonalizedTips(user, activities, weeklyKm),
    nextGoals: getNextGoals(user, activities),
    warnings: getTrainingWarnings(activities, weeklyKm, monthlyKm)
  }
  
  return advice
}

function getMotivation(user: UserProfile, activities: SimpleActivity[]): string {
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

function getPersonalizedTips(user: UserProfile, activities: SimpleActivity[], weeklyKm: number): string[] {
  const tips: string[] = []
  const avgPace = activities.length > 0 ? activities.reduce((sum, a) => sum + (a.avgPace || 0), 0) / activities.length : 0
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

function getNextGoals(user: UserProfile, activities: SimpleActivity[]): string[] {
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

function getTrainingWarnings(activities: SimpleActivity[], weeklyKm: number, monthlyKm: number): string[] {
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
