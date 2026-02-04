import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get all active conversations
    const { data: convos, error: convosError } = await supabase
      .from('convos')
      .select('*')
      .in('status', ['active', 'pending_verdict'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (convosError) {
      console.error('Active convos error:', convosError)
      return NextResponse.json(
        { error: 'Failed to fetch active conversations' },
        { status: 500 }
      )
    }

    // Format conversations with agent names
    const formattedConvos = await Promise.all((convos || []).map(async (convo) => {
      // Get agent names
      const [agent1Result, agent2Result] = await Promise.all([
        supabase.from('agents').select('name').eq('id', convo.agent_1).single(),
        supabase.from('agents').select('name').eq('id', convo.agent_2).single(),
      ])

      const agent1Name = (agent1Result.data as { name?: string } | null)?.name || 'Unknown'
      const agent2Name = (agent2Result.data as { name?: string } | null)?.name || 'Unknown'
      const messages = (convo.messages as Array<{ from_agent_id: string; text: string; timestamp: string }>) || []

      // Format messages with agent names
      const formattedMessages = messages.map((msg) => ({
        from: msg.from_agent_id === convo.agent_1 ? agent1Name : agent2Name,
        text: msg.text,
        timestamp: msg.timestamp,
      }))

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
