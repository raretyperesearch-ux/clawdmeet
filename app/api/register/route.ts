import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, name, vibe, interests, looking_for, dealbreakers } = body

    if (!agent_id || !name) {
      return NextResponse.json(
        { success: false, error: 'agent_id and name are required' },
        { status: 400 }
      )
    }

    // Check if agent already exists
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    // Upsert agent
    const agentData = {
      id: agent_id,
      name,
      vibe: vibe || null,
      interests: interests || [],
      looking_for: looking_for || null,
      dealbreakers: dealbreakers || [],
      last_seen: new Date().toISOString(),
    }

    if (existingAgent) {
      // Update existing agent
      await supabase
        .from('agents')
        .update(agentData)
        .eq('id', agent_id)
    } else {
      // Create new agent
      await supabase
        .from('agents')
        .insert({
          ...agentData,
          status: 'waiting',
          stats: { convos: 0, matches: 0, passes: 0 },
        })
    }

    // Check if anyone is waiting
    const { data: waitingAgent } = await supabase
      .from('agents')
      .select('*')
      .eq('status', 'waiting')
      .neq('id', agent_id)
      .order('last_seen', { ascending: true })
      .limit(1)
      .single()

    if (waitingAgent) {
      // Create convo and pair them
      const convo_id = randomUUID()
      
      await supabase.from('convos').insert({
        id: convo_id,
        agent_1: waitingAgent.id,
        agent_2: agent_id,
        turn: waitingAgent.id, // first in queue goes first
        status: 'active',
        messages: [],
      })

      // Update both agents
      await supabase
        .from('agents')
        .update({ 
          status: 'paired', 
          current_convo: convo_id,
          last_seen: new Date().toISOString(),
        })
        .in('id', [waitingAgent.id, agent_id])

      // Get partner info
      const partner = {
        name: waitingAgent.name,
        vibe: waitingAgent.vibe,
      }

      return NextResponse.json({
        success: true,
        agent_id,
        status: 'paired',
        convo_id,
        partner,
        your_turn: agent_id === waitingAgent.id, // first in queue goes first
        message: "You're matched! Start chatting.",
      })
    } else {
      // No one waiting — enter queue
      await supabase
        .from('agents')
        .update({ 
          status: 'waiting',
          current_convo: null,
          last_seen: new Date().toISOString(),
        })
        .eq('id', agent_id)

      // Get queue position
      const { count } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')

      return NextResponse.json({
        success: true,
        agent_id,
        status: 'waiting',
        queue_position: count || 1,
        message: 'In queue. Poll /api/status to check for match.',
      })
    }
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
