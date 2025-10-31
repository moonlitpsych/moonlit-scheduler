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

const insertRequest = (table, body) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
    const bodyStr = JSON.stringify(body);
    const options = {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
};

(async () => {
  console.log('🔗 Populating provider_payer_accepted_plans junction table...\n');

  // Step 1: Find SelectHealth payer
  console.log('1️⃣  Finding SelectHealth payer...');
  const payers = await query('payers', '?name=ilike.*selecthealth*&select=id,name');
  const selectHealth = payers[0];
  if (!selectHealth) {
    console.error('❌ SelectHealth not found');
    process.exit(1);
  }
  console.log(`✅ Found ${selectHealth.name} (${selectHealth.id})\n`);

  // Step 2: Find Dr. Privratsky
  console.log('2️⃣  Finding Dr. Privratsky...');
  const providers = await query('providers', '?last_name=ilike.*privratsky*&select=id,first_name,last_name');
  const privratsky = providers[0];
  if (!privratsky) {
    console.error('❌ Dr. Privratsky not found');
    process.exit(1);
  }
  console.log(`✅ Found Dr. ${privratsky.first_name} ${privratsky.last_name} (${privratsky.id})\n`);

  // Step 3: Find Dr. Privratsky's SelectHealth contract
  console.log('3️⃣  Finding SelectHealth contract...');
  const contracts = await query('provider_payer_networks', `?provider_id=eq.${privratsky.id}&payer_id=eq.${selectHealth.id}&select=id,status,effective_date`);
  const contract = contracts[0];
  if (!contract) {
    console.error('❌ No SelectHealth contract found for Dr. Privratsky');
    process.exit(1);
  }
  console.log(`✅ Found contract: ${contract.id} (${contract.status})\n`);

  // Step 4: Get all SelectHealth plans
  console.log('4️⃣  Getting SelectHealth contract plans...');
  const plans = await query('payer_plans', `?payer_id=eq.${selectHealth.id}&select=id,plan_name,plan_type&order=plan_name`);
  console.log(`✅ Found ${plans.length} SelectHealth plans:\n`);
  plans.forEach((p, idx) => {
    console.log(`   ${idx + 1}. ${p.plan_name} (${p.plan_type})`);
  });

  // Step 5: Check for existing junction table entries
  console.log('\n5️⃣  Checking for existing entries...');
  const existing = await query('provider_payer_accepted_plans', `?provider_payer_network_id=eq.${contract.id}&select=id,plan_id`);
  console.log(`   Found ${existing.length} existing entries`);

  if (existing.length > 0) {
    console.log('\n⚠️  Junction table already has entries for this contract');
    console.log('   This script will add the 6 contract plans anyway (duplicates will fail)');
  }

  // Step 6: Create junction table entries
  console.log('\n6️⃣  Creating junction table entries...');
  const junctionEntries = plans.map(plan => ({
    provider_payer_network_id: contract.id,
    plan_id: plan.id
  }));

  const inserted = await insertRequest('provider_payer_accepted_plans', junctionEntries);
  console.log(`✅ Inserted ${inserted.length} entries\n`);

  inserted.forEach((entry, idx) => {
    const plan = plans.find(p => p.id === entry.plan_id);
    console.log(`   ${idx + 1}. Contract → ${plan.plan_name}`);
  });

  console.log('\n✅ Junction table population complete!');
  console.log(`\nDr. Privratsky's SelectHealth contract now accepts all ${inserted.length} contract plans`);
  console.log('\nRun node scripts/check-selecthealth-db.ts to verify');
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
