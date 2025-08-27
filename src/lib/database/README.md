# Advanced SQLite Database for Marathon Training Coach

## Overview

This database system provides sophisticated coaching intelligence for marathon training by implementing local SQLite storage with advanced analytics capabilities. It replaces simple localStorage with a robust solution supporting complex fitness calculations, coaching recommendations, and performance analysis.

## Key Features

- **Browser-compatible SQLite** using sql.js
- **Automatic migration** from localStorage to SQLite
- **Advanced fitness metrics** (CTL/ATL/TSB calculations)
- **Real-time coaching recommendations**
- **Performance-optimized queries** with caching
- **Training consistency analysis**
- **Workout completion tracking**

## Database Schema

### Core Tables

#### `activities`
Enhanced activity storage with coaching metadata:
```sql
- id (TEXT PRIMARY KEY) - Unique activity identifier
- date (TEXT) - ISO date string
- distance (REAL) - Distance in meters
- duration (INTEGER) - Duration in seconds  
- training_stress_score (REAL) - Calculated TSS
- intensity_factor (REAL) - Workout intensity (0-1)
- source (TEXT) - Data source (intervals_icu, manual, etc.)
```

#### `fitness_metrics`
Daily fitness calculations for coaching intelligence:
```sql
- date (TEXT) - ISO date string
- chronic_training_load (REAL) - CTL (42-day exponential average)
- acute_training_load (REAL) - ATL (7-day exponential average)  
- training_stress_balance (REAL) - TSB (CTL - ATL)
- fitness_level (REAL) - 0-100 fitness score
- fatigue_level (REAL) - 0-100 fatigue score
- form_level (REAL) - -100 to +100 form score
```

#### `coach_recommendations`
Daily workout recommendations and completion tracking:
```sql
- date (TEXT) - Target workout date
- workout_type (TEXT) - easy, tempo, interval, long, recovery, rest
- recommendation_reason (TEXT) - AI reasoning
- confidence_score (REAL) - 0-1 confidence level
- completed (INTEGER) - Completion status
- adherence_score (REAL) - How well recommendation was followed
```

#### `training_plans`
Dynamic training plans with adaptation:
```sql
- name (TEXT) - Plan name
- type (TEXT) - 5k, 10k, half_marathon, marathon, custom
- current_week (INTEGER) - Current plan week
- adaptation_factor (REAL) - Plan intensity multiplier
- weeks_data (TEXT) - JSON array of weekly structure
```

#### `user_preferences`  
User settings and coaching configuration:
```sql
- coaching_enabled (INTEGER) - Enable AI coaching
- coaching_intensity (TEXT) - conservative, moderate, aggressive
- max_weekly_mileage (REAL) - Safety limit
- race_date (TEXT) - Target race date
- goal_time (TEXT) - Target finish time
```

### Performance Indexes

Optimized for fast coach calculations:
```sql
- idx_activities_date: Fast date-based queries
- idx_activities_user_date: User activity lookups  
- idx_fitness_metrics_date: Fitness trend queries
- idx_coach_recommendations_date: Recommendation history
```

### Materialized Views

Pre-calculated aggregations:
```sql
- recent_activities: Last 50 activities with computed metrics
- weekly_fitness_summary: 12-week fitness trend data
- coaching_adherence: Weekly adherence statistics
```

## Fitness Calculations

### Training Stress Score (TSS)
Quantifies workout difficulty:
```
TSS = Duration (hours) × Intensity Factor² × 100
```

Heart rate-based intensity factor:
```
IF = Average HR / Threshold HR
```

Pace-based estimation:
- < 4:00 min/km: IF = 0.95 (Very fast)
- 4:00-4:30: IF = 0.85 (Fast)  
- 4:30-5:00: IF = 0.75 (Moderate)
- 5:00-5:30: IF = 0.65 (Easy-moderate)
- > 5:30: IF = 0.55 (Easy)

### Chronic Training Load (CTL)
42-day exponentially weighted average of TSS:
```
CTL = TSS × 0.047 + Previous_CTL × 0.953
```
Represents fitness/endurance capacity.

### Acute Training Load (ATL)  
7-day exponentially weighted average of TSS:
```
ATL = TSS × 0.25 + Previous_ATL × 0.75
```
Represents recent training stress/fatigue.

### Training Stress Balance (TSB)
Form/readiness indicator:
```
TSB = CTL - ATL
```
- Positive: Fresh/peaked state
- Negative: Fatigued state  
- -10 to +10: Optimal training range

## Coaching Intelligence

### Workout Recommendations

Algorithm considers:
- Current TSB (form level)
- Days since last rest
- Fitness trend (CTL progression)
- Fatigue accumulation (ATL level)

**Decision Matrix:**
- TSB < -30 OR Fatigue > 85%: **Rest day**
- TSB < -15 OR Fatigue > 70%: **Recovery run**
- TSB < 0 OR Fitness < 40%: **Easy run**  
- TSB > 15 AND Fitness > 60%: **Interval training**
- TSB > 5 AND Fitness > 45%: **Tempo run**

### Training Consistency Analysis

Measures week-to-week variability:
```
Consistency Score = 100 - (StdDev/Mean × 100)
```

Analyzes:
- Training frequency consistency
- Weekly mileage stability  
- Training load progression
- Rest day patterns

## API Reference

### Database Initialization
```typescript
import { initializeDatabase, getDatabase } from '@/lib/database'

// Initialize database
await initializeDatabase()

// Get database instance
const db = await getDatabase()
```

### Migration System
```typescript
import { migrateFromLocalStorage, isMigrationNeeded } from '@/lib/database/migration'

// Check if migration needed
const needsMigration = await isMigrationNeeded()

// Perform migration
const result = await migrateFromLocalStorage()
```

### Activity Operations
```typescript
import { upsertActivities, getActivities } from '@/lib/database/queries'

// Bulk insert/update activities
await upsertActivities(activities)

// Query activities with filters
const recent = await getActivities({
  limit: 50,
  startDate: '2024-01-01',
  type: ['easy', 'long']
})
```

### Fitness Metrics
```typescript
import { updateFitnessMetrics, getCurrentFitnessMetrics } from '@/lib/fitness/metrics'

// Calculate metrics for date range
await updateFitnessMetrics('2024-01-01', '2024-12-31')

// Get current fitness state
const fitness = await getCurrentFitnessMetrics()
```

### Coaching Recommendations  
```typescript
import { getWorkoutRecommendation } from '@/lib/fitness/metrics'

const recommendation = getWorkoutRecommendation(
  currentFitnessData,
  recentActivities, 
  daysSinceLastRest
)
```

### Optimized Queries
```typescript
import { 
  getDashboardStatsOptimized,
  getWeeklyMileageOptimized,
  getCoachingReadinessOptimized 
} from '@/lib/database/queries-optimized'

// Fast dashboard data
const stats = await getDashboardStatsOptimized()

// Cached weekly summaries
const weekly = await getWeeklyMileageOptimized(12)

// Real-time readiness assessment
const readiness = await getCoachingReadinessOptimized()
```

## Performance Optimizations

### Query Caching
- 5-minute TTL for fitness metrics
- 3-minute TTL for activity queries
- 1-minute TTL for distance calculations
- 30-minute TTL for type distributions

### Prepared Statements
Reused prepared statements for:
- Activity inserts/updates
- Fitness metric calculations
- Dashboard aggregations
- Recommendation queries

### Batch Operations
- Bulk activity synchronization
- Batch fitness metric calculation  
- Transaction-wrapped migrations
- Efficient weekly aggregations

### Memory Management
- Automatic prepared statement cleanup
- Query cache size monitoring
- Database export/import for backups
- Automatic localStorage fallbacks

## Usage Examples

### Basic Setup
```typescript
import { useDatabase } from '@/lib/hooks/useDatabase'

function MyComponent() {
  const { isInitialized, performMigration, migrationNeeded } = useDatabase()
  
  if (migrationNeeded) {
    return <button onClick={performMigration}>Migrate Data</button>
  }
  
  if (!isInitialized) {
    return <div>Loading database...</div>
  }
  
  return <div>Database ready!</div>
}
```

### Fitness Tracking
```typescript  
import { useFitnessMetrics } from '@/lib/hooks/useDatabase'

function FitnessTracker() {
  const { calculateMetrics, isCalculating } = useFitnessMetrics()
  
  return (
    <button 
      onClick={() => calculateMetrics(90)}
      disabled={isCalculating}
    >
      {isCalculating ? 'Calculating...' : 'Update Fitness'}
    </button>
  )
}
```

### Coach Dashboard
```typescript
import { getDashboardStatsOptimized } from '@/lib/database/queries-optimized'

function CoachDashboard() {
  const [stats, setStats] = useState(null)
  
  useEffect(() => {
    getDashboardStatsOptimized().then(setStats)
  }, [])
  
  return (
    <div>
      <h2>This Week: {stats?.thisWeekKm} km</h2>
      <p>Readiness: {stats?.readinessScore}%</p>
    </div>
  )
}
```

## Database Maintenance

### Backup/Restore
```typescript
import { exportDatabase, importDatabase } from '@/lib/database'

// Export for backup
const backup = await exportDatabase()

// Import from backup  
await importDatabase(backup)
```

### Performance Monitoring
```typescript
import { getQueryCacheStats } from '@/lib/database/queries-optimized'

const stats = getQueryCacheStats()
console.log(`Cache size: ${stats.size} queries, ${stats.totalMemoryEstimate} bytes`)
```

### Data Cleanup
```typescript  
import { clearQueryCache, cleanupOptimizedQueries } from '@/lib/database/queries-optimized'

// Clear query cache
clearQueryCache()

// Full cleanup
cleanupOptimizedQueries()
```

This database system provides the foundation for sophisticated marathon training intelligence while maintaining excellent performance in the browser environment.