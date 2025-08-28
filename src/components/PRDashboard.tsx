'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useUserStore } from '@/store/user'
import { formatPRTime, formatPace, formatDistance, getPRIcon, getPRDisplayName } from '@/utils/prTracking'
import type { PRHistory, PRData, PRAnalysis } from '@/types'

interface PRDashboardProps {
  className?: string
}

export function PRDashboard({ className = '' }: PRDashboardProps) {
  const { prHistories, prAnalysis, isLoading } = useUserStore()

  if (isLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (!prHistories || prHistories.length === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Personal Records</h3>
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🏃</div>
          <p className="text-gray-600">
            No personal records detected yet. Keep training and your PRs will automatically be tracked!
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <PROverview prHistories={prHistories} />
      <RecentPRs prAnalysis={prAnalysis} />
      <PRProgress prHistories={prHistories} />
      {prAnalysis && <InjuryRiskAlert prAnalysis={prAnalysis} />}
    </div>
  )
}

function PROverview({ prHistories }: { prHistories: PRHistory[] }) {
  const currentPRs = prHistories
    .filter(history => history.currentPR)
    .sort((a, b) => {
      // Sort by importance: Marathon, Half, 10K, 5K, 1K, Longest, Volume, Elevation
      const order = ['fastest_marathon', 'fastest_half_marathon', 'fastest_10k', 'fastest_5k', 'fastest_1k', 'longest_run', 'most_weekly_volume', 'most_elevation_gain']
      return order.indexOf(a.type) - order.indexOf(b.type)
    })

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Current Personal Records</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentPRs.map((history) => (
          <PRCard key={history.type} history={history} />
        ))}
      </div>
    </Card>
  )
}

function PRCard({ history }: { history: PRHistory }) {
  if (!history.currentPR) return null

  const pr = history.currentPR
  const isTimeBasedPR = ['fastest_1k', 'fastest_5k', 'fastest_10k', 'fastest_half_marathon', 'fastest_marathon'].includes(pr.type)
  const isDistanceBasedPR = ['longest_run', 'most_weekly_volume'].includes(pr.type)
  const isElevationPR = pr.type === 'most_elevation_gain'

  const formatValue = () => {
    if (isTimeBasedPR) {
      return formatPRTime(pr.value)
    } else if (isDistanceBasedPR) {
      return formatDistance(pr.value)
    } else if (isElevationPR) {
      return `${Math.round(pr.value)}m`
    }
    return pr.value.toString()
  }

  const formatPaceIfAvailable = () => {
    if (isTimeBasedPR && pr.pace) {
      return formatPace(pr.pace)
    }
    return null
  }

  const getTrendColor = () => {
    switch (history.improvementTrend) {
      case 'improving': return 'text-green-600 bg-green-50'
      case 'declining': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{getPRIcon(pr.type)}</span>
        <h4 className="font-medium text-sm">{getPRDisplayName(pr.type)}</h4>
      </div>
      
      <div className="space-y-1">
        <div className="text-xl font-bold">{formatValue()}</div>
        {formatPaceIfAvailable() && (
          <div className="text-sm text-gray-600">{formatPaceIfAvailable()}</div>
        )}
        <div className="text-xs text-gray-500">
          {new Date(pr.date).toLocaleDateString()}
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <Badge className={`text-xs ${getTrendColor()}`}>
            {history.improvementTrend}
          </Badge>
          {pr.improvement && pr.improvementPercent && (
            <Badge className="text-xs bg-blue-50 text-blue-600">
              {isTimeBasedPR ? '-' : '+'}{Math.abs(pr.improvementPercent!).toFixed(1)}%
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentPRs({ prAnalysis }: { prAnalysis?: PRAnalysis }) {
  if (!prAnalysis || prAnalysis.recentPRs.length === 0) return null

  const recentPRs = prAnalysis.recentPRs
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5) // Show last 5 PRs

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">
        Recent Achievements
        <span className="text-sm font-normal text-gray-600 ml-2">
          (Last 90 days)
        </span>
      </h3>
      
      <div className="space-y-3">
        {recentPRs.map((pr) => (
          <RecentPRItem key={pr.id} pr={pr} />
        ))}
      </div>
    </Card>
  )
}

function RecentPRItem({ pr }: { pr: PRData }) {
  const isTimeBasedPR = ['fastest_1k', 'fastest_5k', 'fastest_10k', 'fastest_half_marathon', 'fastest_marathon'].includes(pr.type)
  const daysAgo = Math.floor((Date.now() - new Date(pr.date).getTime()) / (24 * 60 * 60 * 1000))

  return (
    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-lg">{getPRIcon(pr.type)}</span>
        <div>
          <div className="font-medium text-sm">{getPRDisplayName(pr.type)}</div>
          <div className="text-xs text-gray-600">
            {daysAgo === 0 ? 'Today' : `${daysAgo} days ago`}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="font-bold">
          {isTimeBasedPR ? formatPRTime(pr.value) : formatDistance(pr.value)}
        </div>
        {pr.improvementPercent && (
          <div className="text-xs text-green-600">
            {isTimeBasedPR ? '-' : '+'}{Math.abs(pr.improvementPercent).toFixed(1)}% improvement
          </div>
        )}
      </div>
    </div>
  )
}

function PRProgress({ prHistories }: { prHistories: PRHistory[] }) {
  const improvingPRs = prHistories.filter(h => h.improvementTrend === 'improving')
  const stablePRs = prHistories.filter(h => h.improvementTrend === 'stable')
  const decliningPRs = prHistories.filter(h => h.improvementTrend === 'declining')

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Progress Summary</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl text-green-600 font-bold">{improvingPRs.length}</div>
          <div className="text-sm text-gray-600">Improving</div>
          <div className="text-xs text-gray-500 mt-1">
            Recent improvements detected
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl text-gray-600 font-bold">{stablePRs.length}</div>
          <div className="text-sm text-gray-600">Stable</div>
          <div className="text-xs text-gray-500 mt-1">
            Maintaining current performance
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl text-orange-600 font-bold">{decliningPRs.length}</div>
          <div className="text-sm text-gray-600">Declining</div>
          <div className="text-xs text-gray-500 mt-1">
            May need attention
          </div>
        </div>
      </div>
      
      {improvingPRs.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <div className="text-sm font-medium text-green-800 mb-1">🎉 Recent Improvements</div>
          <div className="text-xs text-green-700">
            {improvingPRs.map(pr => getPRDisplayName(pr.type)).join(', ')}
          </div>
        </div>
      )}
    </Card>
  )
}

function InjuryRiskAlert({ prAnalysis }: { prAnalysis: PRAnalysis }) {
  const riskScore = prAnalysis.injuryRiskFactors.riskScore
  const warnings = prAnalysis.injuryRiskFactors.warnings

  if (riskScore < 40) return null

  const getRiskLevel = () => {
    if (riskScore >= 70) return { level: 'High', color: 'bg-red-100 border-red-300 text-red-800' }
    if (riskScore >= 50) return { level: 'Moderate', color: 'bg-yellow-100 border-yellow-300 text-yellow-800' }
    return { level: 'Low', color: 'bg-green-100 border-green-300 text-green-800' }
  }

  const risk = getRiskLevel()

  return (
    <Card className={`p-6 border-2 ${risk.color}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚠️</span>
        <h3 className="text-lg font-semibold">
          PR-Based Injury Risk Alert - {risk.level} Risk
        </h3>
      </div>
      
      <div className="space-y-2">
        <div className="text-sm">
          <strong>Risk Score:</strong> {riskScore}/100
        </div>
        
        {warnings.length > 0 && (
          <div>
            <div className="font-medium text-sm mb-2">Recommendations:</div>
            <ul className="space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-orange-500">•</span>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-white/50 rounded-lg">
          <div className="text-xs text-gray-600">
            This assessment is based on the frequency and magnitude of your recent personal records. 
            Rapid improvements can sometimes indicate overreaching. Monitor your recovery and adjust training intensity accordingly.
          </div>
        </div>
      </div>
    </Card>
  )
}

export default PRDashboard