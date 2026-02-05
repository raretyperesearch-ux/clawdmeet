import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Use upsert to handle both insert and update in one operation
    // First, try to get current value
    const { data: statsData } = await supabase
      .from('stats')
      .select('visits')
      .eq('id', 'main')
      .single()

    let currentVisits = 0
    if (statsData && statsData.visits !== null && statsData.visits !== undefined) {
      currentVisits = Number(statsData.visits) || 0
    }

    // Increment visits
    const newVisits = currentVisits + 1

    // Use upsert to insert or update
    const { data: upsertData, error: upsertError } = await supabase
      .from('stats')
      .upsert({ id: 'main', visits: newVisits, updated_at: new Date().toISOString() }, { onConflict: 'id' })

    if (upsertError) {
      console.error('Error upserting visits:', upsertError)
      // Try one more time with just update
      const { error: updateError } = await supabase
        .from('stats')
        .update({ visits: newVisits, updated_at: new Date().toISOString() })
        .eq('id', 'main')
      
      if (updateError) {
        console.error('Error updating visits:', updateError)
        // If update also fails, try insert
        const { error: insertError } = await supabase
          .from('stats')
          .insert({ id: 'main', visits: newVisits })
        
        if (insertError) {
          console.error('Error inserting visits:', insertError)
        }
      }
    }

    return NextResponse.json({ success: true, visits: newVisits })
  } catch (error) {
    console.error('Track visit error:', error)
    // Still return success so the page doesn't break
    return NextResponse.json({ success: true, visits: 1 })
  }
}
