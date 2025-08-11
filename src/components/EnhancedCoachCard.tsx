"use client"
import { memo, useMemo } from 'react'
import { UserProfile } from '@/store/user'
import { SimpleActivity } from '@/types'
import { getCoachingAdvice } from '@/utils/coach/advice'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { 
  AcademicCapIcon, 
  LightBulbIcon, 
  ExclamationTriangleIcon, 
  FlagIcon,
  ChatBubbleLeftEllipsisIcon
} from '@heroicons/react/24/outline'

interface EnhancedCoachCardProps {
  user: UserProfile
  activities: SimpleActivity[]
  className?: string
}

const EnhancedCoachCard = memo<EnhancedCoachCardProps>(({ user, activities, className }) => {
  const advice = useMemo(() => {
    if (!user.raceDate) {
      return {
        weeklyFocus: 'Set a race date to get personalized training guidance.',
        motivation: `Welcome ${user.name}! Ready to start your marathon journey?`,
        tips: ['Set a realistic race date', 'Start with easy-paced runs', 'Focus on consistency over speed'],
        nextGoals: ['Complete your first week of training'],
        warnings: []
      }
    }

    const now = new Date()
    const race = new Date(user.raceDate)
    const weeksToRace = Math.max(0, Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 7)))
    
    return getCoachingAdvice(user, activities, weeksToRace)
  }, [user, activities])

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AcademicCapIcon className="w-5 h-5" />
          Your Coach
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly Focus */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              {advice.weeklyFocus}
            </div>
          </div>
        </div>

        {/* Motivation */}
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-sm text-green-800 dark:text-green-200 font-medium">
            {advice.motivation}
          </div>
        </div>

        {/* Warnings */}
        {advice.warnings && advice.warnings.length > 0 && (
          <div className="space-y-2">
            {advice.warnings.map((warning, index) => (
              <div key={index} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    {warning}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tips */}
        {advice.tips.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium opacity-70">
              <LightBulbIcon className="w-4 h-4" />
              Training Tips
            </div>
            <div className="space-y-2">
              {advice.tips.map((tip, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
                  <div className="opacity-80">{tip}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Goals */}
        {advice.nextGoals.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium opacity-70">
              <FlagIcon className="w-4 h-4" />
              Next Goals
            </div>
            <div className="space-y-2">
              {advice.nextGoals.map((goal, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                  <div className="opacity-80">{goal}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

EnhancedCoachCard.displayName = 'EnhancedCoachCard'
export default EnhancedCoachCard