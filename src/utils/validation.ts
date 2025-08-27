// Type guards and validation utilities

export function isValidDate(dateString: string): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date.getTime())
}

export function isValidGoalTime(goalTime: string): boolean {
  if (!goalTime) return false
  const timeRegex = /^\d{1,2}:\d{2}:\d{2}$/
  if (!timeRegex.test(goalTime)) return false
  
  const [hours, minutes, seconds] = goalTime.split(':').map(Number)
  return hours >= 0 && hours <= 23 && 
         minutes >= 0 && minutes <= 59 && 
         seconds >= 0 && seconds <= 59
}

export function isValidDistance(distance: number | string): boolean {
  const num = typeof distance === 'string' ? parseFloat(distance) : distance
  return !isNaN(num) && num >= 0 && num <= 1000 // max 1000km seems reasonable
}

export function isValidDuration(duration: number | string): boolean {
  const num = typeof duration === 'string' ? parseFloat(duration) : duration
  return !isNaN(num) && num >= 0 && num <= 1440 // max 24 hours in minutes
}

export function isValidHeartRate(hr: number | string): boolean {
  const num = typeof hr === 'string' ? parseInt(hr) : hr
  return !isNaN(num) && num >= 30 && num <= 220
}

export function isValidRPE(rpe: number): boolean {
  return Number.isInteger(rpe) && rpe >= 1 && rpe <= 10
}

// Input sanitization
export function sanitizeString(input: string, maxLength = 500): string {
  return input.trim().slice(0, maxLength)
}

export function sanitizeNumber(input: string | number, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : input
  if (isNaN(num)) return null
  return Math.max(min, Math.min(max, num))
}

// Form validation
export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateWorkoutCompletion(data: {
  actualDistance?: string
  actualDuration?: string
  heartRate?: string
  rpe: number
  notes: string
}): ValidationResult {
  const errors: string[] = []
  
  if (data.actualDistance && !isValidDistance(data.actualDistance)) {
    errors.push('Distance must be a positive number (max 1000km)')
  }
  
  if (data.actualDuration && !isValidDuration(data.actualDuration)) {
    errors.push('Duration must be a positive number (max 24 hours)')
  }
  
  if (data.heartRate && !isValidHeartRate(data.heartRate)) {
    errors.push('Heart rate must be between 30 and 220 bpm')
  }
  
  if (!isValidRPE(data.rpe)) {
    errors.push('RPE must be a number between 1 and 10')
  }
  
  if (data.notes && data.notes.length > 1000) {
    errors.push('Notes cannot exceed 1000 characters')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Type guards for runtime type checking
export function isSimpleActivity(obj: unknown): obj is import('@/types').SimpleActivity {
  return obj !== null && 
         obj !== undefined &&
         typeof obj === 'object' &&
         'distance' in obj &&
         typeof (obj as Record<string, unknown>).distance === 'number' &&
         'duration' in obj &&
         typeof (obj as Record<string, unknown>).duration === 'number'
}

export function isUser(obj: unknown): obj is import('@/types').User {
  return obj !== null &&
         obj !== undefined &&
         typeof obj === 'object' &&
         'id' in obj &&
         typeof (obj as Record<string, unknown>).id === 'string' &&
         'name' in obj &&
         typeof (obj as Record<string, unknown>).name === 'string' &&
         'preferences' in obj &&
         'stats' in obj
}

export function isWorkout(obj: unknown): obj is import('@/types').Workout {
  return obj !== null &&
         obj !== undefined &&
         typeof obj === 'object' &&
         'id' in obj &&
         typeof (obj as Record<string, unknown>).id === 'string' &&
         'date' in obj &&
         typeof (obj as Record<string, unknown>).date === 'string' &&
         'type' in obj &&
         typeof (obj as Record<string, unknown>).type === 'string' &&
         'duration' in obj &&
         typeof (obj as Record<string, unknown>).duration === 'number'
}