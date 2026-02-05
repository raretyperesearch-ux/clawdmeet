import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get all active conversations from the last 24 hours - include all statuses where convos are happening
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: convos, error: convosError } = await supabase
      .from('convos')
      .select('*')
      .in('status', ['active', 'paired', 'in_convo', 'pending_verdict'])
      .gte('created_at', twentyFourHoursAgo) // Only get convos from last 24 hours
      .order('created_at', { ascending: false })
      .limit(50)

    if (convosError) {
      console.error('Active convos error:', convosError)
      return NextResponse.json(
        { error: 'Failed to fetch active conversations' },
        { status: 500 }
      )
    }

    console.log(`Found ${convos?.length || 0} active conversations`)

    // Format conversations with agent names
    const formattedConvos = await Promise.all((convos || []).map(async (convo: any) => {
      // Get agent names and rizz scores from agents table
      const [agent1Result, agent2Result] = await Promise.all([
        supabase.from('agents').select('name, rizz_score').eq('id', convo.agent_1).single(),
        supabase.from('agents').select('name, rizz_score').eq('id', convo.agent_2).single(),
      ])

      const agent1Name = (agent1Result.data as { name?: string } | null)?.name || convo.agent_1 || 'Unknown'
      const agent2Name = (agent2Result.data as { name?: string } | null)?.name || convo.agent_2 || 'Unknown'
      const agent1Rizz = (agent1Result.data as { rizz_score?: number } | null)?.rizz_score ?? 50
      const agent2Rizz = (agent2Result.data as { rizz_score?: number } | null)?.rizz_score ?? 50
      
      // Get messages array - handle different formats
      let messages: any[] = []
      if (Array.isArray(convo.messages)) {
        messages = convo.messages
      } else if (convo.messages && typeof convo.messages === 'object') {
        // If messages is an object, try to extract array
        messages = []
      }

      // Format messages with agent names
      // Handle both message formats: { from_agent_id, text } and { from, text }
      const formattedMessages = messages.map((msg: any) => {
        if (!msg || !msg.text) return null
        
        // Determine which agent sent the message
        const isFromAgent1 = 
          msg.from_agent_id === convo.agent_1 || 
          msg.from === agent1Name || 
          msg.from === convo.agent_1 ||
          (msg.from_agent_id && msg.from_agent_id === convo.agent_1)
        
        return {
          from: isFromAgent1 ? agent1Name : agent2Name,
          text: msg.text || msg.message || '',
          timestamp: msg.timestamp || new Date().toISOString(),
        }
      }).filter(Boolean) // Remove any null entries

      // Determine final verdict if both submitted
      let finalVerdict: string | null = null
      if (convo.status === 'pending_verdict' && convo.verdict_1 && convo.verdict_2) {
        if (convo.verdict_1 === 'MATCH' && convo.verdict_2 === 'MATCH') {
          finalVerdict = 'MATCH'
        } else {
          finalVerdict = 'PASS'
        }
      }

      return {
        id: convo.id,
        agent_1: convo.agent_1,
        agent_2: convo.agent_2,
        agent1_name: agent1Name,
        agent2_name: agent2Name,
        agent1_rizz: agent1Rizz,
        agent2_rizz: agent2Rizz,
        agents: [agent1Name, agent2Name],
        messages: formattedMessages,
        message_count: messages.length,
        max_messages: 30,
        status: convo.status,
        verdict: finalVerdict,
        verdict_1: convo.verdict_1 || null,
        verdict_2: convo.verdict_2 || null,
        created_at: convo.created_at,
        turn: convo.turn,
      }
    }))

    console.log(`Formatted ${formattedConvos.length} conversations for response`)

    return NextResponse.json({
      convos: formattedConvos,
    })
  } catch (error) {
    console.error('Active convos error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
