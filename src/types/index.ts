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

// Enhanced PR Types (imported from prTracking.ts)
export type PRType = 
  | 'fastest_1k'
  | 'fastest_5k' 
  | 'fastest_10k'
  | 'fastest_half_marathon'
  | 'fastest_marathon'
  | 'longest_run'
  | 'most_weekly_volume'
  | 'most_elevation_gain'

export interface PRData {
  id: string
  type: PRType
  distance: RaceDistance | 'longest_run' | 'weekly_volume' | 'elevation'
  value: number // seconds for time PRs, meters for distance, elevation
  pace?: number // seconds per km for time-based PRs
  date: string
  activityId?: string
  previousRecord?: number
  improvement?: number // seconds or meters improved
  improvementPercent?: number
  confidence: 'high' | 'medium' | 'low'
  conditions?: {
    temperature?: number
    weather?: string
    course: 'flat' | 'hilly' | 'mixed' | 'unknown'
    surface?: 'road' | 'track' | 'trail' | 'treadmill'
  }
}

export interface PRHistory {
  type: PRType
  records: PRData[]
  currentPR?: PRData
  previousPR?: PRData
  improvement30Days?: number
  improvement90Days?: number
  improvementTrend: 'improving' | 'stable' | 'declining'
}

export interface PRAnalysis {
  recentPRs: PRData[] // PRs from last 90 days
  improvements: {
    count30Days: number
    count90Days: number
    averageImprovement: number
    significantImprovements: PRData[] // > 5% improvement
  }
  injuryRiskFactors: {
    rapidImprovement: boolean
    frequentPRs: boolean
    riskScore: number // 0-100
    warnings: string[]
  }
  potentialPRs: {
    activity: SimpleActivity
    estimatedPR: PRData
    confidence: number
  }[]
}

// Store State Types
export interface UserState extends LoadingState {
  user: User | null
  achievements: Achievement[]
  personalRecords: PersonalRecord[]
  prHistories: PRHistory[]
  prAnalysis?: PRAnalysis
  hydrate: () => Promise<void>
  setUser: (user: User) => void
  updateUser: (updates: Partial<User>) => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  addAchievement: (achievement: Achievement) => void
  updatePersonalRecord: (record: PersonalRecord) => void
  updatePRData: (prData: PRData) => void
  analyzePRs: () => void
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
  refreshFromIntervalsIcu: (limit?: number) => Promise<void>
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

// Enhanced Coaching Types
export type RaceDistance = '5K' | '10K' | 'Half Marathon' | 'Marathon'

export interface PersonalRecord {
  id: string
  distance: RaceDistance
  time: number // seconds
  pace: number // seconds per km
  date: string // ISO date
  activityId?: string
  confidence: 'estimated' | 'actual' // whether from race or training run
  conditions?: {
    temperature?: number
    humidity?: number
    elevation?: number
    course: 'flat' | 'hilly' | 'mixed'
  }
}

export interface TrainingStressBalance {
  ctl: number // Chronic Training Load (fitness)
  atl: number // Acute Training Load (fatigue) 
  tsb: number // Training Stress Balance (form)
  rampRate: number // weekly training load increase %
  lastUpdated: string
}

export interface RaceReadinessScore {
  overall: number // 0-100
  components: {
    aerobicBase: number // 0-100, based on weekly mileage trends and Z2 work
    lactateThreshold: number // 0-100, based on tempo/threshold work
    neuromuscularPower: number // 0-100, based on interval/speed work
    strengthMobility: number // 0-100, based on consistency and injury history
    mentalPreparation: number // 0-100, based on long runs and race experience
  }
  recommendations: string[]
  lastCalculated: string
}

export interface InjuryRisk {
  overall: 'low' | 'moderate' | 'high'
  score: number // 0-100
  factors: {
    trainingLoadProgression: number // weekly mileage increase
    intensityDistribution: number // % of hard vs easy training
    recoveryAdequacy: number // based on HRV, sleep, subjective feel
    historicalPattern: number // based on past injuries
  }
  recommendations: string[]
  lastAssessed: string
}

export interface WorkoutRecommendation {
  id: string
  date: string
  type: WorkoutType
  title: string
  description: string
  targetDistance?: number // meters
  targetDuration?: number // minutes
  intervals?: {
    warmup: { distance?: number; duration?: number; pace?: string }
    mainSet: Array<{
      repetitions: number
      distance?: number // meters
      duration?: number // seconds
      pace: string // e.g., "5:20/km"
      recovery: { duration: number; type: 'active' | 'rest' }
    }>
    cooldown: { distance?: number; duration?: number; pace?: string }
  }
  paceGuidance: {
    easy?: string
    marathon?: string
    tempo?: string
    interval?: string
  }
  heartRateGuidance?: {
    zone1?: [number, number] // recovery
    zone2?: [number, number] // aerobic
    zone3?: [number, number] // tempo
    zone4?: [number, number] // threshold
    zone5?: [number, number] // VO2max
  }
  reasoning: string // why this workout was recommended
  priority: 'essential' | 'recommended' | 'optional'
}

export interface WeeklyPlan {
  week: string // ISO date of Monday
  phase: 'base' | 'build' | 'peak' | 'taper' | 'recovery'
  targetMileage: number // km
  workouts: WorkoutRecommendation[]
  focusAreas: string[]
  keyWorkout?: string // id of the most important workout
  adaptations?: string[] // adjustments based on recent performance
}

export interface HREfficiencyAnalysis {
  trend: 'improving' | 'stable' | 'declining'
  efficiencyScore: number // 0-100, higher = better efficiency
  recentSamples: Array<{
    date: string
    pace: number // min/km
    heartRate: number
    efficiency: number
  }>
  recommendations: string[]
}

export interface PostWorkoutFeedback {
  activityId: string
  holisticCoaching: {
    performance: string
    effort: string
    nextSteps: string
    encouragement: string
  }
  hrEfficiency: HREfficiencyAnalysis
  trainingStress: {
    impact: 'low' | 'moderate' | 'high'
    recovery: string
    nextWorkout: string
  }
  achievements?: string[]
  concerns?: string[]
}

// Enhanced Performance Metrics for Dashboard
export interface DashboardMetrics {
  weeklyMileage: {
    current: number
    previous: number
    percentChange: number
    trend: 'increasing' | 'stable' | 'decreasing'
    target: number
  }
  personalRecords: PersonalRecord[]
  raceReadiness: RaceReadinessScore
  injuryRisk: InjuryRisk
  trainingStress: TrainingStressBalance
  todaysWorkout: WorkoutRecommendation
  weeklyPlan: WeeklyPlan
  recentFeedback: PostWorkoutFeedback[]
  marathonPrediction: PredictionResult & {
    targetTime?: number
    onTrack: boolean
    timeToTarget?: number // days
  }
}

// Data Layer Types
export interface CoachingMetrics {
  userId: string
  weeklyMileage: number
  fourWeekAverage: number
  longestRun: number
  averagePace: number
  volumeProgression: number // weekly change %
  intensityBalance: {
    easy: number    // % of weekly volume
    moderate: number
    hard: number
  }
  lastUpdated: string
}

// Event Types
export interface PerformanceEvent {
  type: 'performance_measure'
  payload: {
    name: string
    duration: number
    timestamp: number
    metadata?: Record<string, unknown>
  }
}
