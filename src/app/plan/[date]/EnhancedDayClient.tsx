"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUserStore } from '@/store/user'
import { generatePlan } from '@/utils/plan'
import { useProgress } from '@/store/progress'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { 
  CheckIcon, 
  ArrowLeftIcon, 
  ClockIcon, 
  HeartIcon,
  FireIcon,
  MapPinIcon,
  StarIcon,
  TrophyIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

export default function EnhancedDayClient({ date }: { date: string }) {
  const user = useUserStore((s) => s.user)
  const progress = useProgress()

  const [rpe, setRpe] = useState<number>(5)
  const [notes, setNotes] = useState<string>('')
  const [actualDistance, setActualDistance] = useState<string>('')
  const [actualDuration, setActualDuration] = useState<string>('')
  const [heartRate, setHeartRate] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    progress.hydrate()
  }, [progress])

  const plan = useMemo(
    () => (user?.raceDate ? generatePlan(user.id, new Date().toISOString().slice(0, 10), user.raceDate) : null),
    [user?.raceDate, user?.id]
  )
  const workout = useMemo(() => (plan ? plan.weeks.flatMap((w) => w.days).find((d) => d.date === date) : null), [plan, date])

  useEffect(() => {
    if (workout?.id && progress.map[workout.id]) {
      const completion = progress.map[workout.id]
      setRpe(completion.rpe || 5)
      setNotes(completion.notes || '')
      // Load additional completion data if available
    }
  }, [workout?.id, progress.map])

  if (!user?.raceDate) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Set Your Race Date</h2>
        <p className="text-sm opacity-70 mb-4">Configure your training plan in setup</p>
        <Link href="/setup">
          <Button>Go to Setup</Button>
        </Link>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Workout Not Found</h2>
        <p className="text-sm opacity-70 mb-4">No workout scheduled for {date}</p>
        <Link href="/plan">
          <Button variant="outline">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Training Plan
          </Button>
        </Link>
      </div>
    )
  }
  
  const isCompleted = workout.id && progress.map[workout.id]?.completedAt
  const estimatedDistance = Math.round((workout.duration * 0.2) * 10) / 10 // rough estimate
  const workoutTypeColors = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    tempo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    interval: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    long: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    recovery: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    cross: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    race: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
  }

  const save = async () => {
    if (!workout) return
    
    setIsSubmitting(true)
    try {
      const completionData = {
        completedAt: new Date().toISOString(),
        rpe,
        notes,
        actualDistance: actualDistance ? parseFloat(actualDistance) : undefined,
        actualDuration: actualDuration ? parseFloat(actualDuration) * 60 : undefined, // convert minutes to seconds
        avgHeartRate: heartRate ? parseInt(heartRate) : undefined
      }
      
      progress.mark(workout.id, completionData)
      setShowSuccess(true)
      
      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save workout:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/plan">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Plan
          </Button>
        </Link>
        
        {isCompleted && (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckIcon className="w-4 h-4" />
            Completed
          </Badge>
        )}
      </div>

      {/* Workout Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={workoutTypeColors[workout.type as keyof typeof workoutTypeColors]}>
                {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
              </Badge>
              <h1 className="text-2xl font-bold">
                {new Date(workout.date).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric'
                })}
              </h1>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-lg">{workout.description}</p>
          
          {/* Workout Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <ClockIcon className="w-5 h-5 mx-auto mb-1 opacity-60" />
              <div className="text-sm opacity-60">Duration</div>
              <div className="font-semibold">{workout.duration}min</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <MapPinIcon className="w-5 h-5 mx-auto mb-1 opacity-60" />
              <div className="text-sm opacity-60">Est. Distance</div>
              <div className="font-semibold">~{estimatedDistance}km</div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <FireIcon className="w-5 h-5 mx-auto mb-1 opacity-60" />
              <div className="text-sm opacity-60">Intensity</div>
              <div className="font-semibold">
                {workout.type === 'easy' || workout.type === 'recovery' ? 'Low' :
                 workout.type === 'tempo' || workout.type === 'long' ? 'Moderate' : 'High'}
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <StarIcon className="w-5 h-5 mx-auto mb-1 opacity-60" />
              <div className="text-sm opacity-60">Focus</div>
              <div className="font-semibold text-sm">
                {workout.type === 'easy' ? 'Recovery' :
                 workout.type === 'tempo' ? 'Threshold' :
                 workout.type === 'interval' ? 'VO2 Max' :
                 workout.type === 'long' ? 'Endurance' : 'Active Recovery'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Completion Form */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CheckIcon className="w-5 h-5" />
              {isCompleted ? 'Update Workout' : 'Complete Workout'}
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success Message */}
            {showSuccess && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <TrophyIcon className="w-5 h-5" />
                  <span className="font-medium">Workout saved successfully!</span>
                </div>
              </div>
            )}

            {/* Actual Performance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Actual Distance (km)</label>
                <input
                  type="number"
                  step="0.1"
                  value={actualDistance}
                  onChange={(e) => setActualDistance(e.target.value)}
                  className="w-full p-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30"
                  placeholder={estimatedDistance.toString()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Actual Duration (min)</label>
                <input
                  type="number"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(e.target.value)}
                  className="w-full p-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30"
                  placeholder={workout.duration.toString()}
                />
              </div>
            </div>
            
            {/* Heart Rate */}
            <div>
              <label className="block text-sm font-medium mb-1">Average Heart Rate (bpm)</label>
              <input
                type="number"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full p-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30"
                placeholder="Optional"
              />
            </div>

            {/* RPE */}
            <div>
              <label className="block text-sm font-medium mb-2">Rate of Perceived Exertion (RPE)</label>
              <div className="space-y-2">
                <input 
                  type="range" 
                  min={1} 
                  max={10} 
                  value={rpe} 
                  onChange={(e) => setRpe(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs opacity-60">
                  <span>1 - Very Easy</span>
                  <span className="font-medium text-base">{rpe}</span>
                  <span>10 - Maximal</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full p-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30"
                placeholder="How did the workout feel? Any observations?"
              />
            </div>

            <Button 
              onClick={save}
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                <CheckIcon className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? 'Saving...' : isCompleted ? 'Update Workout' : 'Complete Workout'}
            </Button>
          </CardContent>
        </Card>

        {/* Pace Zones & Tips */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ClockIcon className="w-5 h-5" />
                Target Pace Zones
              </h3>
            </CardHeader>
            <CardContent>
              <PaceZones goalTime={user.goalTime} workoutType={workout.type} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <HeartIcon className="w-5 h-5" />
                Workout Tips
              </h3>
            </CardHeader>
            <CardContent>
              <WorkoutTips workoutType={workout.type} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PaceZones({ goalTime, workoutType }: { goalTime?: string, workoutType: string }) {
  if (!goalTime) {
    return (
      <div className="text-center py-4">
        <p className="text-sm opacity-80 mb-2">Set a goal time to see target paces</p>
        <Link href="/setup">
          <Button variant="outline" size="sm">Go to Setup</Button>
        </Link>
      </div>
    )
  }
  
  const [h, m, s] = goalTime.split(':').map(Number)
  const marathonSec = h * 3600 + m * 60 + s
  const paceSec = marathonSec / 42.195
  
  const fmt = (sec: number) => {
    const mm = Math.floor(sec / 60)
    const ss = Math.round(sec % 60).toString().padStart(2, '0')
    return `${mm}:${ss}/km`
  }
  
  const zones = [
    { name: 'Easy', pace: fmt(paceSec * 1.3), color: 'bg-green-100 dark:bg-green-900/20', active: workoutType === 'easy' || workoutType === 'recovery' },
    { name: 'Tempo', pace: fmt(paceSec * 1.05), color: 'bg-orange-100 dark:bg-orange-900/20', active: workoutType === 'tempo' },
    { name: 'Interval', pace: fmt(paceSec * 0.9), color: 'bg-red-100 dark:bg-red-900/20', active: workoutType === 'interval' },
    { name: 'Long Run', pace: fmt(paceSec * 1.15), color: 'bg-purple-100 dark:bg-purple-900/20', active: workoutType === 'long' },
    { name: 'Marathon Pace', pace: fmt(paceSec), color: 'bg-blue-100 dark:bg-blue-900/20', active: workoutType === 'race' }
  ]
  
  return (
    <div className="space-y-2">
      {zones.map(zone => (
        <div 
          key={zone.name}
          className={`p-3 rounded-lg transition-all ${
            zone.active 
              ? `${zone.color} ring-2 ring-indigo-500 font-semibold` 
              : 'bg-gray-50 dark:bg-gray-800 opacity-60'
          }`}
        >
          <div className="flex justify-between items-center">
            <span className="text-sm">{zone.name}</span>
            <span className="font-mono text-sm">{zone.pace}</span>
          </div>
          {zone.active && (
            <div className="text-xs mt-1 opacity-80">← Target for this workout</div>
          )}
        </div>
      ))}
    </div>
  )
}

function WorkoutTips({ workoutType }: { workoutType: string }) {
  const tips = {
    easy: [
      'Keep conversation pace - you should be able to talk easily',
      'Focus on building aerobic base and promoting recovery',
      'Aim for 70-80% of your weekly volume at this effort'
    ],
    tempo: [
      'Maintain "comfortably hard" effort for the prescribed duration',
      'This should feel like a pace you could sustain for about an hour',
      'Focus on rhythm and breathing control'
    ],
    interval: [
      'Warm up thoroughly with 15-20 minutes easy running',
      'Hit target pace for work intervals, jog easily for recovery',
      'Cool down with 10-15 minutes easy running'
    ],
    long: [
      'Start conservatively and build into your target pace',
      'Practice race-day fueling and hydration strategies',
      'Focus on mental resilience and positive self-talk'
    ],
    recovery: [
      'Keep effort very light - this is about promoting blood flow',
      'Shorter duration, focus on form and relaxation',
      'Better to go too easy than too hard'
    ],
    cross: [
      'Choose low-impact activities like cycling, swimming, or elliptical',
      'Maintain aerobic benefit while giving running muscles a break',
      'Focus on maintaining fitness while reducing injury risk'
    ]
  }
  
  const workoutTips = tips[workoutType as keyof typeof tips] || ['Follow your training plan and listen to your body']
  
  return (
    <div className="space-y-2">
      {workoutTips.map((tip, index) => (
        <div key={index} className="flex items-start gap-2 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0"></div>
          <span className="opacity-80">{tip}</span>
        </div>
      ))}
    </div>
  )
}