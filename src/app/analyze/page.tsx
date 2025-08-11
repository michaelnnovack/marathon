"use client";
import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { HeroImage } from '@/components/SimpleFallback'
import { useActivities } from '@/store/activities'
import { useUserStore } from '@/store/user'
import { ChartBarIcon, CalendarIcon, ClockIcon, MapIcon, ExclamationTriangleIcon, FireIcon } from '@heroicons/react/24/outline'
import { formatTime, formatPace } from '@/utils/tcx-analyzer'
import { weeklyMileageKm, last7DaysMileageKm } from '@/store/activities'
import Link from 'next/link'
import type { SimpleActivity } from '@/types'

export default function AnalyzePage() {
  const activities = useActivities((s) => s.list)
  const user = useUserStore((s) => s.user)
  const hydrateActivities = useActivities((s) => s.hydrate)
  
  const [selectedActivity, setSelectedActivity] = useState<SimpleActivity | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    hydrateActivities()
  }, [hydrateActivities])

  // Filter activities based on time range and with valid data
  const filteredActivities = useMemo(() => {
    const validActivities = activities.filter(a => 
      a.date && 
      a.distance && a.distance > 0 && 
      a.duration && a.duration > 0
    )

    if (timeRange === 'all') return validActivities

    const now = new Date()
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    return validActivities.filter(a => new Date(a.date!) >= cutoff)
  }, [activities, timeRange])

  // Performance analytics
  const analytics = useMemo(() => {
    if (filteredActivities.length === 0) return null

    const totalDistance = filteredActivities.reduce((sum, a) => sum + (a.distance || 0), 0) / 1000 // km
    const totalDuration = filteredActivities.reduce((sum, a) => sum + (a.duration || 0), 0) // seconds
    const avgPace = totalDuration / 60 / totalDistance // min/km
    
    const activitiesWithHR = filteredActivities.filter(a => a.avgHr)
    const avgHR = activitiesWithHR.length > 0 
      ? activitiesWithHR.reduce((sum, a) => sum + (a.avgHr || 0), 0) / activitiesWithHR.length
      : null

    const paces = filteredActivities.map(a => (a.duration || 0) / 60 / ((a.distance || 0) / 1000))
    const fastestPace = Math.min(...paces)
    const slowestPace = Math.max(...paces)
    
    const weeklyData = weeklyMileageKm(filteredActivities)
    const recentWeekKm = last7DaysMileageKm(filteredActivities)
    
    // Consistency metrics
    const paceCV = paces.length > 1 ? 
      Math.sqrt(paces.reduce((sum, pace) => sum + Math.pow(pace - avgPace, 2), 0) / paces.length) / avgPace : 0
    
    // Progress analysis (compare first half vs second half of period)
    const midpoint = Math.floor(filteredActivities.length / 2)
    const earlierRuns = filteredActivities.slice(0, midpoint)
    const recentRuns = filteredActivities.slice(midpoint)
    
    const earlierAvgPace = earlierRuns.length > 0 
      ? earlierRuns.reduce((sum, a) => sum + ((a.duration || 0) / 60 / ((a.distance || 0) / 1000)), 0) / earlierRuns.length
      : avgPace
    const recentAvgPace = recentRuns.length > 0
      ? recentRuns.reduce((sum, a) => sum + ((a.duration || 0) / 60 / ((a.distance || 0) / 1000)), 0) / recentRuns.length
      : avgPace

    return {
      totalActivities: filteredActivities.length,
      totalDistance,
      totalDuration,
      avgPace,
      avgHR,
      fastestPace,
      slowestPace,
      paceConsistency: paceCV,
      weeklyData,
      recentWeekKm,
      paceImprovement: earlierAvgPace - recentAvgPace, // positive = improvement
      longestRun: Math.max(...filteredActivities.map(a => (a.distance || 0) / 1000)),
      avgDistance: totalDistance / filteredActivities.length
    }
  }, [filteredActivities])

  // Training insights
  const insights = useMemo(() => {
    if (!analytics || !user?.goalTime) return null

    const goalPaceMinKm = (() => {
      const [h, m, s] = user.goalTime.split(':').map(Number)
      const marathonTimeMinutes = h * 60 + m + s / 60
      return marathonTimeMinutes / 42.195 // min/km for marathon
    })()

    const paceGap = analytics.avgPace - goalPaceMinKm
    const isOnTrack = Math.abs(paceGap) < 0.5 // within 30s per km

    const insights = {
      goalPaceComparison: {
        gap: paceGap,
        isOnTrack,
        message: isOnTrack 
          ? "You're on track for your marathon goal!"
          : paceGap > 0 
          ? `Need to improve pace by ${formatPace(Math.abs(paceGap))} per km`
          : `Running faster than goal pace by ${formatPace(Math.abs(paceGap))} per km`
      },
      volumeAssessment: {
        weeklyKm: analytics.recentWeekKm,
        isAdequate: analytics.recentWeekKm >= 40, // Basic marathon training volume
        message: analytics.recentWeekKm >= 60 
          ? "Excellent training volume"
          : analytics.recentWeekKm >= 40
          ? "Good training volume"
          : "Consider increasing weekly mileage"
      },
      consistencyAssessment: {
        cv: analytics.paceConsistency,
        isConsistent: analytics.paceConsistency < 0.15,
        message: analytics.paceConsistency < 0.1
          ? "Very consistent pacing"
          : analytics.paceConsistency < 0.15
          ? "Reasonably consistent pacing"
          : "Work on pace consistency"
      },
      progressTrend: {
        improvement: analytics.paceImprovement,
        isImproving: analytics.paceImprovement > 0,
        message: analytics.paceImprovement > 0.2
          ? `Great progress! ${Math.abs(analytics.paceImprovement * 60).toFixed(0)}s/km faster recently`
          : analytics.paceImprovement > 0
          ? "Slight improvement trend"
          : analytics.paceImprovement < -0.2
          ? "Pace has slowed recently - check for overtraining"
          : "Pace holding steady"
      }
    }

    return insights
  }, [analytics, user?.goalTime])

  if (activities.length === 0) {
    return (
      <div className="space-y-8">
        <HeroImage 
          query="running data analysis performance dashboard empty" 
          className="h-48 rounded-2xl"
        >
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Performance Analysis</h1>
          <p className="text-lg opacity-90">Analyze your training data and track progress toward your goals</p>
        </HeroImage>

        <Card>
          <CardContent className="text-center py-12">
            <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Training Data Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Upload your GPS watch files to start analyzing your training performance
            </p>
            <Link href="/setup">
              <Button>Go to Setup & Upload Data</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <HeroImage 
        query="running analytics performance data insights dashboard" 
        className="h-48 rounded-2xl"
      >
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Performance Analysis</h1>
        <p className="text-lg opacity-90">
          {analytics?.totalActivities} activities • {analytics?.totalDistance.toFixed(0)} km total
        </p>
      </HeroImage>

      {/* Time Range Selector */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Analysis Period</h2>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range === '7d' ? 'Last 7 days' : 
                   range === '30d' ? 'Last 30 days' :
                   range === '90d' ? 'Last 90 days' : 'All time'}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="text-center">
              <ClockIcon className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">{formatPace(analytics.avgPace)}</div>
              <div className="text-sm text-gray-600">Average Pace</div>
              <div className="text-xs text-gray-500 mt-1">
                Fastest: {formatPace(analytics.fastestPace)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-center">
              <MapIcon className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">{analytics.totalDistance.toFixed(0)} km</div>
              <div className="text-sm text-gray-600">Total Distance</div>
              <div className="text-xs text-gray-500 mt-1">
                Avg: {analytics.avgDistance.toFixed(1)}km per run
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-center">
              <CalendarIcon className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">{analytics.recentWeekKm.toFixed(0)} km</div>
              <div className="text-sm text-gray-600">This Week</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.totalActivities} total runs
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-center">
              <FireIcon className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-600">{analytics.longestRun.toFixed(1)} km</div>
              <div className="text-sm text-gray-600">Longest Run</div>
              <div className="text-xs text-gray-500 mt-1">
                {analytics.avgHR ? `${Math.round(analytics.avgHR)} bpm avg` : 'No HR data'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Training Insights */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Marathon Goal Progress</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Goal Pace Comparison</span>
                <Badge variant={insights.goalPaceComparison.isOnTrack ? 'success' : 'warning'}>
                  {insights.goalPaceComparison.isOnTrack ? 'On Track' : 'Needs Work'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{insights.goalPaceComparison.message}</p>
              
              <div className="flex items-center justify-between">
                <span>Training Volume</span>
                <Badge variant={insights.volumeAssessment.isAdequate ? 'success' : 'warning'}>
                  {insights.volumeAssessment.weeklyKm.toFixed(0)} km/week
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{insights.volumeAssessment.message}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Performance Trends</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Pace Consistency</span>
                <Badge variant={insights.consistencyAssessment.isConsistent ? 'success' : 'warning'}>
                  {insights.consistencyAssessment.isConsistent ? 'Consistent' : 'Variable'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{insights.consistencyAssessment.message}</p>
              
              <div className="flex items-center justify-between">
                <span>Recent Progress</span>
                <Badge variant={insights.progressTrend.isImproving ? 'success' : insights.progressTrend.improvement < -0.1 ? 'error' : 'default'}>
                  {insights.progressTrend.isImproving ? 'Improving' : 
                   insights.progressTrend.improvement < -0.1 ? 'Declining' : 'Stable'}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{insights.progressTrend.message}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activities */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Recent Activities</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Distance</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Pace</th>
                  <th className="text-left p-2">Avg HR</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.slice(0, 10).map((activity, index) => {
                  const pace = (activity.duration || 0) / 60 / ((activity.distance || 0) / 1000)
                  return (
                    <tr key={activity.id || index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-2">
                        {activity.date ? new Date(activity.date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-2">{((activity.distance || 0) / 1000).toFixed(2)} km</td>
                      <td className="p-2">{formatTime(activity.duration || 0)}</td>
                      <td className="p-2">
                        <span className={
                          analytics && pace < analytics.avgPace * 0.95 ? 'text-green-600 font-medium' :
                          analytics && pace > analytics.avgPace * 1.05 ? 'text-red-600 font-medium' : 
                          'text-gray-700 dark:text-gray-300'
                        }>
                          {formatPace(pace)}
                        </span>
                      </td>
                      <td className="p-2">{activity.avgHr ? `${Math.round(activity.avgHr)} bpm` : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {filteredActivities.length > 10 && (
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Showing 10 of {filteredActivities.length} activities
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="text-center py-8">
            <ChartBarIcon className="w-8 h-8 text-blue-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Need More Detail?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Upload TCX files with GPS data for comprehensive pace, heart rate, and elevation analysis
            </p>
            <Link href="/setup">
              <Button variant="outline" size="sm">Upload More Data</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center py-8">
            <CalendarIcon className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Ready to Plan?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Get a personalized training plan based on your current fitness and race goals
            </p>
            <Link href="/plan">
              <Button size="sm">View Training Plan</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}