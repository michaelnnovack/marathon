export interface User {
  id: string
  name: string
  raceDate?: string // ISO date string
  goalTime?: string // HH:MM:SS
  currentFitness?: number // arbitrary scale 0-100
}

export type WorkoutType = 'easy' | 'tempo' | 'interval' | 'long' | 'recovery' | 'cross'

export interface WorkoutData {
  distance?: number // meters
  duration?: number // seconds
  avgHr?: number
  elevationGain?: number // meters
  trainingLoad?: number
}

export interface Workout {
  id: string
  date: string // ISO date
  type: WorkoutType
  description: string
  targetPace?: string
  duration: number // minutes
  completed: boolean
  actualData?: WorkoutData
}

export interface Week {
  start: string // ISO date
  phase?: 'base' | 'build' | 'peak' | 'taper'
  days: Workout[]
}

export interface TrainingPlan {
  userId: string
  weeks: Week[]
  currentWeek: number
  focusAreas: string[]
}

export interface HeartRateZone {
  zone: number
  name: string
  percentage: [number, number]
  bpm: [number, number]
  description: string
}

export interface HeartRateZones {
  maxHR: number
  restingHR: number
  zones: HeartRateZone[]
}
