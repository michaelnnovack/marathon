"use client"

import { useState, useEffect } from 'react'
import { Workout, WorkoutType } from '@/types'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { 
  PencilIcon, 
  CheckIcon, 
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface WorkoutModifierProps {
  workouts: Workout[]
  onWorkoutUpdate: (workoutId: string, updates: Partial<Workout>) => void
  maxWeeksAhead?: number
}

interface WorkoutEdit {
  id: string
  type: WorkoutType
  description: string
  duration: number
}

export function WorkoutModifier({ 
  workouts, 
  onWorkoutUpdate, 
  maxWeeksAhead = 2 
}: WorkoutModifierProps) {
  const [editingWorkout, setEditingWorkout] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<WorkoutEdit | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Get modifiable workouts (next 2 weeks by default)
  const modifiableWorkouts = workouts.filter(workout => {
    const workoutDate = new Date(workout.date)
    const today = new Date()
    const maxDate = new Date()
    maxDate.setDate(today.getDate() + (maxWeeksAhead * 7))
    
    return workoutDate >= today && 
           workoutDate <= maxDate && 
           !workout.completed
  }).slice(0, 10) // Limit to next 10 workouts

  const workoutTypes: { value: WorkoutType; label: string; description: string }[] = [
    { value: 'easy', label: 'Easy Run', description: 'Comfortable aerobic pace' },
    { value: 'tempo', label: 'Tempo Run', description: 'Comfortably hard threshold pace' },
    { value: 'interval', label: 'Interval Training', description: 'High intensity with recovery' },
    { value: 'long', label: 'Long Run', description: 'Extended endurance training' },
    { value: 'recovery', label: 'Recovery Run', description: 'Very easy active recovery' },
    { value: 'cross', label: 'Cross Training', description: 'Non-running cardio activity' },
    { value: 'race', label: 'Race/Time Trial', description: 'Race effort or simulation' }
  ]

  const workoutTypeColors = {
    easy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    tempo: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    interval: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    long: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    recovery: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    cross: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    race: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
  }

  const startEdit = (workout: Workout) => {
    setEditingWorkout(workout.id)
    setEditForm({
      id: workout.id,
      type: workout.type,
      description: workout.description,
      duration: workout.duration
    })
    setHasChanges(false)
  }

  const cancelEdit = () => {
    setEditingWorkout(null)
    setEditForm(null)
    setHasChanges(false)
  }

  const saveEdit = () => {
    if (!editForm || !hasChanges) return
    
    onWorkoutUpdate(editForm.id, {
      type: editForm.type,
      description: editForm.description,
      duration: editForm.duration
    })
    
    setEditingWorkout(null)
    setEditForm(null)
    setHasChanges(false)
  }

  const updateEditForm = (updates: Partial<WorkoutEdit>) => {
    if (!editForm) return
    
    const updated = { ...editForm, ...updates }
    setEditForm(updated)
    
    // Check if there are actual changes
    const original = workouts.find(w => w.id === editForm.id)
    const hasActualChanges = original && (
      updated.type !== original.type ||
      updated.description !== original.description ||
      updated.duration !== original.duration
    )
    setHasChanges(Boolean(hasActualChanges))
  }

  if (modifiableWorkouts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PencilIcon className="w-5 h-5" />
            Modify Upcoming Workouts
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm opacity-70">No upcoming workouts available to modify</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PencilIcon className="w-5 h-5" />
            Modify Upcoming Workouts
          </div>
          <div className="text-sm opacity-70">
            Next {maxWeeksAhead} weeks
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {modifiableWorkouts.map((workout) => {
            const isEditing = editingWorkout === workout.id
            const workoutDate = new Date(workout.date)
            const isToday = workoutDate.toDateString() === new Date().toDateString()
            const isTomorrow = workoutDate.toDateString() === new Date(Date.now() + 86400000).toDateString()
            
            return (
              <div 
                key={workout.id}
                className={`p-4 border rounded-lg transition-all ${
                  isEditing ? 'border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' :
                  'border-gray-200 dark:border-gray-700'
                }`}
              >
                {isEditing && editForm ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {workoutDate.toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                        {isToday && <span className="text-blue-600 ml-2">(Today)</span>}
                        {isTomorrow && <span className="text-orange-600 ml-2">(Tomorrow)</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={cancelEdit}
                          className="text-gray-600"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm"
                          onClick={saveEdit}
                          disabled={!hasChanges}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckIcon className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>

                    {/* Workout Type Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Workout Type</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {workoutTypes.map((type) => (
                          <button
                            key={type.value}
                            onClick={() => updateEditForm({ type: type.value })}
                            className={`p-2 rounded-lg border text-left transition-all ${
                              editForm.type === type.value
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <div className="text-sm font-medium">{type.label}</div>
                            <div className="text-xs opacity-60">{type.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                      <input
                        type="number"
                        value={editForm.duration}
                        onChange={(e) => updateEditForm({ duration: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                        min="15"
                        max="300"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => updateEditForm({ description: e.target.value })}
                        rows={2}
                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                        placeholder="Describe the workout..."
                      />
                    </div>

                    {hasChanges && (
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                          Changes will be saved to your training plan
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={workoutTypeColors[workout.type]}>
                          {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)}
                        </Badge>
                        <span className="text-sm font-medium">
                          {workoutDate.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                          {isToday && <span className="text-blue-600 ml-2">(Today)</span>}
                          {isTomorrow && <span className="text-orange-600 ml-2">(Tomorrow)</span>}
                        </span>
                      </div>
                      
                      <p className="text-sm mb-1">{workout.description}</p>
                      
                      <div className="flex items-center gap-2 text-xs opacity-60">
                        <ClockIcon className="w-3 h-3" />
                        {workout.duration} minutes
                      </div>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => startEdit(workout)}
                      className="ml-4"
                    >
                      <PencilIcon className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Tip:</strong> Modify workouts thoughtfully to maintain training progression. 
            Consider moving a workout rather than skipping it entirely.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}