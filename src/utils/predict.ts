import type { SimpleActivity } from '@/store/activities'

// Convert any activity to an equivalent 10K time using Riegel scaling
// T2 = T1 * (D2/D1)^1.06
export function equivalentTime(seconds: number, distMeters: number, targetMeters: number) {
  if (distMeters <= 0) return 0
  const ratio = targetMeters / distMeters
  return seconds * Math.pow(ratio, 1.06)
}

export function predictMarathonTime(list: SimpleActivity[]) {
  const samples: number[] = []
  for (const a of list) {
    if (a.distance && a.duration && a.duration > 0) {
      // Scale to marathon distance
      const eq = equivalentTime(a.duration, a.distance, 42195)
      if (eq > 0) samples.push(eq)
    }
  }
  if (!samples.length) return { seconds: 0, ci: 0 }
  // Use trimmed mean to reduce outlier influence
  samples.sort((a,b)=>a-b)
  const trim = Math.max(0, Math.floor(samples.length * 0.1))
  const trimmed = samples.slice(trim, samples.length - trim || undefined)
  const mean = trimmed.reduce((s,x)=>s+x,0) / trimmed.length
  // crude CI using sample stddev / sqrt(n)
  const variance = trimmed.reduce((s,x)=>s+(x-mean)**2,0) / Math.max(1, trimmed.length-1)
  const sd = Math.sqrt(variance)
  const se = sd / Math.sqrt(Math.max(1, trimmed.length))
  const ci = 1.96 * se
  return { seconds: Math.round(mean), ci: Math.round(ci) }
}

export function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds/3600)
  const m = Math.floor((totalSeconds%3600)/60)
  const s = Math.round(totalSeconds%60)
  return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
}
