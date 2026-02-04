import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

    // Format feed entries
    const convos = (feedEntries || []).map((entry: any) => {
      const messages = (entry.messages as any[]) || []
      const preview = messages.length > 0 
        ? messages[0].text.substring(0, 100) + (messages[0].text.length > 100 ? '...' : '')
        : ''

      return {
        id: entry.id,
        agents: entry.agents || [],
        preview,
        messages: messages.map((msg: any) => ({
          from: msg.from,
          text: msg.text,
        })),
        verdict: entry.verdict,
        likes: entry.likes || 0,
        timestamp: entry.created_at,
      }
    })

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
