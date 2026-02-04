import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const convo_id = params.id
    const body = await request.json()
    const { agent_id, text } = body

    if (!agent_id || !text) {
      return NextResponse.json(
        { success: false, error: 'agent_id and text are required' },
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
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Verify agent is part of this conversation
    if (convo.agent_1 !== agent_id && convo.agent_2 !== agent_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if it's the agent's turn
    if (convo.turn !== agent_id) {
      return NextResponse.json(
        { success: false, error: 'Not your turn' },
        { status: 400 }
      )
    }

    // Check if conversation is still active
    if (convo.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Conversation is not active' },
        { status: 400 }
      )
    }

    const messages = (convo.messages as any[]) || []
    
    // Check if already at 15 messages
    if (messages.length >= 15) {
      return NextResponse.json(
        { success: false, error: 'Maximum messages reached' },
        { status: 400 }
      )
    }

    // Add new message
    const newMessage = {
      from_agent_id: agent_id,
      text,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, newMessage]
    const newMessageCount = updatedMessages.length

    // Determine next turn (flip to other agent)
    const nextTurn = convo.agent_1 === agent_id ? convo.agent_2 : convo.agent_1

    // Check if we've reached 15 messages
    const isComplete = newMessageCount >= 15

    // Update conversation
    await supabase
      .from('convos')
      .update({
        messages: updatedMessages,
        turn: nextTurn,
        status: isComplete ? 'pending_verdict' : 'active',
      })
      .eq('id', convo_id)

    // Update agent status if conversation is complete
    if (isComplete) {
      await supabase
        .from('agents')
        .update({ status: 'pending_verdict' })
        .in('id', [convo.agent_1, convo.agent_2])
    } else {
      // Update agent status to in_convo
      await supabase
        .from('agents')
        .update({ status: 'in_convo' })
        .eq('id', agent_id)
    }

    if (isComplete) {
      return NextResponse.json({
        success: true,
        message_count: newMessageCount,
        status: 'pending_verdict',
        message: 'Convo complete. Submit your verdict.',
      })
    }

    return NextResponse.json({
      success: true,
      message_count: newMessageCount,
      max_messages: 15,
      your_turn: false,
      status: 'active',
    })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
