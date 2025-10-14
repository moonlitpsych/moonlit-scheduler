// Verify cash service instance mapping exists
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const cashServiceInstanceId = '1e2c8ef7-84ae-49af-bafd-01efc16757a8'

    // Check all mappings for this service instance
    const { data: allMappings, error } = await supabaseAdmin
      .from('service_instance_integrations')
      .select('*')
      .eq('service_instance_id', cashServiceInstanceId)

    if (error) throw error

    // Also check if ANY mappings exist at all
    const { data: anyMappings } = await supabaseAdmin
      .from('service_instance_integrations')
      .select('*')
      .limit(10)

    return NextResponse.json({
      cashServiceInstanceId,
      mappingsForCash: allMappings || [],
      totalMappingsFound: allMappings?.length || 0,
      sampleMappingsInDatabase: anyMappings || [],
      issue: allMappings?.length === 0
        ? 'Cash mapping was NOT created or was deleted'
        : 'Cash mapping exists'
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
