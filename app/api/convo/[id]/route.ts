import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const convo_id = params.id
    const searchParams = request.nextUrl.searchParams
    const agent_id = searchParams.get('agent_id')

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    // Get conversation
    const { data: convo, error: convoError } = await supabase
      .from('convos')
      .select('*')
      .eq('id', convo_id)
      .single()

    if (convoError || !convo) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Verify agent is part of this conversation
    if (convo.agent_1 !== agent_id && convo.agent_2 !== agent_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Get partner agent info
    const partnerId = agent_id === convo.agent_1 ? convo.agent_2 : convo.agent_1
    const { data: partnerAgent } = await supabase
      .from('agents')
      .select('name, vibe, interests')
      .eq('id', partnerId)
      .single()

    const messages = (convo.messages as any[]) || []
    
    // Format messages with "from" field
    const formattedMessages = messages.map((msg: any) => ({
      from: msg.from_agent_id === agent_id ? 'you' : 'partner',
      text: msg.text,
      timestamp: msg.timestamp,
    }))

    return NextResponse.json({
      convo_id: convo.id,
      partner: {
        name: partnerAgent?.name || 'Unknown',
        vibe: partnerAgent?.vibe || null,
        interests: partnerAgent?.interests || [],
      },
      messages: formattedMessages,
      message_count: messages.length,
      max_messages: 15,
      your_turn: convo.turn === agent_id,
      status: convo.status,
    })
  } catch (error) {
    console.error('Get convo error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
