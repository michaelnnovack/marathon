// Core User Types
export interface User {
  id: string
  name: string
  raceDate?: string // ISO date string
  goalTime?: string // HH:MM:SS
  currentFitness?: number // arbitrary scale 0-100
}

// Activity & Training Types
export interface TrackPoint {
  lat: number
  lng: number
  elevation?: number
  time?: string
  heartRate?: number
  speed?: number
}

export interface SimpleActivity {
  id?: string
  date?: string
  distance: number // meters
  duration: number // seconds
  avgHr?: number
  maxHr?: number
  elevationGain?: number
  trackPoints?: TrackPoint[]
  type?: WorkoutType
  calories?: number
  avgPace?: number // meters per second
}

export type WorkoutType = 'easy' | 'tempo' | 'interval' | 'long' | 'recovery' | 'cross' | 'race'

export interface WorkoutData {
  distance?: number // meters
  duration?: number // seconds
  avgHr?: number
  maxHr?: number
  elevationGain?: number // meters
  trainingLoad?: number
  calories?: number
  avgPace?: number // meters per second
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

// Training Plan Types
export interface Week {
  start: string // ISO date
  phase?: 'base' | 'build' | 'peak' | 'taper'
  days: Workout[]
  totalDistance?: number
  totalDuration?: number
}

export interface TrainingPlan {
  userId: string
  weeks: Week[]
  currentWeek: number
  focusAreas: string[]
  createdAt: string
  updatedAt: string
}

// Heart Rate Zone Types
export interface HeartRateZone {
  zone: number
  name: string
  percentage: [number, number]
  bpm: [number, number]
  description: string
  color: string
}

export interface HeartRateZones {
  maxHR: number
  restingHR: number
  zones: HeartRateZone[]
  lastUpdated: string
}

// Performance & Analytics Types
export interface PredictionResult {
  seconds: number
  ci: number // confidence interval in seconds
  reliability: 'low' | 'medium' | 'high'
  basedOnActivities: number
}

export interface WeeklyMileage {
  week: string
  km: number
  activities: number
  avgPace?: number
}

export interface PerformanceMetrics {
  weekly: WeeklyMileage[]
  thisWeekKm: number
  last4WeeksKm: number
  prediction: PredictionResult
  workoutsLogged: number
  totalDistance: number
  totalDuration: number
}

// UI & Component Types
export interface LoadingState {
  isLoading: boolean
  error?: string
  lastUpdated?: string
}

export interface CacheEntry<T> {
  data: T
  checksum: string
  timestamp: number
  expiresAt: number
}

export interface ComponentError {
  message: string
  stack?: string
  componentName: string
  timestamp: number
}

// Chart & Visualization Types
export interface ChartDataPoint {
  x: number | string
  y: number
  label?: string
  color?: string
}

export interface ChartConfig {
  width?: number
  height?: number
  margin?: { top: number; right: number; bottom: number; left: number }
  responsive?: boolean
  theme?: 'light' | 'dark'
}

// API & External Service Types
export interface UnsplashImageConfig {
  query: string
  width?: number
  height?: number
  quality?: number
  fallbackColor?: string
}

export interface GeolocationBounds {
  north: number
  south: number
  east: number
  west: number
}

// Store State Types
export interface UserState extends LoadingState {
  user: User | null
  hydrate: () => Promise<void>
  setUser: (user: User) => void
  updateUser: (updates: Partial<User>) => void
  clearUser: () => void
}

export interface ActivitiesState extends LoadingState {
  list: SimpleActivity[]
  addActivities: (activities: SimpleActivity[]) => void
  addActivity: (activity: SimpleActivity) => void
  updateActivity: (id: string, updates: Partial<SimpleActivity>) => void
  removeActivity: (id: string) => void
  clear: () => void
  hydrate: () => Promise<void>
  getById: (id: string) => SimpleActivity | undefined
  getByDateRange: (start: string, end: string) => SimpleActivity[]
}

export interface ProgressState extends LoadingState {
  completedWorkouts: string[]
  skippedWorkouts: string[]
  notes: Record<string, string>
  hydrate: () => Promise<void>
  completeWorkout: (id: string) => void
  skipWorkout: (id: string) => void
  addNote: (id: string, note: string) => void
  clear: () => void
}

// Utility Types
export type Nullable<T> = T | null
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Event Types
export interface ActivityUploadEvent {
  type: 'upload_start' | 'upload_progress' | 'upload_complete' | 'upload_error'
  payload: {
    filename?: string
    progress?: number
    activities?: SimpleActivity[]
    error?: string
  }
}

export interface PerformanceEvent {
  type: 'performance_measure'
  payload: {
    name: string
    duration: number
    timestamp: number
    metadata?: Record<string, unknown>
  }
}
