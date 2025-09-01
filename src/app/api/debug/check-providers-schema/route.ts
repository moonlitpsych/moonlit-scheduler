import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('🔍 Checking current providers table schema...')

    // Get a sample provider to see current schema
    const { data: sampleProvider, error } = await supabaseAdmin
      .from('providers')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      throw new Error(`Failed to fetch sample provider: ${error.message}`)
    }

    // Get all column names from the sample
    const columns = Object.keys(sampleProvider || {}).sort()

    console.log(`📊 Found ${columns.length} columns in providers table`)
    
    // Look for about-related fields
    const aboutFields = columns.filter(col => 
      col.toLowerCase().includes('about') || 
      col.toLowerCase().includes('bio') ||
      col.toLowerCase().includes('description')
    )

    return NextResponse.json({
      success: true,
      totalColumns: columns.length,
      allColumns: columns,
      aboutRelatedFields: aboutFields,
      sampleProvider: sampleProvider
    })

  } catch (error) {
    console.error('❌ Schema check failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Schema check failed',
      details: error.message
    }, { status: 500 })
  }
}