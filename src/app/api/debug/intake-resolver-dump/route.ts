import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const payerId = searchParams.get('payer_id');

  if (!payerId || !UUID_REGEX.test(payerId)) {
    return NextResponse.json(
      { success: false, error: 'Valid payer_id UUID required' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n📦 [intake-resolver-dump] Starting staged diagnostics for payer_id=${payerId}`);

  try {
    // S1: base_intake
    console.log('📦 S1: Querying base_intake (Intake% + Telehealth + POS 10)...');
    const { data: s1Data, error: s1Error } = await supabase
      .from('service_instances')
      .select('id, payer_id, location, pos_code, services!inner(name, duration_minutes)')
      .ilike('services.name', 'Intake%')
      .eq('location', 'Telehealth')
      .eq('pos_code', '10');

    if (s1Error) {
      console.error('❌ S1 error:', s1Error);
      return NextResponse.json(
        { success: false, error: 'S1 query failed', details: s1Error },
        { status: 500 }
      );
    }

    const s1Rows = s1Data || [];
    console.log(`📦 S1 base_intake: ${s1Rows.length} rows`);

    // S2: payer_scoped (filter in code)
    console.log('📦 S2: Filtering for payer-specific OR global (null)...');
    const payerSpecific = s1Rows.filter(r => r.payer_id === payerId);
    const globalNull = s1Rows.filter(r => r.payer_id === null);
    const s2Rows = [...payerSpecific, ...globalNull];

    console.log(`📦 S2 payer_scoped: ${s2Rows.length} total (${payerSpecific.length} payer-specific, ${globalNull.length} global-null)`);

    // S3: with_mapping (query integrations separately, intersect in code)
    console.log('📦 S3: Querying service_instance_integrations...');
    const { data: integrationsData, error: intError } = await supabase
      .from('service_instance_integrations')
      .select('service_instance_id, system, external_id')
      .in('system', ['intakeq', 'practiceq'])
      .not('external_id', 'is', null);

    if (intError) {
      console.error('❌ S3 integrations error:', intError);
      return NextResponse.json(
        { success: false, error: 'S3 integrations query failed', details: intError },
        { status: 500 }
      );
    }

    const mappedIds = new Set((integrationsData || []).map(i => i.service_instance_id));
    console.log(`📦 S3 mapped IDs: ${mappedIds.size} service instances have integrations`);

    const s3Rows = s2Rows.filter(r => mappedIds.has(r.id));
    console.log(`📦 S3 with_mapping: ${s3Rows.length} rows after intersection`);

    // S4: pick (prefer payer-specific over global)
    let picked = null;
    if (s3Rows.length > 0) {
      const candidate = s3Rows.find(r => r.payer_id === payerId) || s3Rows[0];
      picked = {
        id: candidate.id,
        payer_id: candidate.payer_id,
        location: candidate.location,
        pos_code: candidate.pos_code,
        service_name: (candidate.services as any).name,
        duration_minutes: (candidate.services as any).duration_minutes
      };
      console.log(`📦 S4 picked:`, picked);
    } else {
      console.log('📦 S4 picked: NONE (no mapped instances)');
    }

    // Format samples (max 10 each)
    const formatRow = (r: any) => ({
      id: r.id,
      payer_id: r.payer_id,
      location: r.location,
      pos_code: r.pos_code,
      service_name: (r.services as any)?.name,
      duration_minutes: (r.services as any)?.duration_minutes
    });

    return NextResponse.json({
      success: true,
      payer_id: payerId,
      counts: {
        base_intake: s1Rows.length,
        payer_scoped: s2Rows.length,
        payer_specific: payerSpecific.length,
        global_null: globalNull.length,
        with_mapping: s3Rows.length
      },
      samples: {
        base_intake: s1Rows.slice(0, 10).map(formatRow),
        payer_scoped: {
          payer_specific: payerSpecific.slice(0, 10).map(formatRow),
          global_null: globalNull.slice(0, 10).map(formatRow)
        },
        with_mapping: s3Rows.slice(0, 10).map(formatRow)
      },
      picked
    });

  } catch (err: any) {
    console.error('❌ [intake-resolver-dump] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
