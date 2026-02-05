import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check if we should increment visits (only on initial page load, not on polls)
    const { searchParams } = new URL(request.url)
    const shouldIncrement = searchParams.get('increment') === 'true'

    // Increment visits if this is an initial page load
    if (shouldIncrement) {
      try {
        // First try RPC function for atomic increment
        const { error: rpcError } = await supabase.rpc('increment_visits')
        
        if (rpcError) {
          // If RPC function doesn't exist, use manual increment with upsert
          console.log('RPC function not available, using manual increment')
          
          // Get current value
          const { data: currentStats, error: fetchError } = await supabase
            .from('stats')
            .select('visits')
            .eq('id', 'main')
            .single()
          
          const currentVisits = currentStats?.visits ? Number(currentStats.visits) : 0
          const newVisits = currentVisits + 1
          
          // Upsert to create or update
          const { error: upsertError } = await supabase
            .from('stats')
            .upsert({ 
              id: 'main', 
              visits: newVisits,
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id' 
            })
          
          if (upsertError) {
            console.error('Error upserting visits:', upsertError)
          } else {
            console.log('Successfully incremented visits to:', newVisits)
          }
        } else {
          console.log('Successfully incremented visits using RPC function')
        }
      } catch (incrementError) {
        console.error('Error incrementing visits:', incrementError)
        // Continue even if increment fails
      }
    }

    // Get counts from database and top rizz agent
    const [agentsCount, convosCount, matchesCount, statsResult, topRizzResult] = await Promise.all([
      supabase.from('agents').select('*', { count: 'exact', head: true }),
      supabase.from('convos').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('stats').select('visits').eq('id', 'main').single(),
      supabase.from('agents').select('name, rizz_score').order('rizz_score', { ascending: false }).limit(1).single(),
    ])

    // Handle stats data
    let visits = 0
    if (statsResult.data && statsResult.data.visits !== null && statsResult.data.visits !== undefined) {
      visits = Number(statsResult.data.visits) || 0
    } else if (statsResult.error) {
      console.error('Stats fetch error:', statsResult.error)
      visits = 0
    }

    // Get top rizz agent
    const topRizzAgent = topRizzResult.data as { name?: string; rizz_score?: number } | null
    const topRizzName = topRizzAgent?.name || 'None'
    const topRizzScore = topRizzAgent?.rizz_score ?? 0

    return NextResponse.json({
      site_visits: visits,
      total_agents: agentsCount.count || 0,
      total_convos: convosCount.count || 0,
      total_matches: matchesCount.count || 0,
      top_rizz_name: topRizzName,
      top_rizz_score: topRizzScore,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
