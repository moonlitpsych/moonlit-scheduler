#!/usr/bin/env node
const https = require('https');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY env vars');
  process.exit(1);
}

const query = async (table, params = '') => {
  return new Promise((resolve, reject) => {
    const url = new URL(`/rest/v1/${table}${params}`, SUPABASE_URL);
    const options = {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on('error', reject);
  });
};

// Duplicate IDs to check
const DUPLICATES = {
  tricare: {
    name: 'TRICARE',
    toDelete: [
      { id: '0ff47595-9927-44f6-9d18-d2e779c802a7', name: 'TriCare West' },
      { id: '08fcf2d8-8f4a-48ed-af1b-f29842b1dbdb', name: 'TriWest' }
    ],
    toKeep: { id: '677e91d3-d6a9-4f72-b8ee-e9b673d2ccfc', name: 'TRICARE West' }
  },
  payments: {
    name: 'Payment Types',
    toDelete: [
      { id: '8c22d4d0-54a9-498c-be2d-79c2213b83a2', name: 'ACH pay #2' },
      { id: 'e8e573ef-f66c-4392-a4d4-309376d25d3d', name: 'Cash pay #2' },
      { id: '637f0593-b609-4415-8e49-bb0915fe0f19', name: 'Credit card pay #2' }
    ],
    toKeep: [
      { id: '0a71c8bb-8520-415f-91c7-e265d4e7336f', name: 'ACH pay' },
      { id: '6317e5c7-e3fb-48ed-a394-db7a8b94b206', name: 'Cash pay' },
      { id: '3d655839-33b3-49d0-8df2-780a13430dcb', name: 'Credit card pay' }
    ]
  },
  selecthealth: {
    name: 'SelectHealth',
    toDelete: [
      { id: '9b0c0548-4f03-4173-b893-c18d473f8f03', name: 'SelectHealth Care' },
      { id: '5f5c8b81-c34b-4454-9cc6-f57abf968a8e', name: 'SelectHealth Med' },
      { id: 'e964aa50-8b7a-4780-a570-8a035eebd415', name: 'SelectHealth Value' }
    ],
    toKeep: { id: 'd37d3938-b48d-4bdf-b500-bf5413157ef4', name: 'SelectHealth Integrated' }
  }
};

const checkTable = async (tableName, column, ids) => {
  const idList = ids.map(id => `"${id}"`).join(',');
  try {
    const results = await query(tableName, `?${column}=in.(${idList})&select=*`);
    return results;
  } catch (error) {
    console.error(`   ⚠️ Error checking ${tableName}:`, error.message);
    return [];
  }
};

(async () => {
  console.log('🔍 Verifying Duplicate Payer Usage\n');
  console.log('This script checks if any duplicate payers are referenced in other tables.\n');
  console.log('=' .repeat(80));

  for (const [category, data] of Object.entries(DUPLICATES)) {
    console.log(`\n## ${data.name.toUpperCase()} DUPLICATES\n`);

    const idsToDelete = data.toDelete.map(d => d.id);

    console.log('📋 Payers to DELETE:');
    data.toDelete.forEach(d => {
      console.log(`   - ${d.name} (${d.id})`);
    });

    console.log('\n✅ Payer(s) to KEEP:');
    if (Array.isArray(data.toKeep)) {
      data.toKeep.forEach(k => {
        console.log(`   - ${k.name} (${k.id})`);
      });
    } else {
      console.log(`   - ${data.toKeep.name} (${data.toKeep.id})`);
    }

    console.log('\n🔎 Checking for references...\n');

    // Check provider_payer_networks (contracts)
    const contracts = await checkTable('provider_payer_networks', 'payer_id', idsToDelete);
    if (contracts.length > 0) {
      console.log(`   ⚠️  provider_payer_networks: ${contracts.length} contract(s) found`);
      contracts.forEach(c => {
        console.log(`      - Contract ID: ${c.id}, Provider: ${c.provider_id}, Status: ${c.status}`);
      });
    } else {
      console.log(`   ✅ provider_payer_networks: No contracts`);
    }

    // Check payer_plans
    const plans = await checkTable('payer_plans', 'payer_id', idsToDelete);
    if (plans.length > 0) {
      console.log(`   ⚠️  payer_plans: ${plans.length} plan(s) found`);
      plans.forEach(p => {
        console.log(`      - Plan: ${p.plan_name} (${p.id})`);
      });
    } else {
      console.log(`   ✅ payer_plans: No plans`);
    }

    // Check provider_payer_accepted_plans (junction table)
    // This is trickier - need to check if plan_id references a plan with duplicate payer_id
    try {
      const junctionQuery = await query(
        'provider_payer_accepted_plans',
        `?select=id,plan_id,payer_plans(payer_id,plan_name)`
      );
      const junctionMatches = junctionQuery.filter(j =>
        j.payer_plans && idsToDelete.includes(j.payer_plans.payer_id)
      );
      if (junctionMatches.length > 0) {
        console.log(`   ⚠️  provider_payer_accepted_plans: ${junctionMatches.length} junction(s) found`);
        junctionMatches.forEach(j => {
          console.log(`      - Junction ID: ${j.id}, Plan: ${j.payer_plans?.plan_name}`);
        });
      } else {
        console.log(`   ✅ provider_payer_accepted_plans: No junctions`);
      }
    } catch (error) {
      console.log(`   ⚠️  provider_payer_accepted_plans: Error checking (${error.message})`);
    }

    // Summary
    const totalReferences = contracts.length + plans.length;
    if (totalReferences > 0) {
      console.log(`\n   ⚠️  TOTAL REFERENCES: ${totalReferences} - Will need to reassign before deletion`);
    } else {
      console.log(`\n   ✅ SAFE TO DELETE: No references found`);
    }

    console.log('\n' + '-'.repeat(80));
  }

  console.log('\n\n📊 SUMMARY\n');

  // Calculate totals
  const allIdsToDelete = [
    ...DUPLICATES.tricare.toDelete.map(d => d.id),
    ...DUPLICATES.payments.toDelete.map(d => d.id),
    ...DUPLICATES.selecthealth.toDelete.map(d => d.id)
  ];

  console.log(`Total payers to delete: ${allIdsToDelete.length}`);
  console.log(`Current payer count: 37`);
  console.log(`Expected after cleanup: ${37 - allIdsToDelete.length}`);

  console.log('\n✅ Verification complete!');
  console.log('\nNext steps:');
  console.log('1. Review output above');
  console.log('2. If contracts found on duplicates, they will be reassigned');
  console.log('3. Run migration: database-migrations/034-cleanup-duplicate-payers.sql');

})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
