"use client"
import { memo } from 'react'
import { UserCircleIcon, CogIcon, TrophyIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { UserProfile } from '@/store/user'
import Image from 'next/image'

interface ProfileCardProps {
  user: UserProfile
  isActive?: boolean
  onClick?: () => void
  showStats?: boolean
}

const ProfileCard = memo<ProfileCardProps>(({ user, isActive, onClick, showStats = true }) => {
  const levelColors = {
    beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }

  const formatDistance = (meters: number) => {
    const km = meters / 1000
    return km > 100 ? `${Math.round(km)}km` : `${km.toFixed(1)}km`
  }

  return (
    <div
      className={`transition-all cursor-pointer hover:shadow-lg hover:scale-[1.02] rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 ${
        isActive 
          ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
          : 'hover:bg-white/80 dark:hover:bg-black/40'
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              {user.avatar ? (
                <Image 
                  src={user.avatar} 
                  alt={user.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <UserCircleIcon className="w-8 h-8 text-white" />
                </div>
              )}
              {isActive && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{user.name}</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[user.level]}`}>
                  {user.level.charAt(0).toUpperCase() + user.level.slice(1)}
                </span>
              </div>
            </div>
          </div>
          {isActive && (
            <CogIcon className="w-5 h-5 opacity-60" />
          )}
        </div>

        {/* Training Focus */}
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {user.trainingFocus.map((focus) => (
              <span
                key={focus}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded-md"
              >
                {focus.charAt(0).toUpperCase() + focus.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Race Info */}
        {user.raceDate && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <div className="font-medium">Race Day</div>
              <div>{new Date(user.raceDate).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}</div>
              {user.goalTime && (
                <div className="text-xs opacity-80 mt-1">
                  Goal: {user.goalTime}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/10 dark:border-white/10">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <ChartBarIcon className="w-4 h-4 opacity-60" />
                <span className="text-xs opacity-60">Distance</span>
              </div>
              <div className="font-semibold text-sm">
                {formatDistance(user.stats.totalDistance)}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrophyIcon className="w-4 h-4 opacity-60" />
                <span className="text-xs opacity-60">Workouts</span>
              </div>
              <div className="font-semibold text-sm">
                {user.stats.totalWorkouts}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

ProfileCard.displayName = 'ProfileCard'
export default ProfileCard