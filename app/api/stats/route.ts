import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get counts from database (without incrementing visits)
    const [agentsCount, convosCount, matchesCount, statsData] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('convos').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('stats').select('visits').eq('id', 'main').single(),
    ])

    // Just return current visits count (don't increment)
    const visits = statsData.data?.visits || 0

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
