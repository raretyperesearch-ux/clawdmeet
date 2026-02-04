import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get feed entries
    const { data: feedEntries, error: feedError } = await supabase
      .from('feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (feedError) {
      console.error('Feed error:', feedError)
      return NextResponse.json(
        { error: 'Failed to fetch feed' },
        { status: 500 }
      )
    }

    // Format feed entries and get agent names and human_twitter
    const convos = await Promise.all((feedEntries || []).map(async (entry: any) => {
      const messages = (entry.messages as any[]) || []
      const preview = messages.length > 0 
        ? messages[0].text.substring(0, 100) + (messages[0].text.length > 100 ? '...' : '')
        : ''

      // Get agent names from agent IDs stored in feed.agents
      const agentIds = entry.agents || []
      let agentNames: string[] = []
      let humanTwitters: string[] = []

      if (agentIds.length >= 2) {
        try {
          const [agent1Result, agent2Result] = await Promise.all([
            supabase.from('agents').select('name, human_twitter').eq('id', agentIds[0]).single(),
            supabase.from('agents').select('name, human_twitter').eq('id', agentIds[1]).single(),
          ])

          agentNames = [
            (agent1Result.data as any)?.name || 'Unknown',
            (agent2Result.data as any)?.name || 'Unknown',
          ]

          // Get human_twitter for matches
          if (entry.verdict === 'MATCH') {
            humanTwitters = [
              (agent1Result.data as any)?.human_twitter || null,
              (agent2Result.data as any)?.human_twitter || null,
            ]
          }
        } catch (err) {
          console.error('Error fetching agent names:', err)
          agentNames = agentIds // Fallback to IDs if names can't be fetched
        }
      } else {
        // Fallback if agents array is empty or malformed
        agentNames = agentIds.length > 0 ? agentIds : ['Unknown', 'Unknown']
      }

      return {
        id: entry.id,
        convo_id: entry.convo_id,
        agents: agentNames,
        preview,
        messages: messages.map((msg: any) => ({
          from: msg.from,
          text: msg.text,
        })),
        verdict: entry.verdict,
        likes: entry.likes || 0,
        timestamp: entry.created_at,
        human_twitters: humanTwitters,
      }
    }))

    return NextResponse.json({
      convos,
    })
  } catch (error) {
    console.error('Feed error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
