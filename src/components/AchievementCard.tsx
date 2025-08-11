"use client"
import { memo } from 'react'
import { Achievement } from '@/types'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { TrophyIcon, LockClosedIcon } from '@heroicons/react/24/outline'

interface AchievementCardProps {
  achievement: Achievement
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
}

const AchievementCard = memo<AchievementCardProps>(({ 
  achievement, 
  size = 'md', 
  showProgress = true 
}) => {
  const isUnlocked = !!achievement.unlockedAt
  
  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }

  const iconSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl'
  }

  const categoryColors = {
    bronze: 'from-amber-600 to-amber-800',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-purple-400 to-purple-600'
  }

  const categoryBorderColors = {
    bronze: 'border-amber-500/30',
    silver: 'border-gray-500/30',
    gold: 'border-yellow-500/30',
    platinum: 'border-purple-500/30'
  }

  const formatValue = (value: number, unit?: string): string => {
    if (!unit) return value.toString()
    
    if (unit === 'km') {
      return value < 10 ? `${value.toFixed(1)}km` : `${Math.round(value)}km`
    }
    if (unit === 'm') {
      return value >= 1000 ? `${(value / 1000).toFixed(1)}km` : `${Math.round(value)}m`
    }
    if (unit === 'min') {
      const hours = Math.floor(value / 60)
      const minutes = Math.round(value % 60)
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }
    
    return `${Math.round(value)} ${unit}`
  }

  return (
    <Card 
      className={`transition-all hover:shadow-lg ${sizeClasses[size]} ${
        isUnlocked 
          ? `bg-gradient-to-br ${categoryColors[achievement.category]} text-white ${categoryBorderColors[achievement.category]}` 
          : 'opacity-60 hover:opacity-80'
      }`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`${iconSizes[size]} flex-shrink-0`}>
              {isUnlocked ? achievement.icon : '🔒'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold leading-tight ${
                size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg'
              }`}>
                {achievement.title}
              </h3>
              <p className={`opacity-80 ${
                size === 'sm' ? 'text-xs' : 'text-sm'
              }`}>
                {achievement.description}
              </p>
            </div>
          </div>
          
          {isUnlocked && (
            <div className="flex items-center gap-1">
              <TrophyIcon className="w-4 h-4" />
              {size !== 'sm' && (
                <span className="text-xs font-medium">
                  {achievement.category.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress */}
        {showProgress && !isUnlocked && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>
                {formatValue(achievement.threshold * achievement.progress, achievement.unit)} / {formatValue(achievement.threshold, achievement.unit)}
              </span>
            </div>
            <Progress 
              value={achievement.progress * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Unlock date */}
        {isUnlocked && achievement.unlockedAt && size !== 'sm' && (
          <div className="text-xs opacity-80 flex items-center gap-1">
            <TrophyIcon className="w-3 h-3" />
            Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </Card>
  )
})

AchievementCard.displayName = 'AchievementCard'
export default AchievementCard