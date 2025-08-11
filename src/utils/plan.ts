import type { TrainingPlan, Week, Workout } from '@/types'
import { addDays, startOfWeek, toISODate } from './dates'

const weekdayTypes = ['easy', 'interval', 'recovery', 'tempo', 'easy', 'long', 'recovery'] as const

export function generatePlan(userId: string, todayISO: string, raceISO: string): TrainingPlan {
  const today = new Date(todayISO)
  const race = new Date(raceISO)
  const daysUntilRace = Math.max(7, Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
  const weeksCount = Math.ceil(daysUntilRace / 7)
  const weeks: Week[] = []
  const start = startOfWeek(today)

  // Phase spans (approx): base 8w, build 6w, peak 4w, taper 2w
  const phaseBoundaries = { base: 8, build: 6, peak: 4, taper: 2 }
  const totalPhaseWeeks = phaseBoundaries.base + phaseBoundaries.build + phaseBoundaries.peak + phaseBoundaries.taper
  const scale = weeksCount < totalPhaseWeeks ? weeksCount / totalPhaseWeeks : 1
  const baseW = Math.max(1, Math.round(phaseBoundaries.base * scale))
  const buildW = Math.max(1, Math.round(phaseBoundaries.build * scale))
  const peakW = Math.max(1, Math.round(phaseBoundaries.peak * scale))
  const taperW = Math.max(1, Math.round(phaseBoundaries.taper * scale))

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = addDays(start, w * 7)
    const daysArr: Workout[] = []

    let phase: Week['phase'] = 'base'
    const idx = w + 1
    if (idx <= baseW) phase = 'base'
    else if (idx <= baseW + buildW) phase = 'build'
  else if (idx <= baseW + buildW + peakW) phase = 'peak'
  else if (idx <= baseW + buildW + peakW + taperW) phase = 'taper'
  else phase = 'taper'

    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      const iso = toISODate(date)
      const type = weekdayTypes[d]
      const isLong = type === 'long'
      // Base durations in minutes
      let duration = isLong ? 100 : type === 'interval' ? 60 : type === 'tempo' ? 50 : 40
      if (phase === 'base') duration *= 0.9
      if (phase === 'build') duration *= 1.0
      if (phase === 'peak') duration *= 1.1
      if (phase === 'taper') duration *= 0.75

      const description = isLong
        ? phase === 'peak'
          ? 'Long run with fast finish'
          : 'Long run at comfortable pace'
        : type === 'interval'
        ? phase === 'build' || phase === 'peak'
          ? 'Intervals 6-8x800m w/ 2:00 recovery'
          : 'Intervals 4-5x800m w/ 2:00 recovery'
        : type === 'tempo'
        ? phase === 'peak'
          ? '30-40 min tempo at threshold'
          : '20-30 min tempo at threshold'
        : phase === 'taper'
        ? 'Easy aerobic run + strides'
        : 'Easy aerobic run'

      daysArr.push({
        id: `${iso}-${type}`,
        date: iso,
        type,
        description,
        duration: Math.round(duration),
        completed: false,
      })
    }

    weeks.push({ start: toISODate(weekStart), phase, days: daysArr })
  }

  const currentWeek = 0
  const focusAreas = ['Consistency', 'Injury prevention', 'Sleep & nutrition']
  const now = new Date().toISOString()
  return { 
    userId, 
    weeks, 
    currentWeek, 
    focusAreas,
    createdAt: now,
    updatedAt: now
  }
}
