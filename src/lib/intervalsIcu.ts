/**
 * Intervals.icu API Client
 * Fetches training data from intervals.icu API
 */

interface IntervalsActivity {
  id: number
  start_date_local: string // e.g., "2024-01-15T08:30:00"
  name?: string
  type?: string // e.g., "Run", "Ride", "Swim"
  distance?: number // meters
  moving_time?: number // seconds
  elapsed_time?: number // seconds
  total_elevation_gain?: number // meters
  average_heartrate?: number
  max_heartrate?: number
  average_speed?: number // m/s
  max_speed?: number // m/s
  calories?: number
  // There may be additional fields - this is based on common Strava-like structure
}

class IntervalsIcuClient {
  private baseUrl = 'https://intervals.icu/api/v1'
  private athleteId: string
  private apiKey: string

  constructor(athleteId: string, apiKey: string) {
    this.athleteId = athleteId
    this.apiKey = apiKey
  }

  /**
   * Create basic auth header for intervals.icu API
   * Uses API_KEY as username and the actual key as password
   */
  private getAuthHeaders(): Record<string, string> {
    const credentials = Buffer.from(`API_KEY:${this.apiKey}`).toString('base64')
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Fetch activities from intervals.icu
   * @param limit Number of activities to fetch (optional, default 200)
   * @param oldest Date string for oldest activity (optional, defaults to 6 months ago)
   * @returns Promise<IntervalsActivity[]>
   */
  async getActivities(limit = 200, oldest?: string): Promise<IntervalsActivity[]> {
    try {
      // Use the specific athlete ID
      const athleteParam = this.athleteId
      
      // If no oldest date provided, default to 6 months ago
      if (!oldest) {
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        oldest = sixMonthsAgo.toISOString().split('T')[0] // YYYY-MM-DD format
      }
      
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      params.append('oldest', oldest)
      
      const url = `${this.baseUrl}/athlete/${athleteParam}/activities?${params.toString()}`

      console.log(`Fetching activities from: ${url}`)
      
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Intervals.icu API error: ${response.status} ${response.statusText}`)
      }

      const activities = await response.json()
      console.log(`Fetched ${activities.length} activities from intervals.icu`)
      
      return activities as IntervalsActivity[]
    } catch (error) {
      console.error('Failed to fetch activities from intervals.icu:', error)
      throw error
    }
  }

  /**
   * Get activities as CSV format (alternative endpoint)
   * This might provide more detailed data
   */
  async getActivitiesCSV(limit?: number): Promise<string> {
    try {
      const athleteParam = this.athleteId === 'i390639' ? '0' : this.athleteId
      let url = `${this.baseUrl}/athlete/${athleteParam}/activities.csv`
      
      if (limit) {
        url += `?limit=${limit}`
      }

      const response = await fetch(url, {
        headers: {
          ...this.getAuthHeaders(),
          'Accept': 'text/csv',
        },
      })

      if (!response.ok) {
        throw new Error(`Intervals.icu CSV API error: ${response.status} ${response.statusText}`)
      }

      return await response.text()
    } catch (error) {
      console.error('Failed to fetch CSV activities from intervals.icu:', error)
      throw error
    }
  }

  /**
   * Get single activity details with intervals
   * @param activityId The activity ID
   */
  async getActivityDetails(activityId: number): Promise<Record<string, unknown>> {
    try {
      const url = `${this.baseUrl}/activity/${activityId}?intervals=true`
      
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Intervals.icu activity details error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Failed to fetch activity ${activityId} details:`, error)
      throw error
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getActivities(1) // Just fetch 1 activity to test
      return true
    } catch (error) {
      console.error('Intervals.icu API connection test failed:', error)
      return false
    }
  }
}

// Export singleton instance
let intervalsIcuClient: IntervalsIcuClient | null = null

export function getIntervalsIcuClient(): IntervalsIcuClient {
  if (!intervalsIcuClient) {
    const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID
    const apiKey = process.env.INTERVALS_ICU_API_KEY

    if (!athleteId || !apiKey) {
      throw new Error('Intervals.icu credentials not configured. Please set INTERVALS_ICU_ATHLETE_ID and INTERVALS_ICU_API_KEY environment variables.')
    }

    intervalsIcuClient = new IntervalsIcuClient(athleteId, apiKey)
  }

  return intervalsIcuClient
}

export type { IntervalsActivity }
export { IntervalsIcuClient }