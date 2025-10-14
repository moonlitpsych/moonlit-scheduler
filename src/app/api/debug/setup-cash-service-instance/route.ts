// Debug endpoint to setup cash payment service instance
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check if cash payment service instance already exists
    const { data: existingInstance } = await supabaseAdmin
      .from('service_instances')
      .select('id, service_id, payer_id, services(name)')
      .is('payer_id', null)
      .limit(10)

    console.log('📦 Existing NULL payer service instances:', existingInstance)

    // Check for all services to find intake-related ones
    const { data: allServices } = await supabaseAdmin
      .from('services')
      .select('id, name, duration_minutes')
      .order('name')

    const intakeService = allServices?.find(s =>
      s.name.toLowerCase().includes('intake') ||
      s.duration_minutes === 60
    )

    if (!intakeService) {
      return NextResponse.json({
        error: 'No Intake service found',
        allServices,
        existingInstances: existingInstance
      }, { status: 404 })
    }

    // Create cash payment service instance if it doesn't exist
    let cashInstance = existingInstance?.find(
      (inst: any) => inst.service_id === intakeService.id
    )

    if (!cashInstance) {
      console.log('🔧 Creating cash payment service instance...')
      const { data: newInstance, error: createError } = await supabaseAdmin
        .from('service_instances')
        .insert({
          service_id: intakeService.id,
          payer_id: null, // NULL means cash payment / all payers
          created_at: new Date().toISOString()
        })
        .select('id, service_id')
        .single()

      if (createError) {
        return NextResponse.json({
          error: 'Failed to create cash service instance',
          details: createError
        }, { status: 500 })
      }

      cashInstance = newInstance
    }

    return NextResponse.json({
      success: true,
      cashServiceInstance: {
        id: cashInstance.id,
        service_id: intakeService.id,
        service_name: intakeService.name,
        duration_minutes: intakeService.duration_minutes,
        usage: 'Set this ID in intakeResolver.ts for cash payment'
      },
      allNullPayerInstances: existingInstance
    })

  } catch (error: any) {
    console.error('❌ Setup cash service instance error:', error)
    return NextResponse.json({
      error: 'Failed to setup cash service instance',
      details: error.message
    }, { status: 500 })
  }
}
