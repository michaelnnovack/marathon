export function weeklyFocus(weeksToRace: number) {
  if (weeksToRace > 12) return 'Base building: mileage and easy aerobic runs.'
  if (weeksToRace > 8) return 'Build: introduce tempo and moderate long runs.'
  if (weeksToRace > 4) return 'Peak: quality workouts, sharpen intervals.'
  if (weeksToRace > 2) return 'Taper: reduce volume, maintain intensity.'
  return 'Race week: rest, hydrate, and trust your training.'
}

export function achievement(distanceKm: number) {
  if (distanceKm >= 42.195) return 'Marathon distance achieved! 🎉'
  if (distanceKm >= 21.097) return 'Half marathon milestone reached! 💪'
  if (distanceKm >= 10) return '10K milestone hit! ✅'
  return null
}

export function riskAssessment(load7: number, load28: number) {
  if (load28 === 0) return 'Insufficient data.'
  const ratio = load7 / load28
  if (ratio > 1.5) return 'Elevated injury risk: consider a cutback week.'
  if (ratio < 0.8) return 'Undertraining: gently increase volume.'
  return 'Stable load: maintain consistent training.'
}
