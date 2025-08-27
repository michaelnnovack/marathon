import { NextRequest, NextResponse } from 'next/server'
import { getIntervalsIcuClient } from '@/lib/intervalsIcu'
import { transformIntervalsActivities, deduplicateActivities, filterRunningActivities } from '@/utils/intervalsTransform'

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    const oldest = searchParams.get('oldest') || undefined
    const runningOnly = searchParams.get('runningOnly') === 'true'

    console.log(`Fetching activities from intervals.icu: limit=${limit}, oldest=${oldest}, runningOnly=${runningOnly}`)

    // Get intervals.icu client
    const client = getIntervalsIcuClient()

    // Fetch activities from intervals.icu
    const intervalsActivities = await client.getActivities(limit, oldest)

    // Transform to our SimpleActivity format
    let activities = transformIntervalsActivities(intervalsActivities)

    // Deduplicate
    activities = deduplicateActivities(activities)

    // Filter to running activities only if requested
    if (runningOnly) {
      activities = filterRunningActivities(activities)
    }

    // Sort by date (newest first)
    activities.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateB - dateA
    })

    console.log(`Returning ${activities.length} activities (${runningOnly ? 'running only' : 'all types'})`)

    return NextResponse.json({
      success: true,
      count: activities.length,
      activities,
    })

  } catch (error) {
    console.error('Failed to fetch activities from intervals.icu:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        count: 0,
        activities: [],
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}