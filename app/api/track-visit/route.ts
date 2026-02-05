import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get current stats
    const { data: statsData } = await supabase
      .from('stats')
      .select('visits')
      .eq('id', 'main')
      .single()

    let visits = 1
    if (statsData && statsData.visits !== null) {
      // Increment existing visits
      visits = (statsData.visits || 0) + 1
      await supabase
        .from('stats')
        .update({ visits })
        .eq('id', 'main')
    } else {
      // Create stats row if it doesn't exist
      const { error: insertError } = await supabase
        .from('stats')
        .insert({ id: 'main', visits: 1 })
      
      // If insert fails (maybe due to race condition), try to get and update
      if (insertError) {
        const { data: existingStats } = await supabase
          .from('stats')
          .select('visits')
          .eq('id', 'main')
          .single()
        
        if (existingStats) {
          visits = (existingStats.visits || 0) + 1
          await supabase
            .from('stats')
            .update({ visits })
            .eq('id', 'main')
        }
      }
    }

    return NextResponse.json({ success: true, visits })
  } catch (error) {
    console.error('Track visit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
