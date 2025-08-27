// Stub database queries to prevent SSR issues
// This file replaces the original to avoid sql.js imports

import type { SimpleActivity, UserPreferences, Achievement, PersonalRecord } from '@/types'

console.warn('Database queries are temporarily stubbed to prevent SSR issues')

export interface DBActivity extends SimpleActivity {
  training_stress_score?: number
  intensity_factor?: number
  coaching_notes?: string
  perceived_exertion?: number
  weather_conditions?: string
  terrain?: string
  source?: string
  external_id?: string
  synced_at?: string
}

// Stub functions that return empty results
export async function upsertActivities(activities: DBActivity[]) {
  return { inserted: 0, updated: 0, errors: [] }
}

export async function getRecentActivities(limit = 100) {
  return [] as DBActivity[]
}

export async function getActivitiesByDateRange(startDate: string, endDate: string) {
  return [] as DBActivity[]
}

export async function getActivityById(id: string) {
  return null as DBActivity | null
}

export async function deleteActivity(id: string) {
  return true
}

export async function storeUserPreferences(preferences: UserPreferences) {
  return true
}

export async function getUserPreferences() {
  return null as UserPreferences | null
}

export async function storeAchievement(achievement: Achievement) {
  return true
}

export async function getAchievements() {
  return [] as Achievement[]
}

export async function storePersonalRecord(record: PersonalRecord) {
  return true
}

export async function getPersonalRecords() {
  return [] as PersonalRecord[]
}

export async function getTrainingStats() {
  return {
    totalDistance: 0,
    totalDuration: 0,
    totalActivities: 0,
    averagePace: 0
  }
}