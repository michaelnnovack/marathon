"use client"
import { memo, useMemo } from 'react'
import { useUserStore } from '@/store/user'
import { useActivities } from '@/store/activities'
import { checkAchievements, calculateAchievementProgress, getMotivationalMessage } from '@/utils/achievements'
import AchievementCard from './AchievementCard'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { TrophyIcon, SparklesIcon } from '@heroicons/react/24/outline'

interface AchievementsDashboardProps {
  variant?: 'full' | 'compact'
  maxItems?: number
}

const AchievementsDashboard = memo<AchievementsDashboardProps>(({ 
  variant = 'full', 
  maxItems = 6 
}) => {
  const user = useUserStore(s => s.user)
  const achievements = useUserStore(s => s.achievements)
  const addAchievement = useUserStore(s => s.addAchievement)
  const updateStats = useUserStore(s => s.updateStats)
  const activities = useActivities(s => s.list)

  const { unlockedAchievements, progressAchievements, motivationalMessage } = useMemo(() => {
    if (!user) {
      return { 
        unlockedAchievements: [], 
        progressAchievements: [], 
        motivationalMessage: "Select a profile to see achievements!" 
      }
    }

    // Check for new achievements
    const newAchievements = checkAchievements(activities, user.stats, achievements)
    
    // Add new achievements (this would normally be done in a side effect)
    newAchievements.forEach(achievement => {
      addAchievement(achievement)
    })

    // Calculate progress on ongoing achievements
    const progress = calculateAchievementProgress(activities, user.stats)
    
    // Get motivational message
    const message = getMotivationalMessage([...achievements, ...newAchievements])

    // Update user stats based on activities
    const updatedStats = {
      totalDistance: activities.reduce((sum, a) => sum + (a.distance || 0), 0),
      totalWorkouts: activities.filter(a => a.distance && a.distance > 0).length,
      totalDuration: activities.reduce((sum, a) => sum + (a.duration || 0), 0),
      averagePace: activities.length > 0 
        ? activities.reduce((sum, a) => sum + (a.avgPace || 0), 0) / activities.length
        : 0,
      lastActivityDate: activities.length > 0 
        ? activities.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())[0].date
        : undefined
    }
    
    // Calculate current streak (simplified - would need more sophisticated logic)
    const currentStreak = calculateCurrentStreak(activities)
    
    updateStats({
      ...updatedStats,
      currentStreak,
      longestStreak: Math.max(currentStreak, user.stats.longestStreak || 0)
    })

    return {
      unlockedAchievements: [...achievements, ...newAchievements].filter(a => a.unlockedAt),
      progressAchievements: progress.filter(a => a.progress > 0).slice(0, maxItems),
      motivationalMessage: message
    }
  }, [user, activities, achievements, addAchievement, updateStats, maxItems])

  if (!user) {
    return null
  }

  if (variant === 'compact') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrophyIcon className="w-5 h-5" />
              Achievements
            </div>
            <span className="text-sm opacity-60">
              {unlockedAchievements.length} unlocked
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Motivational message */}
          <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
            <div className="flex items-start gap-2">
              <SparklesIcon className="w-4 h-4 mt-0.5 text-purple-600 dark:text-purple-400" />
              <p className="text-sm text-purple-800 dark:text-purple-200">
                {motivationalMessage}
              </p>
            </div>
          </div>

          {/* Recent achievements */}
          {unlockedAchievements.slice(-2).map(achievement => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              size="sm"
              showProgress={false}
            />
          ))}

          {/* Progress on next achievements */}
          {progressAchievements.slice(0, 2).map(achievement => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              size="sm"
              showProgress={true}
            />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with motivation */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrophyIcon className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">Achievements</h2>
        </div>
        <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
              Coach Says
            </span>
          </div>
          <p className="text-purple-800 dark:text-purple-200">
            {motivationalMessage}
          </p>
        </div>
      </div>

      {/* Unlocked Achievements */}
      {unlockedAchievements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrophyIcon className="w-5 h-5" />
            Unlocked ({unlockedAchievements.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlockedAchievements
              .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
              .map(achievement => (
                <AchievementCard
                  key={achievement.id}
                  achievement={achievement}
                  size="md"
                  showProgress={false}
                />
              ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5" />
          In Progress
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {progressAchievements.map(achievement => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              size="md"
              showProgress={true}
            />
          ))}
        </div>
      </div>
    </div>
  )
})

// Helper function to calculate current streak
function calculateCurrentStreak(activities: SimpleActivity[]): number {
  if (activities.length === 0) return 0
  
  // Sort activities by date (most recent first)
  const sortedActivities = activities
    .filter(a => a.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  
  if (sortedActivities.length === 0) return 0
  
  let streak = 0
  const today = new Date()
  const oneDayMs = 24 * 60 * 60 * 1000
  
  // Check if there's an activity today or yesterday
  const mostRecentDate = new Date(sortedActivities[0].date)
  const daysSinceRecent = Math.floor((today.getTime() - mostRecentDate.getTime()) / oneDayMs)
  
  if (daysSinceRecent > 1) {
    return 0 // Streak broken
  }
  
  // Count consecutive days with activities
  const activityDates = new Set(sortedActivities.map(a => (a.date || '').split('T')[0]).filter(Boolean))
  let currentDate = new Date(mostRecentDate)
  
  while (activityDates.has(currentDate.toISOString().split('T')[0])) {
    streak++
    currentDate = new Date(currentDate.getTime() - oneDayMs)
  }
  
  return streak
}

AchievementsDashboard.displayName = 'AchievementsDashboard'
export default AchievementsDashboard