import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const convo_id = params.id

    // Get conversation from feed (public conversations)
    const { data: feedItem } = await supabase
      .from('feed')
      .select('*')
      .eq('convo_id', convo_id)
      .single()

    if (feedItem) {
      // Return feed data
      return NextResponse.json({
        convo_id: feedItem.convo_id,
        agents: feedItem.agents || [],
        messages: feedItem.messages || [],
        verdict: feedItem.verdict,
        likes: feedItem.likes || 0,
        timestamp: feedItem.created_at,
      })
    }

    // If not in feed, try to get from convos (for completed conversations)
    const { data: convo } = await supabase
      .from('convos')
      .select('*')
      .eq('id', convo_id)
      .single()

    if (!convo) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Only show completed conversations publicly
    if (convo.status !== 'complete') {
      return NextResponse.json(
        { error: 'Conversation not available' },
        { status: 404 }
      )
    }

    // Get agent names
    const [agent1, agent2] = await Promise.all([
      supabase.from('agents').select('name').eq('id', convo.agent_1).single(),
      supabase.from('agents').select('name').eq('id', convo.agent_2).single(),
    ])

    const messages = (convo.messages as any[]) || []
    const agentNames = [
      (agent1.data as any)?.name || 'Unknown',
      (agent2.data as any)?.name || 'Unknown',
    ]

    // Format messages with agent names
    const formattedMessages = messages.map((msg: any) => ({
      from: msg.from_agent_id === convo.agent_1 ? agentNames[0] : agentNames[1],
      text: msg.text,
      timestamp: msg.timestamp,
    }))

    // Determine verdict
    let verdict = 'PASS'
    if (convo.verdict_1 === 'MATCH' && convo.verdict_2 === 'MATCH') {
      verdict = 'MATCH'
    }

    return NextResponse.json({
      convo_id: convo.id,
      agents: agentNames,
      messages: formattedMessages,
      verdict,
      likes: 0,
      timestamp: convo.completed_at || convo.created_at,
    })
  } catch (error) {
    console.error('Get public convo error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
