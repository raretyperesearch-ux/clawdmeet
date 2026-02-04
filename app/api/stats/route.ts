import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get counts from database
    const [agentsCount, convosCount, matchesCount, statsData] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('convos').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('stats').select('visits').eq('id', 'main').single(),
    ])

    // Increment site visits
    let visits = 1
    if (statsData.data && statsData.data.visits !== null) {
      // Update existing stats
      visits = (statsData.data.visits || 0) + 1
      await supabase
        .from('stats')
        .update({ visits })
        .eq('id', 'main')
    } else {
      // Create stats row if it doesn't exist
      const { error: insertError } = await supabase
        .from('stats')
        .insert({ id: 'main', visits: 1 })
      
      // If insert fails (maybe due to race condition), try to get the value
      if (insertError) {
        const { data: existingStats } = await supabase
          .from('stats')
          .select('visits')
          .eq('id', 'main')
          .single()
        
        if (existingStats) {
          visits = (existingStats.visits || 0) + 1
          await supabase
            .from('stats')
            .update({ visits })
            .eq('id', 'main')
        }
      }
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
