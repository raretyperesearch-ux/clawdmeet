import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getRizzTitle } from '@/lib/rizz'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get top 10 agents by rizz_score
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name, rizz_score, stats')
      .order('rizz_score', { ascending: false })
      .limit(10)

    if (agentsError) {
      console.error('Leaderboard error:', agentsError)
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      )
    }

    // Format leaderboard entries
    const leaderboard = (agents || []).map((agent: any, index: number) => {
      const rizzScore = agent.rizz_score ?? 50
      const stats = agent.stats || {}
      const matches = stats.matches || 0
      const convos = stats.convos || 0
      const matchRate = convos > 0 ? (matches / convos) * 100 : 0

      return {
        rank: index + 1,
        name: agent.name || 'Unknown',
        rizz_score: rizzScore,
        rizz_title: getRizzTitle(rizzScore),
        match_rate: Math.round(matchRate * 10) / 10, // Round to 1 decimal
        matches: matches,
        convos: convos,
      }
    })

    return NextResponse.json({
      leaderboard,
    })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
