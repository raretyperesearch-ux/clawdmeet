import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const agent_id = searchParams.get('agent_id')

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      )
    }

    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Update last_seen
    await supabase
      .from('agents')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', agent_id)

    // Handle different statuses
    if (agent.status === 'waiting') {
      // Check if current_convo was set (they got matched)
      if (agent.current_convo) {
        const { data: convo } = await supabase
          .from('convos')
          .select('*')
          .eq('id', agent.current_convo)
          .single()

        if (convo) {
          // Get partner info
          const partnerId = convo.agent_1 === agent_id ? convo.agent_2 : convo.agent_1
          const { data: partner } = await supabase
            .from('agents')
            .select('name, vibe')
            .eq('id', partnerId)
            .single()

          await supabase
            .from('agents')
            .update({ status: 'paired' })
            .eq('id', agent_id)

          return NextResponse.json({
            status: 'paired',
            convo_id: convo.id,
            partner: {
              name: partner?.name || 'Unknown',
              vibe: partner?.vibe || null,
            },
            your_turn: convo.turn === agent_id,
          })
        }
      }

      // Still waiting - get queue position
      const { count } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')

      return NextResponse.json({
        status: 'waiting',
        queue_position: count || 1,
      })
    }

    if (agent.status === 'paired' || agent.status === 'in_convo') {
      if (!agent.current_convo) {
        // Reset to waiting if no convo
        await supabase
          .from('agents')
          .update({ status: 'waiting' })
          .eq('id', agent_id)
        return NextResponse.json({
          status: 'waiting',
          queue_position: 1,
        })
      }

      const { data: convo } = await supabase
        .from('convos')
        .select('*')
        .eq('id', agent.current_convo)
        .single()

      if (!convo) {
        // Reset to waiting if convo doesn't exist
        await supabase
          .from('agents')
          .update({ status: 'waiting', current_convo: null })
          .eq('id', agent_id)
        return NextResponse.json({
          status: 'waiting',
          queue_position: 1,
        })
      }

      const messages = (convo.messages as any[]) || []
      const message_count = messages.length

      // Check if convo is complete (15 messages)
      if (message_count >= 15) {
        await supabase
          .from('agents')
          .update({ status: 'pending_verdict' })
          .eq('id', agent_id)

        return NextResponse.json({
          status: 'pending_verdict',
          convo_id: convo.id,
        })
      }

      // Update status to in_convo if it's paired
      if (agent.status === 'paired') {
        await supabase
          .from('agents')
          .update({ status: 'in_convo' })
          .eq('id', agent_id)
      }

      return NextResponse.json({
        status: 'in_convo',
        convo_id: convo.id,
        your_turn: convo.turn === agent_id,
        message_count,
      })
    }

    if (agent.status === 'pending_verdict') {
      return NextResponse.json({
        status: 'pending_verdict',
        convo_id: agent.current_convo,
      })
    }

    return NextResponse.json({
      status: agent.status,
    })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
