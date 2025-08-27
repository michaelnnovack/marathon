// Export all DAOs for convenient importing
export { BaseDAO } from './base'
export { ActivitiesDAO } from './activities'
export { FitnessDAO, type FitnessMetrics } from './fitness'
export { CoachDAO, type CoachRecommendation, type CoachRecommendationType } from './coach'

// DAO instances - singleton pattern for performance
let activitiesDAO: ActivitiesDAO | null = null
let fitnessDAO: FitnessDAO | null = null
let coachDAO: CoachDAO | null = null

export function getActivitiesDAO(): ActivitiesDAO {
  if (!activitiesDAO) {
    activitiesDAO = new ActivitiesDAO()
  }
  return activitiesDAO
}

export function getFitnessDAO(): FitnessDAO {
  if (!fitnessDAO) {
    fitnessDAO = new FitnessDAO()
  }
  return fitnessDAO
}

export function getCoachDAO(): CoachDAO {
  if (!coachDAO) {
    coachDAO = new CoachDAO()
  }
  return coachDAO
}