# Unified Dashboard Implementation Guide

## Overview

This guide provides developers with the complete TypeScript interfaces, component architecture, and implementation patterns needed to build the unified coaching dashboard.

## Core TypeScript Interfaces

### Dashboard State Management

```typescript
// Enhanced dashboard state interface
interface UnifiedDashboardState {
  // Primary data (always loaded first)
  todaysWorkout: WorkoutRecommendation
  weeklyProgress: WeeklyProgressData
  raceReadiness: RaceReadinessData
  
  // Secondary data (progressive disclosure)
  heartRateZones: HeartRateZones | null
  postWorkoutFeedback: PostWorkoutFeedback | null
  weeklyRunsDetail: WeeklyRunDetail[]
  
  // Meta state
  loading: {
    primary: boolean
    secondary: boolean
    sync: boolean
  }
  error: string | null
  lastUpdated: string
}

// Today's workout with enhanced intervals support
interface WorkoutRecommendation {
  id: string
  date: string // ISO date
  type: WorkoutType
  title: string // "Tempo Run", "Long Run", "Speed Work"
  
  // Basic workout data
  targetDistance: number // meters
  targetPace: string // "5:45/km"
  estimatedDuration: number // minutes
  
  // Detailed intervals breakdown
  intervals?: WorkoutIntervals
  
  // Heart rate guidance
  heartRateTarget: {
    primaryZone: number // 3 for Z3
    range: [number, number] // [148, 165]
    description: string // "Tempo effort"
  }
  
  // Coaching context
  reasoning: string
  priority: 'essential' | 'recommended' | 'optional'
  coachNotes: string[]
  
  // Completion tracking
  completed: boolean
  completedAt?: string
}

interface WorkoutIntervals {
  warmup: {
    distance?: number // meters
    duration?: number // minutes
    pace: string // "6:30/km"
    description: string // "Get legs moving"
  }
  mainSet: Array<{
    repetitions: number // 3
    distance?: number // 2000 meters
    duration?: number // seconds
    pace: string // "5:45/km"
    recovery: {
      duration: number // seconds
      type: 'active' | 'rest'
      pace?: string // for active recovery
    }
    description: string // "Build lactate threshold"
  }>
  cooldown: {
    distance?: number // meters
    duration?: number // minutes  
    pace: string // "6:30/km"
    description: string // "Gentle cool-down"
  }
}

// Weekly progress with detailed breakdowns
interface WeeklyProgressData {
  mileage: {
    current: number // km
    target: number // km
    percentage: number // 0-100
    weeklyChange: {
      absolute: number // +2.3km
      percentage: number // +5.7%
      trend: 'increasing' | 'stable' | 'decreasing'
    }
    nextWeekTarget: number // km
    averagePace: {
      current: string // "6:15/km"
      change: string // "+8s faster"
    }
  }
  
  completionStatus: {
    completed: number // 5
    total: number // 7
    nextWorkout: string // "Tempo Run"
  }
  
  weeklyRunsOverview: WeeklyRunSummary[]
}

interface WeeklyRunSummary {
  day: DayOfWeek
  date: string // ISO date
  workout: {
    type: string // "Easy Run", "Tempo", "Rest"
    distance?: string // "8K"
    isKeyWorkout: boolean
    paceSplits?: string[] // For long runs: ["6:30", "6:15", "6:00"]
  }
  status: 'completed' | 'today' | 'upcoming' | 'skipped'
  completedDistance?: number // actual distance if completed
  notes?: string
}

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'

// Race readiness with comprehensive metrics
interface RaceReadinessData {
  marathonPrediction: {
    predictedTime: string // "3:15:32"
    goalTime?: string // "3:15:00" 
    difference: string // "+32s"
    onTrack: boolean
    confidence: 'low' | 'medium' | 'high'
    basedOnActivities: number
    trend: {
      direction: 'improving' | 'stable' | 'declining'
      recentChange: string // "+30s improvement vs last month"
    }
  }
  
  weeklyComparison: {
    distance: {
      thisWeek: number // km
      lastWeek: number
      change: string // "+2.3km"
      percentage: number // 5.7
    }
    pace: {
      thisWeek: string // "6:15/km"
      lastWeek: string // "6:30/km" 
      change: string // "+15s/km faster"
      trend: 'faster' | 'slower' | 'similar'
    }
    efficiency: {
      heartRatePaceRatio: number // improving/declining %
      trend: 'improving' | 'stable' | 'declining'
    }
  }
  
  readinessScore: {
    overall: number // 0-100
    level: 'excellent' | 'good' | 'fair' | 'needs-work' // Based on score ranges
    components: {
      aerobicBase: number // 85
      speedWork: number // 70
      endurance: number // 82  
      recovery: number // 75
    }
    recommendations: string[]
    priorityFocusAreas: string[]
  }
}

// Post-workout feedback system
interface PostWorkoutFeedback {
  activityId: string
  generatedAt: string
  
  // Core coaching feedback
  coaching: {
    performance: {
      summary: string // "Strong tempo effort today"
      details: {
        paceAccuracy: string // "Average 5:47/km (target: 5:45/km)"
        heartRateControl: string // "Stayed in Z3 consistently"
        effortConsistency: string // "Good pacing control"
      }
    }
    
    effort: {
      summary: string // "Excellent execution"
      heartRateEfficiency: {
        change: number // +2% vs last tempo
        trend: 'improving' | 'stable' | 'declining'
      }
      perceivedEffort: number // 1-10 if user provides
    }
    
    nextSteps: {
      immediateRecovery: string // "Easy 6K tomorrow"
      upcomingFocus: string // "Build on this lactate threshold work"
      trainingAdjustments?: string[] // Any plan modifications needed
    }
    
    encouragement: string // Personalized motivation
  }
  
  // Quantitative analysis
  metrics: {
    trainingLoad: {
      impact: 'low' | 'moderate' | 'high'
      tssScore?: number // Training Stress Score if available
      recoveryTime: string // "24-36 hours"
    }
    
    achievements: string[] // Any PRs or milestones hit
    concerns: string[] // Any red flags identified
  }
  
  // User interaction
  userResponse?: {
    rating: number // 1-5 stars for workout
    notes: string
    perceivedEffort: number // 1-10 RPE
  }
  
  dismissed: boolean
  dismissedAt?: string
}
```

## Component Architecture

### 1. Main Dashboard Container

```typescript
// UnifiedDashboard.tsx
interface UnifiedDashboardProps {
  userId: string
  className?: string
}

const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({ 
  userId, 
  className 
}) => {
  const {
    state,
    actions: {
      refreshData,
      completeWorkout,
      dismissFeedback,
      updateHeartRateZones
    }
  } = useDashboardState(userId)

  // Handle real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.loading.primary) {
        refreshData({ forceRefresh: false })
      }
    }, 15 * 60 * 1000) // 15 minutes

    return () => clearInterval(interval)
  }, [refreshData, state.loading.primary])

  if (state.loading.primary) {
    return <DashboardSkeleton />
  }

  return (
    <div className={`unified-dashboard ${className}`}>
      <DashboardHeader 
        userName={state.user?.name}
        lastSync={state.lastUpdated}
        syncStatus={state.loading.sync ? 'syncing' : 'synced'}
        onSync={() => refreshData({ forceRefresh: true })}
        error={state.error}
      />

      <div className="dashboard-content space-y-8">
        {/* Hero Section - Always visible */}
        <TodaysWorkoutHero
          workout={state.todaysWorkout}
          onComplete={completeWorkout}
          onModify={() => router.push('/plan')}
        />

        {/* Weekly Progress Section */}
        <WeeklyProgressSection
          data={state.weeklyProgress}
          heartRateZones={state.heartRateZones}
          onUpdateHeartRateZones={updateHeartRateZones}
          weeklyRuns={state.weeklyRunsDetail}
        />

        {/* Race Readiness Section */}
        <RaceReadinessSection
          data={state.raceReadiness}
          isLoading={state.loading.secondary}
        />

        {/* Post-Workout Feedback Modal */}
        {state.postWorkoutFeedback && !state.postWorkoutFeedback.dismissed && (
          <PostWorkoutFeedbackModal
            feedback={state.postWorkoutFeedback}
            onDismiss={dismissFeedback}
            onRateWorkout={(rating, notes) => 
              updateFeedbackResponse(state.postWorkoutFeedback.activityId, { rating, notes })
            }
          />
        )}
      </div>
    </div>
  )
}
```

### 2. Today's Workout Hero Component

```typescript
// TodaysWorkoutHero.tsx
interface TodaysWorkoutHeroProps {
  workout: WorkoutRecommendation
  onComplete: () => void
  onModify: () => void
}

const TodaysWorkoutHero: React.FC<TodaysWorkoutHeroProps> = ({
  workout,
  onComplete,
  onModify
}) => {
  const [showIntervals, setShowIntervals] = useState(false)
  const [completingWorkout, setCompletingWorkout] = useState(false)

  const handleComplete = async () => {
    setCompletingWorkout(true)
    try {
      await onComplete()
      // Success feedback will be handled by parent component
    } catch (error) {
      console.error('Failed to complete workout:', error)
      // Show error state
    } finally {
      setCompletingWorkout(false)
    }
  }

  return (
    <Card className="hero-workout-card">
      <div className="hero-header">
        <div className="workout-badge">
          <Target className="w-5 h-5" />
          <span>TODAY'S WORKOUT</span>
        </div>
        
        {workout.priority === 'essential' && (
          <PriorityBadge priority="essential" />
        )}
      </div>

      <div className="hero-content">
        <h1 className="workout-title">
          {workout.type} • {formatDistance(workout.targetDistance)} at {workout.targetPace}
        </h1>
        
        <div className="heart-rate-indicator">
          <Heart className="w-5 h-5" />
          <span>
            Target: Z{workout.heartRateTarget.primaryZone} 
            ({workout.heartRateTarget.range[0]}-{workout.heartRateTarget.range[1]} bpm)
          </span>
        </div>

        {/* Expandable intervals section */}
        {workout.intervals && (
          <div className="intervals-section">
            <button
              onClick={() => setShowIntervals(!showIntervals)}
              className="intervals-toggle"
              aria-expanded={showIntervals}
            >
              <ClipboardList className="w-5 h-5" />
              INTERVALS
              <ChevronDown className={`w-4 h-4 transition-transform ${
                showIntervals ? 'rotate-180' : ''
              }`} />
            </button>
            
            {showIntervals && (
              <IntervalBreakdown intervals={workout.intervals} />
            )}
          </div>
        )}

        <p className="workout-reasoning">
          {workout.reasoning}
        </p>
      </div>

      <div className="hero-actions">
        <Button
          onClick={handleComplete}
          disabled={completingWorkout || workout.completed}
          className="complete-button"
          leftIcon={<CheckCircle className="w-5 h-5" />}
        >
          {completingWorkout ? 'Completing...' : 
           workout.completed ? 'Completed' : 'Mark Complete'}
        </Button>
        
        <Button
          variant="outline"
          onClick={onModify}
          className="modify-button"
          leftIcon={<Edit className="w-5 h-5" />}
        >
          Modify Plan
        </Button>
      </div>
    </Card>
  )
}
```

### 3. Weekly Progress Section (3-Column Desktop, Stacked Mobile)

```typescript
// WeeklyProgressSection.tsx
interface WeeklyProgressSectionProps {
  data: WeeklyProgressData
  heartRateZones: HeartRateZones | null
  onUpdateHeartRateZones: (zones: HeartRateZones) => void
  weeklyRuns: WeeklyRunDetail[]
}

const WeeklyProgressSection: React.FC<WeeklyProgressSectionProps> = ({
  data,
  heartRateZones,
  onUpdateHeartRateZones,
  weeklyRuns
}) => {
  return (
    <section className="weekly-progress-section">
      <SectionHeader title="THIS WEEK" />
      
      <div className="progress-grid">
        {/* Column 1: Mileage Progress */}
        <Card className="mileage-progress-card">
          <h3>Weekly Mileage Progress</h3>
          
          <div className="mileage-main">
            <ProgressBar
              current={data.mileage.current}
              target={data.mileage.target}
              percentage={data.mileage.percentage}
              className="weekly-progress-bar"
            />
            
            <div className="mileage-stats">
              <div className="stat-item">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span>{data.mileage.weeklyChange.absolute}km vs last week</span>
              </div>
              
              <div className="stat-item">
                <Clock className="w-4 h-4" />
                <span>Average pace: {data.mileage.averagePace.current}</span>
                <span className="change-indicator positive">
                  {data.mileage.averagePace.change}
                </span>
              </div>
            </div>
          </div>
          
          <div className="next-week-target">
            <span>Target next week: {data.mileage.nextWeekTarget}km</span>
            <span className="increase-note">
              (+{((data.mileage.nextWeekTarget - data.mileage.current) / data.mileage.current * 100).toFixed(1)}% increase)
            </span>
          </div>
        </Card>

        {/* Column 2: Heart Rate Zones */}
        <Card className="heart-rate-zones-card">
          <h3>Heart Rate Zones</h3>
          
          {heartRateZones ? (
            <HeartRateZonesQuickReference
              zones={heartRateZones.zones}
              onExpand={() => setShowFullCalculator(true)}
            />
          ) : (
            <HeartRateZonesSetup
              onCalculate={onUpdateHeartRateZones}
            />
          )}
        </Card>

        {/* Column 3: Weekly Runs Overview */}
        <Card className="weekly-runs-card">
          <div className="runs-header">
            <h3>Weekly Runs Overview</h3>
            <div className="completion-status">
              {data.completionStatus.completed}/{data.completionStatus.total} complete
            </div>
          </div>
          
          <WeeklyRunsList
            runs={data.weeklyRunsOverview}
            onRunClick={(run) => {
              if (run.workout.isKeyWorkout) {
                setShowRunDetail(run)
              }
            }}
          />
        </Card>
      </div>
    </section>
  )
}
```

### 4. Race Readiness Section

```typescript
// RaceReadinessSection.tsx
interface RaceReadinessSectionProps {
  data: RaceReadinessData
  isLoading: boolean
}

const RaceReadinessSection: React.FC<RaceReadinessSectionProps> = ({
  data,
  isLoading
}) => {
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false)

  if (isLoading) {
    return <RaceReadinessSkeleton />
  }

  return (
    <section className="race-readiness-section">
      <SectionHeader title="RACE READINESS" />
      
      <div className="readiness-grid">
        {/* Column 1: Marathon Prediction */}
        <Card className="prediction-card">
          <h3>Marathon Prediction</h3>
          
          <div className="prediction-main">
            <div className="predicted-time">
              <Clock className="w-6 h-6" />
              <span className="time">{data.marathonPrediction.predictedTime}</span>
            </div>
            
            <div className="prediction-status">
              <OnTrackIndicator onTrack={data.marathonPrediction.onTrack} />
              <span className="goal-difference">
                {data.marathonPrediction.difference} vs goal
              </span>
            </div>
            
            <div className="prediction-meta">
              <span className="confidence">
                Confidence: {data.marathonPrediction.confidence}
              </span>
              <span className="based-on">
                Based on {data.marathonPrediction.basedOnActivities} activities
              </span>
            </div>
            
            <div className="trend">
              <TrendIndicator trend={data.marathonPrediction.trend.direction} />
              <span>{data.marathonPrediction.trend.recentChange}</span>
            </div>
          </div>
        </Card>

        {/* Column 2: Weekly Comparison */}
        <Card className="comparison-card">
          <h3>Weekly Comparison</h3>
          
          <div className="comparison-metrics">
            <div className="metric-group">
              <h4>Distance vs Last Week</h4>
              <div className="metric-value">
                <span className="current">{data.weeklyComparison.distance.thisWeek}km</span>
                <ComparisonArrow
                  change={data.weeklyComparison.distance.change}
                  positive={data.weeklyComparison.distance.percentage > 0}
                />
              </div>
              <div className="metric-detail">
                Last week: {data.weeklyComparison.distance.lastWeek}km
              </div>
            </div>
            
            <div className="metric-group">
              <h4>Pace vs Last Week</h4>
              <div className="metric-value">
                <span className="current">{data.weeklyComparison.pace.thisWeek}</span>
                <ComparisonArrow
                  change={data.weeklyComparison.pace.change}
                  positive={data.weeklyComparison.pace.trend === 'faster'}
                />
              </div>
              <div className="metric-detail">
                Last week: {data.weeklyComparison.pace.lastWeek}
              </div>
            </div>
            
            <div className="efficiency-indicator">
              <Activity className="w-4 h-4" />
              <span>HR/Pace efficiency</span>
              <TrendIndicator trend={data.weeklyComparison.efficiency.trend} />
              <span>{data.weeklyComparison.efficiency.heartRatePaceRatio > 0 ? '+' : ''}{data.weeklyComparison.efficiency.heartRatePaceRatio}%</span>
            </div>
          </div>
        </Card>

        {/* Column 3: Readiness Score */}
        <Card className="readiness-score-card">
          <h3>Readiness Assessment</h3>
          
          <div className="overall-score">
            <div className="score-circle">
              <span className="score-number">{data.readinessScore.overall}</span>
              <span className="score-total">/ 100</span>
            </div>
            <div className="score-level">
              <ReadinessLevelBadge level={data.readinessScore.level} />
            </div>
          </div>
          
          <div className="component-breakdown">
            <h4>Component Breakdown</h4>
            {Object.entries(data.readinessScore.components).map(([key, value]) => (
              <div key={key} className="component-item">
                <span className="component-name">{formatComponentName(key)}:</span>
                <ProgressBar
                  current={value}
                  target={100}
                  percentage={value}
                  size="small"
                  showText
                />
              </div>
            ))}
          </div>
          
          <div className="focus-areas">
            <h4>Priority Focus Areas</h4>
            <ul className="focus-list">
              {data.readinessScore.priorityFocusAreas.map((area, index) => (
                <li key={index} className="focus-item">
                  <Lightbulb className="w-4 h-4" />
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <Button
            variant="outline"
            onClick={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
            className="detailed-breakdown-button"
          >
            <BarChart3 className="w-4 h-4" />
            Detailed Assessment
          </Button>
        </Card>
      </div>
      
      {/* Detailed Breakdown Modal/Expandable Section */}
      {showDetailedBreakdown && (
        <DetailedReadinessBreakdown
          data={data.readinessScore}
          onClose={() => setShowDetailedBreakdown(false)}
        />
      )}
    </section>
  )
}
```

## State Management with Zustand

```typescript
// useDashboardState.ts
interface DashboardStore {
  state: UnifiedDashboardState
  actions: {
    refreshData: (options?: { forceRefresh?: boolean }) => Promise<void>
    completeWorkout: (workoutId?: string) => Promise<void>
    dismissFeedback: (feedbackId: string) => void
    updateHeartRateZones: (zones: HeartRateZones) => void
    updateFeedbackResponse: (activityId: string, response: any) => void
  }
}

const useDashboardStore = create<DashboardStore>((set, get) => ({
  state: {
    todaysWorkout: null,
    weeklyProgress: null,
    raceReadiness: null,
    heartRateZones: null,
    postWorkoutFeedback: null,
    weeklyRunsDetail: [],
    loading: {
      primary: true,
      secondary: false,
      sync: false
    },
    error: null,
    lastUpdated: null
  },

  actions: {
    refreshData: async (options = {}) => {
      const { forceRefresh = false } = options
      
      set(state => ({
        state: {
          ...state.state,
          loading: {
            ...state.state.loading,
            sync: true
          },
          error: null
        }
      }))

      try {
        // Fetch dashboard data from API
        const response = await fetch(`/api/coaching/dashboard?userId=${userId}&refresh=${forceRefresh}`)
        const { data } = await response.json()

        set(state => ({
          state: {
            ...state.state,
            ...data,
            loading: {
              primary: false,
              secondary: false,
              sync: false
            },
            lastUpdated: new Date().toISOString()
          }
        }))
      } catch (error) {
        set(state => ({
          state: {
            ...state.state,
            loading: {
              primary: false,
              secondary: false,
              sync: false
            },
            error: error.message
          }
        }))
      }
    },

    completeWorkout: async (workoutId) => {
      const { state } = get()
      const workout = workoutId ? 
        state.weeklyRunsDetail.find(r => r.id === workoutId) : 
        state.todaysWorkout

      if (!workout) return

      try {
        // Mark workout complete
        const response = await fetch('/api/workouts/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workoutId: workout.id })
        })

        if (response.ok) {
          // Generate post-workout feedback
          const feedbackResponse = await fetch('/api/coaching/post-workout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              workoutId: workout.id,
              userId 
            })
          })

          const { feedback } = await feedbackResponse.json()

          set(state => ({
            state: {
              ...state.state,
              todaysWorkout: {
                ...state.state.todaysWorkout,
                completed: true,
                completedAt: new Date().toISOString()
              },
              postWorkoutFeedback: feedback
            }
          }))
        }
      } catch (error) {
        console.error('Failed to complete workout:', error)
        throw error
      }
    },

    dismissFeedback: (feedbackId) => {
      set(state => ({
        state: {
          ...state.state,
          postWorkoutFeedback: state.state.postWorkoutFeedback?.activityId === feedbackId ? 
            { ...state.state.postWorkoutFeedback, dismissed: true } : 
            state.state.postWorkoutFeedback
        }
      }))
    },

    updateHeartRateZones: (zones) => {
      set(state => ({
        state: {
          ...state.state,
          heartRateZones: zones
        }
      }))
      
      // Persist to user profile
      fetch('/api/user/heart-rate-zones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones, userId })
      })
    },

    updateFeedbackResponse: async (activityId, response) => {
      try {
        await fetch('/api/coaching/feedback-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId, response, userId })
        })

        set(state => ({
          state: {
            ...state.state,
            postWorkoutFeedback: state.state.postWorkoutFeedback?.activityId === activityId ?
              {
                ...state.state.postWorkoutFeedback,
                userResponse: response
              } :
              state.state.postWorkoutFeedback
          }
        }))
      } catch (error) {
        console.error('Failed to save feedback response:', error)
      }
    }
  }
}))

export const useDashboardState = (userId: string) => {
  const store = useDashboardStore()
  
  // Initialize data on mount
  useEffect(() => {
    store.actions.refreshData()
  }, [userId])
  
  return store
}
```

## Styling Guidelines (Tailwind CSS)

### Design System Variables

```css
/* Custom CSS variables for the unified dashboard */
:root {
  /* Spacing scale optimized for dashboard layout */
  --dashboard-section-gap: 2rem;
  --dashboard-card-padding: 1.5rem;
  --dashboard-mobile-padding: 1rem;
  
  /* Typography scale for information hierarchy */
  --hero-title-size: 2rem;
  --section-title-size: 1.25rem;
  --metric-value-size: 1.75rem;
  --body-text-size: 0.875rem;
  --caption-text-size: 0.75rem;
  
  /* Color system for coaching context */
  --progress-excellent: #10b981;
  --progress-good: #3b82f6;
  --progress-warning: #f59e0b;
  --progress-danger: #ef4444;
  
  /* Heart rate zone colors */
  --hr-zone-1: #3b82f6;  /* Recovery - Blue */
  --hr-zone-2: #10b981;  /* Aerobic - Green */
  --hr-zone-3: #f59e0b;  /* Tempo - Yellow */
  --hr-zone-4: #f97316;  /* Threshold - Orange */
  --hr-zone-5: #ef4444;  /* VO2 Max - Red */
}

/* Dashboard-specific component styles */
.unified-dashboard {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
}

.dashboard-content {
  @apply space-y-8;
}

.section-header {
  @apply text-lg font-semibold mb-4 tracking-wide text-gray-900 dark:text-gray-100;
}

/* Hero section styles */
.hero-workout-card {
  @apply bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 
         border border-blue-200 dark:border-blue-800 rounded-3xl p-8;
}

.workout-title {
  @apply text-4xl font-bold mb-3 text-gray-900 dark:text-gray-100;
}

.heart-rate-indicator {
  @apply flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium;
}

/* Progress section grid */
.progress-grid {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-6;
}

.progress-grid > .card {
  @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
         rounded-xl p-6 shadow-sm;
}

/* Race readiness grid */
.readiness-grid {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-6;
}

/* Responsive breakpoint utilities */
@media (max-width: 1023px) {
  .progress-grid {
    @apply grid-cols-1 md:grid-cols-2;
  }
  
  .readiness-grid {
    @apply grid-cols-1 md:grid-cols-2;
  }
}

@media (max-width: 767px) {
  .hero-workout-card {
    @apply p-6;
  }
  
  .workout-title {
    @apply text-2xl;
  }
  
  .progress-grid,
  .readiness-grid {
    @apply grid-cols-1 gap-4;
  }
}
```

## Performance Optimization

### 1. Code Splitting Strategy

```typescript
// Lazy load heavy components
const DetailedReadinessBreakdown = lazy(() => 
  import('./DetailedReadinessBreakdown').then(module => ({
    default: module.DetailedReadinessBreakdown
  }))
)

const HeartRateCalculator = lazy(() =>
  import('./HeartRateCalculator').then(module => ({
    default: module.HeartRateCalculator  
  }))
)

// Use React.Suspense with meaningful fallbacks
<Suspense fallback={<DetailedBreakdownSkeleton />}>
  <DetailedReadinessBreakdown data={data} />
</Suspense>
```

### 2. Data Fetching Optimization

```typescript
// Implement stale-while-revalidate pattern
const useDashboardData = (userId: string) => {
  const { data, mutate } = useSWR(
    `/api/coaching/dashboard?userId=${userId}`,
    fetcher,
    {
      refreshInterval: 15 * 60 * 1000, // 15 minutes
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  )

  return {
    data,
    isLoading: !data && !error,
    refresh: () => mutate()
  }
}
```

### 3. Bundle Size Optimization

```javascript
// webpack.config.js optimizations
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        dashboard: {
          name: 'dashboard',
          test: /[\\/]components[\\/](Dashboard|TodaysWorkout|WeeklyProgress|RaceReadiness)/,
          priority: 10
        },
        charts: {
          name: 'charts',
          test: /[\\/]node_modules[\\/](recharts|d3)/,
          priority: 20
        }
      }
    }
  }
}
```

## Testing Strategy

### 1. Component Testing with React Testing Library

```typescript
// TodaysWorkoutHero.test.tsx
describe('TodaysWorkoutHero', () => {
  const mockWorkout: WorkoutRecommendation = {
    id: '1',
    date: '2024-01-15',
    type: 'tempo',
    title: 'Tempo Run',
    targetDistance: 8000,
    targetPace: '5:45/km',
    heartRateTarget: {
      primaryZone: 3,
      range: [148, 165],
      description: 'Tempo effort'
    },
    reasoning: 'Build lactate threshold',
    priority: 'essential',
    completed: false
  }

  it('displays workout information correctly', () => {
    render(
      <TodaysWorkoutHero
        workout={mockWorkout}
        onComplete={jest.fn()}
        onModify={jest.fn()}
      />
    )

    expect(screen.getByText('Tempo Run • 8K at 5:45/km')).toBeInTheDocument()
    expect(screen.getByText('Target: Z3 (148-165 bpm)')).toBeInTheDocument()
    expect(screen.getByText('Build lactate threshold')).toBeInTheDocument()
  })

  it('calls onComplete when complete button is clicked', async () => {
    const mockOnComplete = jest.fn()
    render(
      <TodaysWorkoutHero
        workout={mockWorkout}
        onComplete={mockOnComplete}
        onModify={jest.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /mark complete/i }))
    expect(mockOnComplete).toHaveBeenCalledTimes(1)
  })

  it('shows intervals when expanded', async () => {
    const workoutWithIntervals = {
      ...mockWorkout,
      intervals: {
        warmup: { distance: 1000, pace: '6:30/km', description: 'Easy warmup' },
        mainSet: [
          {
            repetitions: 3,
            distance: 2000,
            pace: '5:45/km',
            recovery: { duration: 90, type: 'active' },
            description: 'Tempo intervals'
          }
        ],
        cooldown: { distance: 1000, pace: '6:30/km', description: 'Easy cooldown' }
      }
    }

    render(
      <TodaysWorkoutHero
        workout={workoutWithIntervals}
        onComplete={jest.fn()}
        onModify={jest.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /intervals/i }))
    expect(screen.getByText('Easy warmup')).toBeInTheDocument()
    expect(screen.getByText('3 x 2K @ 5:45/km')).toBeInTheDocument()
  })
})
```

### 2. Integration Testing

```typescript
// Dashboard.integration.test.tsx
describe('UnifiedDashboard Integration', () => {
  it('loads and displays all sections correctly', async () => {
    const mockApiResponse = {
      todaysWorkout: mockWorkout,
      weeklyProgress: mockWeeklyProgress,
      raceReadiness: mockRaceReadiness
    }

    server.use(
      rest.get('/api/coaching/dashboard', (req, res, ctx) => {
        return res(ctx.json({ success: true, data: mockApiResponse }))
      })
    )

    render(<UnifiedDashboard userId="test-user" />)

    // Verify loading states
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('TODAY\'S WORKOUT')).toBeInTheDocument()
      expect(screen.getByText('THIS WEEK')).toBeInTheDocument()
      expect(screen.getByText('RACE READINESS')).toBeInTheDocument()
    })
  })

  it('handles workout completion flow', async () => {
    render(<UnifiedDashboard userId="test-user" />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark complete/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /mark complete/i }))

    // Verify post-workout feedback appears
    await waitFor(() => {
      expect(screen.getByText(/workout complete/i)).toBeInTheDocument()
    })
  })
})
```

This implementation guide provides developers with everything needed to build the unified coaching dashboard, following the design specifications and maintaining the no-nonsense, data-driven coaching personality throughout the interface.