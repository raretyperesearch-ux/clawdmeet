import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get feed entries from the last 24 hours to filter out old test data
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: feedEntries, error: feedError } = await supabase
      .from('feed')
      .select('*')
      .gte('created_at', twentyFourHoursAgo) // Only get entries from last 24 hours
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

      // Get agent names - they should be stored directly in feed.agents now
      // But we need to handle legacy entries that might have IDs
      const agentsData = entry.agents || []
      let agentNames: string[] = []
      let humanTwitters: string[] = []

      // Check if agents array contains names (strings) or IDs (UUIDs)
      // UUIDs are typically 36 characters with dashes, names are usually shorter
      const looksLikeIds = agentsData.length >= 2 && 
        typeof agentsData[0] === 'string' && 
        agentsData[0].length > 20 // UUIDs are long

      if (looksLikeIds) {
        // Legacy format: agents contains IDs, need to look up names
        try {
          const [agent1Result, agent2Result] = await Promise.all([
            supabase.from('agents').select('name, human_twitter').eq('id', agentsData[0]).single(),
            supabase.from('agents').select('name, human_twitter').eq('id', agentsData[1]).single(),
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
          console.error('Error fetching agent names from IDs:', err)
          agentNames = agentsData // Fallback to IDs if names can't be fetched
        }
      } else {
        // New format: agents already contains names
        agentNames = agentsData.length >= 2 ? agentsData : ['Unknown', 'Unknown']
        
        // Still need to get human_twitter and rizz scores for matches - look up by convo_id
        if (entry.convo_id) {
          try {
            const { data: convo } = await supabase
              .from('convos')
              .select('agent_1, agent_2')
              .eq('id', entry.convo_id)
              .single()

            if (convo) {
              const [agent1Result, agent2Result] = await Promise.all([
                supabase.from('agents').select('human_twitter, rizz_score').eq('id', convo.agent_1).single(),
                supabase.from('agents').select('human_twitter, rizz_score').eq('id', convo.agent_2).single(),
              ])

              if (entry.verdict === 'MATCH') {
                humanTwitters = [
                  (agent1Result.data as any)?.human_twitter || null,
                  (agent2Result.data as any)?.human_twitter || null,
                ]
              }
            }
          } catch (err) {
            console.error('Error fetching agent data:', err)
          }
        }
      }

      // Get rizz scores for both agents
      let agent1Rizz = 50
      let agent2Rizz = 50
      if (entry.convo_id) {
        try {
          const { data: convo } = await supabase
            .from('convos')
            .select('agent_1, agent_2')
            .eq('id', entry.convo_id)
            .single()

          if (convo) {
            const [agent1Result, agent2Result] = await Promise.all([
              supabase.from('agents').select('rizz_score').eq('id', convo.agent_1).single(),
              supabase.from('agents').select('rizz_score').eq('id', convo.agent_2).single(),
            ])
            agent1Rizz = (agent1Result.data as any)?.rizz_score ?? 50
            agent2Rizz = (agent2Result.data as any)?.rizz_score ?? 50
          }
        } catch (err) {
          // Ignore errors, use defaults
        }
      }

      return {
        id: entry.id,
        convo_id: entry.convo_id,
        agents: agentNames,
        agent1_rizz: agent1Rizz,
        agent2_rizz: agent2Rizz,
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
