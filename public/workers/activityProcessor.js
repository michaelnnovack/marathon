// Web Worker for processing large activity datasets
self.onmessage = function(e) {
  const { type, data } = e.data
  
  switch (type) {
    case 'CALCULATE_WEEKLY_MILEAGE': {
      const { activities } = data
      const result = calculateWeeklyMileage(activities)
      self.postMessage({ type: 'WEEKLY_MILEAGE_RESULT', data: result })
      break
    }
    
    case 'CALCULATE_LAST_7_DAYS': {
      const { activities } = data
      const result = calculateLast7Days(activities)
      self.postMessage({ type: 'LAST_7_DAYS_RESULT', data: result })
      break
    }
    
    case 'PREDICT_MARATHON_TIME': {
      const { activities } = data
      const result = predictTime(activities)
      self.postMessage({ type: 'PREDICTION_RESULT', data: result })
      break
    }
    
    default:
      console.warn('Unknown worker task type:', type)
  }
}

function calculateWeeklyMileage(activities) {
  if (activities.length > 1000) {
    activities = activities.slice(-1000)
  }
  
  const byWeek = new Map()
  for (const a of activities) {
    if (!a.date) continue
    const d = new Date(a.date)
    const monday = new Date(d)
    const day = monday.getDay() || 7
    if (day !== 1) monday.setHours(-24 * (day - 1))
    monday.setHours(0, 0, 0, 0)
    const key = monday.toISOString().slice(0, 10)
    byWeek.set(key, (byWeek.get(key) || 0) + (a.distance / 1000))
  }
  
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, km]) => ({ week, km }))
}

function calculateLast7Days(activities) {
  if (activities.length > 1000) {
    activities = activities.slice(-1000)
  }
  
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  return activities
    .filter(a => {
      if (!a.date) return false
      const activityDate = new Date(a.date)
      return activityDate >= sevenDaysAgo && activityDate <= now
    })
    .reduce((total, a) => total + (a.distance / 1000), 0)
}

function predictTime(activities) {
  // Simplified prediction logic for the worker
  if (activities.length < 5) {
    return { seconds: 0, ci: 0 }
  }
  
  const recent = activities.slice(-20)
  const avgPace = recent.reduce((sum, a) => {
    if (!a.duration || !a.distance) return sum
    return sum + (a.duration / (a.distance / 1000))
  }, 0) / recent.filter(a => a.duration && a.distance).length
  
  if (!avgPace || avgPace === 0) {
    return { seconds: 0, ci: 0 }
  }
  
  // Simple marathon time prediction (42.195 km * pace)
  const marathonTime = avgPace * 42.195
  
  return {
    seconds: Math.round(marathonTime),
    ci: Math.round(marathonTime * 0.1) // 10% confidence interval
  }
}