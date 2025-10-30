import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    const report: any = {
      timestamp: new Date().toISOString(),
      tables_checked: []
    }

    // Services table structure will be inferred from data

    // Check all services records
    const { data: allServices, error: servicesError } = await supabaseAdmin
      .from('services')
      .select('*')
      .order('name')

    if (!servicesError) {
      report.services_records = {
        count: allServices?.length || 0,
        records: allServices,
        default_cpt_values: allServices?.map(s => ({
          id: s.id,
          name: s.name,
          default_cpt: s.default_cpt
        }))
      }
    }

    // Check cpt_codes table
    const { data: cptCodes, error: cptError } = await supabaseAdmin
      .from('cpt_codes')
      .select('*')
      .order('code')

    if (!cptError) {
      report.cpt_codes_table = {
        count: cptCodes?.length || 0,
        records: cptCodes,
        codes_we_need: ['99205', '99204', '90838', '99214', '99215', '90836', '90833'],
        matching_codes: cptCodes?.filter(c =>
          ['99205', '99204', '90838', '99214', '99215', '90836', '90833'].includes(c.code)
        )
      }
    }

    // Check service_cpt_codes join table
    const { data: serviceCptJoin, error: joinError } = await supabaseAdmin
      .from('service_cpt_codes')
      .select(`
        service_id,
        cpt_code_id,
        services (id, name, default_cpt),
        cpt_codes (id, code, description)
      `)

    if (!joinError) {
      report.service_cpt_codes_join = {
        count: serviceCptJoin?.length || 0,
        records: serviceCptJoin,
        our_target_cpts: serviceCptJoin?.filter((j: any) =>
          ['99205', '99204', '90838', '99214', '99215', '90836', '90833'].includes(j.cpt_codes?.code)
        )
      }
    }

    // Fee schedule lines table structure will be inferred from data

    // Check existing fee schedule lines
    const { data: existingFeeSchedule, error: feeScheduleError } = await supabaseAdmin
      .from('fee_schedule_lines')
      .select(`
        id,
        payer_id,
        service_id,
        allowed_cents,
        effective_date,
        payers (id, name),
        services (id, name, default_cpt)
      `)
      .limit(20)

    if (!feeScheduleError) {
      report.existing_fee_schedule_lines = {
        count: existingFeeSchedule?.length || 0,
        sample_records: existingFeeSchedule
      }
    }

    // Analysis and recommendations
    report.analysis = {
      services_with_default_cpt: allServices?.filter(s => s.default_cpt)?.length || 0,
      services_without_default_cpt: allServices?.filter(s => !s.default_cpt)?.length || 0,
      cpt_codes_available: cptCodes?.length || 0,
      service_cpt_mappings: serviceCptJoin?.length || 0
    }

    // Determine the correct approach for migration
    const servicesWithTargetCpts = allServices?.filter(s =>
      ['99205', '99204', '90838', '99214', '99215', '90836', '90833'].includes(s.default_cpt)
    ) || []

    report.migration_strategy = {
      found_services_with_target_cpts: servicesWithTargetCpts.length,
      services_matched: servicesWithTargetCpts.map(s => ({
        service_id: s.id,
        service_name: s.name,
        default_cpt: s.default_cpt
      })),
      recommendation: servicesWithTargetCpts.length === 7
        ? 'Can use services.default_cpt directly'
        : servicesWithTargetCpts.length > 0
          ? 'Partial match - need to investigate missing CPT codes'
          : 'No matches - need to use service_cpt_codes join table or seed services'
    }

    // Check if we should use join table instead
    if (serviceCptJoin && serviceCptJoin.length > 0) {
      const joinMatches = serviceCptJoin.filter((j: any) =>
        ['99205', '99204', '90838', '99214', '99215', '90836', '90833'].includes(j.cpt_codes?.code)
      )

      report.migration_strategy.alternative_approach = {
        use_join_table: true,
        join_table_matches: joinMatches.length,
        matched_records: joinMatches.map((j: any) => ({
          service_id: j.service_id,
          service_name: j.services?.name,
          cpt_code: j.cpt_codes?.code,
          cpt_description: j.cpt_codes?.description
        }))
      }
    }

    return NextResponse.json(report, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
