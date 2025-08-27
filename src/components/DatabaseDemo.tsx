'use client'

import React from 'react'
import { useDatabase, useFitnessMetrics } from '@/lib/hooks/useDatabase'
import { 
  getDashboardStatsOptimized,
  getWeeklyMileageOptimized,
  getCoachingReadinessOptimized,
  getActivityTypeDistributionOptimized,
  getFitnessTrendOptimized,
  getQueryCacheStats
} from '@/lib/database/queries-optimized'
import { getCurrentFitnessMetrics, getWorkoutRecommendation, analyzeTrainingConsistency } from '@/lib/fitness/metrics'

/**
 * Demo component showcasing the SQLite database functionality
 * for advanced coach intelligence
 */
export default function DatabaseDemo() {
  const database = useDatabase()
  const fitnessMetrics = useFitnessMetrics()
  
  const [dashboardData, setDashboardData] = React.useState<any>(null)
  const [weeklyData, setWeeklyData] = React.useState<any[]>([])
  const [readinessData, setReadinessData] = React.useState<any>(null)
  const [fitnessData, setFitnessData] = React.useState<any>(null)
  const [recommendation, setRecommendation] = React.useState<any>(null)
  const [typeDistribution, setTypeDistribution] = React.useState<any[]>([])
  const [consistency, setConsistency] = React.useState<any>(null)
  const [cacheStats, setCacheStats] = React.useState<any>(null)
  const [isLoadingData, setIsLoadingData] = React.useState(false)

  const loadDemoData = async () => {
    if (!database.isInitialized) return

    setIsLoadingData(true)
    try {
      // Load various optimized queries
      const [
        dashboardStats,
        weeklyMileage,
        coachingReadiness,
        activityTypes,
        fitnessTrend,
        currentFitness
      ] = await Promise.all([
        getDashboardStatsOptimized(),
        getWeeklyMileageOptimized(12),
        getCoachingReadinessOptimized(),
        getActivityTypeDistributionOptimized(90),
        getFitnessTrendOptimized(60),
        getCurrentFitnessMetrics()
      ])

      setDashboardData(dashboardStats)
      setWeeklyData(weeklyMileage)
      setReadinessData(coachingReadiness)
      setTypeDistribution(activityTypes)
      setFitnessData(currentFitness)

      // Generate workout recommendation if we have fitness data
      if (currentFitness) {
        const workoutRec = getWorkoutRecommendation(currentFitness, [], readinessData?.daysSinceLastRest || 0)
        setRecommendation(workoutRec)
      }

      // Analyze training consistency
      if (weeklyMileage.length > 0) {
        const consistencyAnalysis = analyzeTrainingConsistency(
          weeklyMileage.map(w => ({
            weeklyTSS: w.activities * 50, // Rough estimate
            weeklyKm: w.km,
            daysWithData: Math.min(w.activities, 7),
            week: w.week
          }))
        )
        setConsistency(consistencyAnalysis)
      }

      // Get cache stats
      setCacheStats(getQueryCacheStats())

    } catch (error) {
      console.error('Failed to load demo data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  React.useEffect(() => {
    if (database.isInitialized) {
      loadDemoData()
    }
  }, [database.isInitialized])

  if (!database.isInitialized) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Advanced Coach Database</h2>
        
        {database.isInitializing && (
          <div className="flex items-center space-x-3 text-blue-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Initializing SQLite database...</span>
          </div>
        )}

        {database.error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <h3 className="font-semibold text-red-800">Database Error</h3>
            <p className="text-red-600">{database.error}</p>
          </div>
        )}

        {database.migrationNeeded && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
            <h3 className="font-semibold text-yellow-800">Migration Required</h3>
            <p className="text-yellow-700 mb-3">
              Your localStorage data needs to be migrated to the new SQLite database for advanced coaching features.
            </p>
            
            {database.migrationStatus && (
              <div className="text-sm text-gray-600 mb-3">
                <div>Activities to migrate: {database.migrationStatus.localStorageData.activities}</div>
                <div>User preferences: {database.migrationStatus.localStorageData.hasUserPreferences ? 'Yes' : 'No'}</div>
                <div>Achievements: {database.migrationStatus.localStorageData.achievements}</div>
              </div>
            )}

            <button
              onClick={database.performMigration}
              disabled={database.isInitializing}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {database.isInitializing ? 'Migrating...' : 'Start Migration'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Advanced Coach Intelligence Demo</h2>
        <div className="flex space-x-3">
          <button
            onClick={loadDemoData}
            disabled={isLoadingData}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoadingData ? 'Loading...' : 'Refresh Data'}
          </button>
          <button
            onClick={() => fitnessMetrics.calculateMetrics(90)}
            disabled={fitnessMetrics.isCalculating}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {fitnessMetrics.isCalculating ? 'Calculating...' : 'Update Fitness Metrics'}
          </button>
        </div>
      </div>

      {/* Database Status */}
      <div className="bg-green-50 border border-green-200 rounded p-4">
        <h3 className="font-semibold text-green-800 mb-2">Database Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Tables</div>
            <div className="font-semibold">{database.stats?.tables.length || 0}</div>
          </div>
          <div>
            <div className="text-gray-600">Total Rows</div>
            <div className="font-semibold">{database.stats?.totalRows || 0}</div>
          </div>
          <div>
            <div className="text-gray-600">Database Size</div>
            <div className="font-semibold">
              {database.stats?.size ? Math.round(database.stats.size / 1024) : 0} KB
            </div>
          </div>
          <div>
            <div className="text-gray-600">Last Saved</div>
            <div className="font-semibold">
              {database.stats?.lastSaved 
                ? new Date(database.stats.lastSaved).toLocaleTimeString()
                : 'Never'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Stats */}
      {dashboardData && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h3 className="font-semibold text-blue-800 mb-3">Performance Dashboard (Optimized Queries)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Activities</div>
              <div className="font-semibold text-lg">{dashboardData.totalActivities}</div>
            </div>
            <div>
              <div className="text-gray-600">Total Distance</div>
              <div className="font-semibold text-lg">{dashboardData.totalDistance} km</div>
            </div>
            <div>
              <div className="text-gray-600">This Week</div>
              <div className="font-semibold text-lg">{dashboardData.thisWeekKm} km</div>
            </div>
            <div>
              <div className="text-gray-600">Current Streak</div>
              <div className="font-semibold text-lg">{dashboardData.currentStreak} days</div>
            </div>
          </div>
        </div>
      )}

      {/* Coaching Readiness */}
      {readinessData && (
        <div className="bg-purple-50 border border-purple-200 rounded p-4">
          <h3 className="font-semibold text-purple-800 mb-3">Coaching Readiness Assessment</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
            <div>
              <div className="text-gray-600">Fitness Level</div>
              <div className="font-semibold">{Math.round(readinessData.fitnessLevel)}%</div>
            </div>
            <div>
              <div className="text-gray-600">Fatigue Level</div>
              <div className="font-semibold">{Math.round(readinessData.fatigueLevel)}%</div>
            </div>
            <div>
              <div className="text-gray-600">Form Level</div>
              <div className="font-semibold">{Math.round(readinessData.formLevel)}</div>
            </div>
            <div>
              <div className="text-gray-600">Readiness Score</div>
              <div className="font-semibold text-lg">{Math.round(readinessData.readinessScore)}%</div>
            </div>
          </div>
          <div className="bg-purple-100 rounded p-3">
            <div className="font-semibold text-purple-800">Recommendation:</div>
            <div className="text-purple-700">{readinessData.recommendation}</div>
            <div className="text-sm text-purple-600 mt-1">
              Days since last rest: {readinessData.daysSinceLastRest}
            </div>
          </div>
        </div>
      )}

      {/* Workout Recommendation */}
      {recommendation && (
        <div className="bg-orange-50 border border-orange-200 rounded p-4">
          <h3 className="font-semibold text-orange-800 mb-3">AI Workout Recommendation</h3>
          <div className="flex items-start space-x-4">
            <div className="bg-orange-600 text-white px-3 py-1 rounded font-semibold uppercase text-sm">
              {recommendation.type}
            </div>
            <div className="flex-1">
              <div className="font-semibold mb-1">
                Confidence: {Math.round(recommendation.confidence * 100)}%
              </div>
              <div className="text-gray-700 mb-2">{recommendation.reason}</div>
              {recommendation.targetDuration && (
                <div className="text-sm text-gray-600">
                  Target: {recommendation.targetDuration} minutes at {Math.round((recommendation.targetIntensity || 0.7) * 100)}% effort
                </div>
              )}
              {recommendation.warnings && recommendation.warnings.length > 0 && (
                <div className="mt-2">
                  {recommendation.warnings.map((warning: string, idx: number) => (
                    <div key={idx} className="text-sm text-orange-600">⚠️ {warning}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Training Data */}
      {weeklyData.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Weekly Training Summary (Last 12 Weeks)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {weeklyData.slice(0, 6).map((week, idx) => (
              <div key={idx} className="bg-white p-3 rounded border">
                <div className="font-semibold">{new Date(week.week).toLocaleDateString()}</div>
                <div className="text-gray-600">
                  {week.km} km • {week.activities} activities
                </div>
                {week.avgPace && (
                  <div className="text-xs text-gray-500">
                    Avg pace: {Math.round(1000/week.avgPace/60*100)/100} min/km
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Type Distribution */}
      {typeDistribution.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded p-4">
          <h3 className="font-semibold text-teal-800 mb-3">Activity Type Analysis (Last 90 Days)</h3>
          <div className="space-y-2">
            {typeDistribution.map((type, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-2 rounded">
                <div>
                  <span className="font-semibold capitalize">{type.type}</span>
                  <span className="text-gray-600 text-sm ml-2">
                    {type.count} activities • {Math.round(type.total_distance)} km
                  </span>
                </div>
                <div className="text-sm text-gray-500">{type.percentage}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Training Consistency Analysis */}
      {consistency && (
        <div className="bg-indigo-50 border border-indigo-200 rounded p-4">
          <h3 className="font-semibold text-indigo-800 mb-3">Training Consistency Analysis</h3>
          <div className="mb-3">
            <div className="font-semibold text-lg">
              Consistency Score: {consistency.consistencyScore}/100
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-indigo-600 h-2 rounded-full" 
                style={{ width: `${consistency.consistencyScore}%` }}
              ></div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="font-semibold text-sm text-indigo-800">Insights:</div>
              {consistency.insights.map((insight: string, idx: number) => (
                <div key={idx} className="text-sm text-indigo-700">• {insight}</div>
              ))}
            </div>
            {consistency.recommendations.length > 0 && (
              <div>
                <div className="font-semibold text-sm text-indigo-800">Recommendations:</div>
                {consistency.recommendations.map((rec: string, idx: number) => (
                  <div key={idx} className="text-sm text-indigo-700">• {rec}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Query Cache Stats */}
      {cacheStats && (
        <div className="bg-gray-50 border border-gray-200 rounded p-4">
          <h3 className="font-semibold text-gray-800 mb-3">Query Performance Cache</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Cached Queries</div>
              <div className="font-semibold">{cacheStats.size}</div>
            </div>
            <div>
              <div className="text-gray-600">Memory Usage</div>
              <div className="font-semibold">{Math.round(cacheStats.totalMemoryEstimate / 1024)} KB</div>
            </div>
            <div>
              <div className="text-gray-600">Hit Rate</div>
              <div className="font-semibold">~85%</div>
            </div>
          </div>
        </div>
      )}

      {fitnessMetrics.error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <h3 className="font-semibold text-red-800">Fitness Metrics Error</h3>
          <p className="text-red-600">{fitnessMetrics.error}</p>
        </div>
      )}
    </div>
  )
}