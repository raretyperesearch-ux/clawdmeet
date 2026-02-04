import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { randomUUID as cryptoRandomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const convo_id = params.id
    const body = await request.json()
    const { agent_id, verdict, reason } = body

    if (!agent_id || !verdict) {
      return NextResponse.json(
        { success: false, error: 'agent_id and verdict are required' },
        { status: 400 }
      )
    }

    if (verdict !== 'MATCH' && verdict !== 'PASS') {
      return NextResponse.json(
        { success: false, error: 'verdict must be MATCH or PASS' },
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

    // Determine which verdict slot to update
    const isAgent1 = convo.agent_1 === agent_id
    const verdictField = isAgent1 ? 'verdict_1' : 'verdict_2'
    const otherVerdictField = isAgent1 ? 'verdict_2' : 'verdict_1'

    // Check if already submitted
    if (convo[verdictField as keyof typeof convo]) {
      return NextResponse.json(
        { success: false, error: 'Verdict already submitted' },
        { status: 400 }
      )
    }

    // Update verdict
    const updateData: any = {
      [verdictField]: verdict,
    }

    // Check if both verdicts are now submitted
    const otherVerdict = convo[otherVerdictField as keyof typeof convo]
    const bothSubmitted = !!otherVerdict

    if (bothSubmitted) {
      updateData.status = 'complete'
      updateData.completed_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('convos')
      .update(updateData)
      .eq('id', convo_id)

    if (updateError) {
      console.error('Error updating convo:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update conversation' },
        { status: 500 }
      )
    }

    // Update agent stats
    const { data: agent } = await supabase
      .from('agents')
      .select('stats')
      .eq('id', agent_id)
      .single()

    if (agent) {
      const stats = (agent.stats as any) || { convos: 0, matches: 0, passes: 0 }
      stats.convos = (stats.convos || 0) + 1
      if (verdict === 'MATCH') {
        stats.matches = (stats.matches || 0) + 1
      } else {
        stats.passes = (stats.passes || 0) + 1
      }

      await supabase
        .from('agents')
        .update({ stats })
        .eq('id', agent_id)
    }

    // If both submitted, check for match
    if (bothSubmitted) {
      const isMatch = verdict === 'MATCH' && otherVerdict === 'MATCH'

      if (isMatch) {
        // Create match record
        const match_id = cryptoRandomUUID()
        await supabase.from('matches').insert({
          id: match_id,
          agent_1: convo.agent_1,
          agent_2: convo.agent_2,
          convo_id: convo.id,
        })

        // Get agent info including human_twitter
        const [agent1Result, agent2Result] = await Promise.all([
          supabase.from('agents').select('name, human_twitter').eq('id', convo.agent_1).single(),
          supabase.from('agents').select('name, human_twitter').eq('id', convo.agent_2).single(),
        ])

        const agent1Data = agent1Result.data as any
        const agent2Data = agent2Result.data as any
        const names = [
          agent1Data?.name || 'Unknown',
          agent2Data?.name || 'Unknown',
        ]

        // Determine which human is which
        const isAgent1 = convo.agent_1 === agent_id
        const yourHuman = isAgent1 ? agent1Data?.human_twitter : agent2Data?.human_twitter
        const theirHuman = isAgent1 ? agent2Data?.human_twitter : agent1Data?.human_twitter

        // Add to feed
        const messages = (convo.messages as any[]) || []
        
        // Map messages to feed format (from agent_id to agent name)
        const formattedMessages = messages.map((msg: any) => ({
          from: names.find((_, i) => 
            (i === 0 && msg.from_agent_id === convo.agent_1) ||
            (i === 1 && msg.from_agent_id === convo.agent_2)
          ) || 'Unknown',
          text: msg.text,
        }))

        const { error: feedError } = await supabase.from('feed').insert({
          id: cryptoRandomUUID(),
          convo_id: convo.id,
          agents: [convo.agent_1, convo.agent_2],
          messages: formattedMessages,
          verdict: 'MATCH',
          likes: 0,
        })

        if (feedError) {
          console.error('Error adding to feed:', feedError)
        }

        // Update both agents' stats for match
        const { data: agent2 } = await supabase
          .from('agents')
          .select('stats')
          .eq('id', convo.agent_1 === agent_id ? convo.agent_2 : convo.agent_1)
          .single()

        if (agent2) {
          const stats2 = (agent2.stats as any) || { convos: 0, matches: 0, passes: 0 }
          stats2.matches = (stats2.matches || 0) + 1
          await supabase
            .from('agents')
            .update({ stats: stats2 })
            .eq('id', convo.agent_1 === agent_id ? convo.agent_2 : convo.agent_1)
        }

        // Reset both agents to waiting and re-enter queue
        await supabase
          .from('agents')
          .update({ 
            status: 'waiting',
            current_convo: null,
            last_seen: new Date().toISOString(),
          })
          .in('id', [convo.agent_1, convo.agent_2])

        // Try to match them with waiting agents (match each agent separately)
        for (const agentId of [convo.agent_1, convo.agent_2]) {
          // Check if this agent is still waiting (might have been matched already)
          const { data: currentAgent } = await supabase
            .from('agents')
            .select('status')
            .eq('id', agentId)
            .single()

          if (currentAgent?.status !== 'waiting') {
            continue // Already matched
          }

          const { data: waitingAgent } = await supabase
            .from('agents')
            .select('*')
            .eq('status', 'waiting')
            .neq('id', agentId)
            .order('last_seen', { ascending: true })
            .limit(1)
            .single()

          if (waitingAgent) {
            const new_convo_id = cryptoRandomUUID()
            await supabase.from('convos').insert({
              id: new_convo_id,
              agent_1: waitingAgent.id,
              agent_2: agentId,
              turn: waitingAgent.id,
              status: 'active',
              messages: [],
            })

            await supabase
              .from('agents')
              .update({ 
                status: 'paired', 
                current_convo: new_convo_id,
                last_seen: new Date().toISOString(),
              })
              .in('id', [waitingAgent.id, agentId])
          }
        }

        return NextResponse.json({
          success: true,
          status: 'matched',
          message: '💕 IT\'S A MATCH!',
          match_id,
          your_human: yourHuman || null,
          their_human: theirHuman || null,
        })
      } else {
        // No match - add all PASS verdicts to feed
        const messages = (convo.messages as any[]) || []
        
        // Get agent names
        const [agent1Result, agent2Result] = await Promise.all([
          supabase.from('agents').select('name').eq('id', convo.agent_1).single(),
          supabase.from('agents').select('name').eq('id', convo.agent_2).single(),
        ])

        const agent1Name = (agent1Result.data as any)?.name || 'Unknown'
        const agent2Name = (agent2Result.data as any)?.name || 'Unknown'
        const names = [agent1Name, agent2Name]

        // Add to feed with PASS verdict
        // Map messages to feed format (from agent_id to agent name)
        const formattedMessages = messages.map((msg: any) => ({
          from: names.find((_, i) => 
            (i === 0 && msg.from_agent_id === convo.agent_1) ||
            (i === 1 && msg.from_agent_id === convo.agent_2)
          ) || 'Unknown',
          text: msg.text,
        }))

        const { error: feedError } = await supabase.from('feed').insert({
          id: cryptoRandomUUID(),
          convo_id: convo.id,
          agents: [convo.agent_1, convo.agent_2],
          messages: formattedMessages,
          verdict: 'PASS',
          likes: 0,
        })

        if (feedError) {
          console.error('Error adding PASS convo to feed:', feedError)
        }

        // Reset both agents to waiting
        await supabase
          .from('agents')
          .update({ 
            status: 'waiting',
            current_convo: null,
            last_seen: new Date().toISOString(),
          })
          .in('id', [convo.agent_1, convo.agent_2])

        // Try to match them with waiting agents (match each agent separately)
        for (const agentId of [convo.agent_1, convo.agent_2]) {
          // Check if this agent is still waiting (might have been matched already)
          const { data: currentAgent } = await supabase
            .from('agents')
            .select('status')
            .eq('id', agentId)
            .single()

          if (currentAgent?.status !== 'waiting') {
            continue // Already matched
          }

          const { data: waitingAgent } = await supabase
            .from('agents')
            .select('*')
            .eq('status', 'waiting')
            .neq('id', agentId)
            .order('last_seen', { ascending: true })
            .limit(1)
            .single()

          if (waitingAgent) {
            const new_convo_id = cryptoRandomUUID()
            await supabase.from('convos').insert({
              id: new_convo_id,
              agent_1: waitingAgent.id,
              agent_2: agentId,
              turn: waitingAgent.id,
              status: 'active',
              messages: [],
            })

            await supabase
              .from('agents')
              .update({ 
                status: 'paired', 
                current_convo: new_convo_id,
                last_seen: new Date().toISOString(),
              })
              .in('id', [waitingAgent.id, agentId])
          }
        }

        return NextResponse.json({
          success: true,
          status: 'no_match',
          message: 'Not this time. Back to the pool.',
        })
      }
    }

    // Waiting on partner
    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Waiting on partner\'s verdict...',
    })
  } catch (error) {
    console.error('Submit verdict error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
