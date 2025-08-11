import type { Achievement, AchievementType, SimpleActivity, UserStats } from '@/types'

interface AchievementConfig {
  id: string
  type: AchievementType
  title: string
  description: string
  icon: string
  thresholds: {
    bronze: number
    silver: number
    gold: number
    platinum: number
  }
  unit?: string
  checkProgress: (activities: SimpleActivity[], stats: UserStats) => number
}

const achievementConfigs: AchievementConfig[] = [
  {
    id: 'first_run',
    type: 'milestone',
    title: 'First Steps',
    description: 'Complete your first run',
    icon: '🏃‍♀️',
    thresholds: { bronze: 1, silver: 1, gold: 1, platinum: 1 },
    checkProgress: (_, stats) => stats.totalWorkouts
  },
  {
    id: 'total_distance',
    type: 'distance',
    title: 'Distance Warrior',
    description: 'Total distance covered',
    icon: '🏆',
    unit: 'km',
    thresholds: { bronze: 50, silver: 200, gold: 500, platinum: 1000 },
    checkProgress: (_, stats) => stats.totalDistance / 1000
  },
  {
    id: 'workout_streak',
    type: 'streak',
    title: 'Consistency Champion',
    description: 'Consecutive workout days',
    icon: '🔥',
    unit: 'days',
    thresholds: { bronze: 7, silver: 21, gold: 50, platinum: 100 },
    checkProgress: (_, stats) => stats.currentStreak
  },
  {
    id: 'workout_count',
    type: 'consistency',
    title: 'Workout Warrior',
    description: 'Total workouts completed',
    icon: '💪',
    unit: 'workouts',
    thresholds: { bronze: 10, silver: 50, gold: 150, platinum: 365 },
    checkProgress: (_, stats) => stats.totalWorkouts
  },
  {
    id: 'long_run',
    type: 'distance',
    title: 'Long Distance Runner',
    description: 'Longest single run',
    icon: '🦌',
    unit: 'km',
    thresholds: { bronze: 10, silver: 21, gold: 32, platinum: 42 },
    checkProgress: (activities) => {
      return Math.max(...activities.map(a => (a.distance || 0) / 1000), 0)
    }
  },
  {
    id: 'fast_5k',
    type: 'pace',
    title: 'Speed demon 5K',
    description: 'Fastest 5K time',
    icon: '⚡',
    unit: 'min',
    thresholds: { bronze: 30, silver: 25, gold: 20, platinum: 18 },
    checkProgress: (activities) => {
      const runs5k = activities.filter(a => {
        const distanceKm = (a.distance || 0) / 1000
        return distanceKm >= 4.5 && distanceKm <= 5.5 && a.duration
      })
      if (runs5k.length === 0) return 0
      
      const bestTime = Math.min(...runs5k.map(a => (a.duration || 0) / 60))
      // Return inverted value so lower time = higher progress
      return bestTime > 0 ? 40 - bestTime : 0
    }
  },
  {
    id: 'early_bird',
    type: 'milestone',
    title: 'Early Bird',
    description: 'Complete 10 morning runs (before 8 AM)',
    icon: '🌅',
    thresholds: { bronze: 10, silver: 25, gold: 50, platinum: 100 },
    checkProgress: (activities) => {
      return activities.filter(a => {
        if (!a.date) return false
        const hour = new Date(a.date).getHours()
        return hour >= 5 && hour < 8
      }).length
    }
  },
  {
    id: 'weekend_warrior',
    type: 'consistency',
    title: 'Weekend Warrior',
    description: 'Weekend runs completed',
    icon: '🏖️',
    unit: 'weekends',
    thresholds: { bronze: 4, silver: 12, gold: 26, platinum: 52 },
    checkProgress: (activities) => {
      return activities.filter(a => {
        if (!a.date) return false
        const day = new Date(a.date).getDay()
        return day === 0 || day === 6 // Sunday or Saturday
      }).length
    }
  },
  {
    id: 'elevation_climber',
    type: 'milestone',
    title: 'Mountain Climber',
    description: 'Total elevation gained',
    icon: '⛰️',
    unit: 'm',
    thresholds: { bronze: 1000, silver: 5000, gold: 15000, platinum: 50000 },
    checkProgress: (activities) => {
      return activities.reduce((total, a) => total + (a.elevationGain || 0), 0)
    }
  },
  {
    id: 'heart_rate_zone',
    type: 'milestone',
    title: 'Zone Master',
    description: 'Runs with heart rate data',
    icon: '❤️',
    unit: 'runs',
    thresholds: { bronze: 5, silver: 20, gold: 50, platinum: 100 },
    checkProgress: (activities) => {
      return activities.filter(a => a.avgHr && a.avgHr > 0).length
    }
  }
]

export function checkAchievements(
  activities: SimpleActivity[],
  stats: UserStats,
  currentAchievements: Achievement[]
): Achievement[] {
  const newAchievements: Achievement[] = []
  const existingIds = new Set(currentAchievements.map(a => a.id))

  for (const config of achievementConfigs) {
    const progress = config.checkProgress(activities, stats)
    
    // Determine the highest category achieved
    let category: Achievement['category'] | null = null
    let threshold = 0
    
    if (progress >= config.thresholds.platinum) {
      category = 'platinum'
      threshold = config.thresholds.platinum
    } else if (progress >= config.thresholds.gold) {
      category = 'gold'
      threshold = config.thresholds.gold
    } else if (progress >= config.thresholds.silver) {
      category = 'silver'
      threshold = config.thresholds.silver
    } else if (progress >= config.thresholds.bronze) {
      category = 'bronze'
      threshold = config.thresholds.bronze
    }

    if (category && !existingIds.has(`${config.id}_${category}`)) {
      const achievement: Achievement = {
        id: `${config.id}_${category}`,
        type: config.type,
        title: `${config.title} - ${category.charAt(0).toUpperCase() + category.slice(1)}`,
        description: config.description,
        icon: config.icon,
        threshold,
        unit: config.unit,
        unlockedAt: new Date().toISOString(),
        progress: Math.min(progress / threshold, 1),
        category
      }
      
      newAchievements.push(achievement)
    }
  }

  return newAchievements
}

export function calculateAchievementProgress(
  activities: SimpleActivity[],
  stats: UserStats
): Achievement[] {
  const progressAchievements: Achievement[] = []

  for (const config of achievementConfigs) {
    const progress = config.checkProgress(activities, stats)
    
    // Find the next threshold to work towards
    let nextCategory: Achievement['category'] = 'bronze'
    let nextThreshold = config.thresholds.bronze
    
    if (progress >= config.thresholds.platinum) {
      nextCategory = 'platinum'
      nextThreshold = config.thresholds.platinum
    } else if (progress >= config.thresholds.gold) {
      nextCategory = 'platinum'
      nextThreshold = config.thresholds.platinum
    } else if (progress >= config.thresholds.silver) {
      nextCategory = 'gold'
      nextThreshold = config.thresholds.gold
    } else if (progress >= config.thresholds.bronze) {
      nextCategory = 'silver'
      nextThreshold = config.thresholds.silver
    }

    const achievement: Achievement = {
      id: `${config.id}_progress`,
      type: config.type,
      title: config.title,
      description: config.description,
      icon: config.icon,
      threshold: nextThreshold,
      unit: config.unit,
      progress: Math.min(progress / nextThreshold, 1),
      category: nextCategory
    }
    
    progressAchievements.push(achievement)
  }

  return progressAchievements.sort((a, b) => b.progress - a.progress)
}

export function getMotivationalMessage(achievements: Achievement[]): string {
  const recentAchievements = achievements
    .filter(a => a.unlockedAt)
    .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
    .slice(0, 1)

  if (recentAchievements.length > 0) {
    const achievement = recentAchievements[0]
    return `🎉 Congratulations on earning "${achievement.title}"! Keep up the amazing work!`
  }

  const nearCompletion = achievements
    .filter(a => !a.unlockedAt && a.progress > 0.8)
    .sort((a, b) => b.progress - a.progress)[0]

  if (nearCompletion) {
    const remaining = Math.ceil(nearCompletion.threshold * (1 - nearCompletion.progress))
    const unit = nearCompletion.unit || 'points'
    return `🔥 You're so close! Just ${remaining} ${unit} until you unlock "${nearCompletion.title}"!`
  }

  return "Every run is a step toward greatness. Keep moving forward! 💪"
}