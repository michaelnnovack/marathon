// Core User Types
export type UserLevel = 'beginner' | 'intermediate' | 'advanced'
export type TrainingFocus = 'speed' | 'endurance' | 'strength' | 'recovery'

export interface UserPreferences {
  units: 'metric' | 'imperial'
  theme: 'light' | 'dark' | 'auto'
  notifications: {
    workoutReminders: boolean
    achievementAlerts: boolean
    weeklyReports: boolean
  }
  privacy: {
    shareProgress: boolean
    publicProfile: boolean
  }
}

export interface UserStats {
  totalDistance: number // meters
  totalWorkouts: number
  totalDuration: number // seconds
  averagePace: number // meters per second
  bestMarathonTime?: number // seconds
  currentStreak: number // consecutive days
  longestStreak: number // consecutive days
  lastActivityDate?: string // ISO date
}

export interface User {
  id: string
  name: string
  email?: string
  avatar?: string
  raceDate?: string // ISO date string
  goalTime?: string // HH:MM:SS
  level: UserLevel
  trainingFocus: TrainingFocus[]
  currentFitness?: number // arbitrary scale 0-100
  maxHeartRate?: number
  restingHeartRate?: number
  weight?: number // kg
  height?: number // cm
  dateOfBirth?: string // ISO date
  preferences: UserPreferences
  stats: UserStats
  createdAt: string
  updatedAt: string
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

// Achievement Types
export type AchievementType = 'distance' | 'streak' | 'pace' | 'consistency' | 'milestone'

export interface Achievement {
  id: string
  type: AchievementType
  title: string
  description: string
  icon: string
  threshold: number
  unit?: string
  unlockedAt?: string // ISO date
  progress: number // 0-1
  category: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export interface PersonalRecord {
  id: string
  type: 'fastest_5k' | 'fastest_10k' | 'fastest_half_marathon' | 'fastest_marathon' | 'longest_run' | 'most_elevation'
  value: number
  unit: string
  date: string // ISO date
  activityId?: string
  previousRecord?: number
}

// Store State Types
export interface UserState extends LoadingState {
  user: User | null
  achievements: Achievement[]
  personalRecords: PersonalRecord[]
  hydrate: () => Promise<void>
  setUser: (user: User) => void
  updateUser: (updates: Partial<User>) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  addAchievement: (achievement: Achievement) => void
  updatePersonalRecord: (record: PersonalRecord) => void
  clearUser: () => void
}

export interface AddActivitiesResult {
  added: number
  duplicates: number
  total: number
}

export interface ActivitiesState extends LoadingState {
  list: SimpleActivity[]
  addActivities: (activities: SimpleActivity[]) => AddActivitiesResult
  addActivity: (activity: SimpleActivity) => AddActivitiesResult
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
