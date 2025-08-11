"use client";
import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'
import { Card, CardContent, CardHeader } from './ui/Card'
import { Badge } from './ui/Badge'
import { ClockIcon, HeartIcon, MapIcon, TrophyIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import type { TCXAnalysis, KilometerSplit, HeartRateZoneTime } from '@/utils/tcx-analyzer'
import { formatPace, formatTime } from '@/utils/tcx-analyzer'

interface TCXAnalysisReportProps {
  analysis: TCXAnalysis
  targetMarathonPace?: number
}

export default function TCXAnalysisReport({ analysis, targetMarathonPace }: TCXAnalysisReportProps) {
  
  // Prepare chart data
  const splitsChartData = useMemo(() => {
    return analysis.kilometerSplits.map((split, index) => ({
      km: split.km,
      pace: split.pace,
      paceSeconds: split.pace * 60,
      heartRate: split.avgHR || 0,
      elevation: (analysis.trackPoints.find(p => p.distanceFromStart >= split.km * 1000)?.altitude || 0)
    }))
  }, [analysis])
  
  const elevationChartData = useMemo(() => {
    const samplePoints = analysis.trackPoints.filter((_, index) => index % 10 === 0) // Sample every 10th point
    return samplePoints.map(point => ({
      distance: point.distanceFromStart / 1000,
      elevation: point.altitude || 0,
      heartRate: point.heartRate || 0
    }))
  }, [analysis])
  
  const hrZoneChartData = useMemo(() => {
    return analysis.heartRateZones.map(zone => ({
      zone: `Z${zone.zone}`,
      name: zone.name,
      time: zone.timeSeconds / 60, // minutes
      percentage: zone.percentage
    }))
  }, [analysis])

  // Calculate some derived metrics
  const paceRange = useMemo(() => {
    const paces = analysis.kilometerSplits.map(s => s.pace)
    return {
      fastest: Math.min(...paces),
      slowest: Math.max(...paces)
    }
  }, [analysis])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="font-semibold">Km {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey === 'paceSeconds' ? 
                `Pace: ${formatPace(entry.value / 60)}` :
                entry.dataKey === 'heartRate' ?
                `HR: ${Math.round(entry.value)} bpm` :
                `${entry.name}: ${Math.round(entry.value)}`
              }
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card>
        <CardHeader icon={<TrophyIcon className="w-5 h-5" />} className="pb-4">
          <h2 className="text-xl font-bold">Running Performance Analysis</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{analysis.totalDistance.toFixed(2)} km</div>
              <div className="text-sm text-gray-600">Distance</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{formatTime(analysis.totalDuration)}</div>
              <div className="text-sm text-gray-600">Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatPace(analysis.avgPace)}</div>
              <div className="text-sm text-gray-600">Avg Pace</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {analysis.avgHR ? Math.round(analysis.avgHR) : 'N/A'} bpm
              </div>
              <div className="text-sm text-gray-600">Avg HR</div>
            </div>
          </div>
          
          {/* Marathon Pace Comparison */}
          {analysis.marathonInsights.paceComparison && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-800 dark:text-blue-200">
                  Marathon Pace Analysis
                </span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {analysis.marathonInsights.paceComparison}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kilometer Splits Table */}
      <Card>
        <CardHeader icon={<ChartBarIcon className="w-5 h-5" />}>
          <h3 className="text-lg font-semibold">Kilometer Splits</h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left p-2">Km</th>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Pace</th>
                  <th className="text-left p-2">Avg HR</th>
                  <th className="text-left p-2">Elevation</th>
                  <th className="text-left p-2">Grade</th>
                </tr>
              </thead>
              <tbody>
                {analysis.kilometerSplits.map((split) => (
                  <tr key={split.km} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2 font-medium">{split.km}</td>
                    <td className="p-2">{formatTime(split.time)}</td>
                    <td className="p-2">
                      <span className={
                        split.pace < analysis.avgPace * 0.98 ? 'text-green-600 font-medium' :
                        split.pace > analysis.avgPace * 1.02 ? 'text-red-600 font-medium' : 
                        'text-gray-700 dark:text-gray-300'
                      }>
                        {formatPace(split.pace)}
                      </span>
                    </td>
                    <td className="p-2">{split.avgHR ? Math.round(split.avgHR) : '-'}</td>
                    <td className="p-2">
                      {split.elevationGain > 2 && <span className="text-red-600">↗{split.elevationGain.toFixed(0)}m</span>}
                      {split.elevationLoss > 2 && <span className="text-green-600">↘{split.elevationLoss.toFixed(0)}m</span>}
                      {split.elevationGain <= 2 && split.elevationLoss <= 2 && <span className="text-gray-400">~</span>}
                    </td>
                    <td className="p-2">
                      {Math.abs(split.avgGrade) > 0.5 ? (
                        <span className={split.avgGrade > 0 ? 'text-red-600' : 'text-green-600'}>
                          {split.avgGrade > 0 ? '+' : ''}{split.avgGrade.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">0.0%</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Split Statistics */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Fastest Split:</span>
              <div className="font-semibold text-green-600">{formatPace(paceRange.fastest)}</div>
            </div>
            <div>
              <span className="text-gray-600">Slowest Split:</span>
              <div className="font-semibold text-red-600">{formatPace(paceRange.slowest)}</div>
            </div>
            <div>
              <span className="text-gray-600">Pace Variance:</span>
              <div className="font-semibold">
                {((paceRange.slowest - paceRange.fastest) * 60).toFixed(0)}s
              </div>
            </div>
            <div>
              <span className="text-gray-600">Split Type:</span>
              <div className="font-semibold">
                <Badge variant={analysis.negativeSplit ? 'success' : 'warning'}>
                  {analysis.negativeSplit ? 'Negative' : 'Positive'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pace vs Heart Rate Chart */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Pace vs Heart Rate Analysis</h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={splitsChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="km" 
                label={{ value: 'Kilometer', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                yAxisId="left"
                label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => formatPace(value)}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                label={{ value: 'Heart Rate (bpm)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="pace" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Pace"
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="heartRate" 
                stroke="#82ca9d" 
                strokeWidth={2}
                name="Heart Rate"
              />
              {targetMarathonPace && (
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey={() => targetMarathonPace} 
                  stroke="#ff7300" 
                  strokeDasharray="5 5"
                  name="Target Marathon Pace"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Heart Rate Zones */}
      {analysis.heartRateZones.length > 0 && (
        <Card>
          <CardHeader icon={<HeartIcon className="w-5 h-5" />}>
            <h3 className="text-lg font-semibold">Heart Rate Zones</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hrZoneChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="zone" />
                    <YAxis label={{ value: 'Time (min)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value, name) => [
                        `${Math.round(Number(value))} min`, 
                        'Time'
                      ]}
                    />
                    <Bar dataKey="time" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-3">
                {analysis.heartRateZones.map((zone) => (
                  <div key={zone.zone} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="font-medium">Zone {zone.zone}: {zone.name}</div>
                      <div className="text-sm text-gray-600">{zone.minHR}-{zone.maxHR} bpm</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatTime(zone.timeSeconds)}</div>
                      <div className="text-sm text-gray-600">{zone.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Elevation Profile */}
      {analysis.totalElevationGain > 10 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Elevation Profile</h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={elevationChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="distance" 
                  label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5 }}
                  tickFormatter={(value) => `${value.toFixed(1)}km`}
                />
                <YAxis 
                  label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'elevation' ? `${Math.round(Number(value))}m` : value,
                    name === 'elevation' ? 'Elevation' : name
                  ]}
                  labelFormatter={(value) => `${Number(value).toFixed(1)}km`}
                />
                <Area 
                  type="monotone" 
                  dataKey="elevation" 
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Climb:</span>
                <div className="font-semibold text-red-600">
                  {analysis.totalElevationGain.toFixed(0)}m
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Descent:</span>
                <div className="font-semibold text-green-600">
                  {analysis.totalElevationLoss.toFixed(0)}m
                </div>
              </div>
              <div>
                <span className="text-gray-600">Grade Adj. Pace:</span>
                <div className="font-semibold">
                  {formatPace(analysis.gradeAdjustedPace)}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Est. TSS:</span>
                <div className="font-semibold">
                  {analysis.estimatedTSS}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pace Drift Analysis */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Pace Drift & Endurance Analysis</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium">First Half vs Second Half</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>First Half Pace:</span>
                  <span className="font-semibold">{formatPace(analysis.paceDrift.firstHalfAvgPace)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Second Half Pace:</span>
                  <span className="font-semibold">{formatPace(analysis.paceDrift.secondHalfAvgPace)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>Pace Change:</span>
                  <span className={`font-semibold ${
                    analysis.paceDrift.paceDecline > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {analysis.paceDrift.paceDecline > 0 ? '+' : ''}{analysis.paceDrift.paceDecline.toFixed(0)}s/km
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium">Heart Rate Drift</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>First Half HR:</span>
                  <span className="font-semibold">{analysis.paceDrift.firstHalfAvgHR.toFixed(0)} bpm</span>
                </div>
                <div className="flex justify-between">
                  <span>Second Half HR:</span>
                  <span className="font-semibold">{analysis.paceDrift.secondHalfAvgHR.toFixed(0)} bpm</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span>HR Drift:</span>
                  <span className={`font-semibold ${
                    analysis.paceDrift.hrDrift > 5 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    +{analysis.paceDrift.hrDrift.toFixed(0)} bpm
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Marathon Coaching Insights */}
      <Card>
        <CardHeader icon={<TrophyIcon className="w-5 h-5" />}>
          <h3 className="text-lg font-semibold">Marathon Coaching Analysis</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-green-700 dark:text-green-400">Endurance Assessment</h4>
              <p className="text-gray-700 dark:text-gray-300">{analysis.marathonInsights.enduranceAssessment}</p>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-700 dark:text-blue-400">Pacing Control</h4>
              <p className="text-gray-700 dark:text-gray-300">{analysis.marathonInsights.pacingControl}</p>
            </div>
            
            {analysis.marathonInsights.fatigueIndicators.length > 0 && (
              <div>
                <h4 className="font-medium text-red-700 dark:text-red-400">Fatigue Indicators</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                  {analysis.marathonInsights.fatigueIndicators.map((indicator, index) => (
                    <li key={index}>{indicator}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {analysis.marathonInsights.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium text-purple-700 dark:text-purple-400">Training Recommendations</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                  {analysis.marathonInsights.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Summary */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Performance Metrics</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {(analysis.paceConsistency * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Pace Consistency</div>
              <div className="text-xs text-gray-600">
                {analysis.paceConsistency < 0.05 ? 'Excellent' : 
                 analysis.paceConsistency < 0.1 ? 'Good' : 'Needs Work'}
              </div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {analysis.estimatedTSS}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Training Stress</div>
              <div className="text-xs text-gray-600">
                {analysis.estimatedTSS < 150 ? 'Low' : 
                 analysis.estimatedTSS < 300 ? 'Moderate' : 'High'}
              </div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {analysis.maxHR || 'N/A'}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">Max Heart Rate</div>
              <div className="text-xs text-gray-600">BPM</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {formatPace(analysis.gradeAdjustedPace)}
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-300">Grade Adj. Pace</div>
              <div className="text-xs text-gray-600">Min/KM</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}