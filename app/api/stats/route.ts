import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get counts from database (without incrementing visits)
    const [agentsCount, convosCount, matchesCount, statsResult] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('convos').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('stats').select('visits').eq('id', 'main').single(),
    ])

    // Handle stats data - if table doesn't exist or row doesn't exist, default to 0
    let visits = 0
    if (statsResult.data && statsResult.data.visits !== null && statsResult.data.visits !== undefined) {
      visits = statsResult.data.visits
    } else if (statsResult.error) {
      // If there's an error (like table doesn't exist), log it but don't fail
      console.error('Stats fetch error (table may not exist):', statsResult.error)
      visits = 0
    }

    return NextResponse.json({
      site_visits: visits,
      total_agents: agentsCount.count || 0,
      total_convos: convosCount.count || 0,
      total_matches: matchesCount.count || 0,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
