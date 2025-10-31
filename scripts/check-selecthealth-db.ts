#!/usr/bin/env node

// Quick script to check SelectHealth data in database
// Usage: node scripts/check-selecthealth-db.ts

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

(async () => {
  console.log('🔍 Checking SelectHealth data in database...\n');

  // Check payers
  const payers = await query('payers', '?name=ilike.*select*health*&select=id,name');
  console.log('1️⃣ SelectHealth Payer:');
  if (payers.length === 0) {
    console.log('   ❌ No SelectHealth payer found!');
    process.exit(1);
  }
  console.log(`   ✅ ${payers[0].name} (${payers[0].id})\n`);

  const payerId = payers[0].id;

  // Check networks
  const networks = await query('payer_networks', `?payer_id=eq.${payerId}&select=id,network_name,network_code`);
  console.log('2️⃣ SelectHealth Networks:');
  if (networks.length === 0) {
    console.log('   ⚠️ No networks found');
  } else {
    networks.forEach(n => console.log(`   - ${n.network_name} (${n.network_code})`));
  }
  console.log();

  // Check plans
  const plans = await query('payer_plans', `?payer_id=eq.${payerId}&select=id,plan_name,plan_type,is_default&order=plan_name`);
  console.log('3️⃣ SelectHealth Plans:');
  if (plans.length === 0) {
    console.log('   ⚠️ No plans found');
  } else {
    plans.forEach(p => console.log(`   - ${p.plan_name} (${p.plan_type})${p.is_default ? ' [DEFAULT]' : ''}`));
  }
  console.log();

  // Check providers
  const providers = await query('providers', '?last_name=ilike.*privratsky*&select=id,first_name,last_name');
  if (providers.length > 0) {
    const provider = providers[0];
    console.log(`4️⃣ Dr. ${provider.first_name} ${provider.last_name}:`);

    // Check contract
    const contracts = await query('provider_payer_networks', `?provider_id=eq.${provider.id}&payer_id=eq.${payerId}&select=id,status,effective_date`);
    if (contracts.length === 0) {
      console.log('   ❌ No SelectHealth contract found');
    } else {
      console.log(`   ✅ Contract: ${contracts[0].id} (${contracts[0].status})`);

      // Check junction table
      const accepted = await query('provider_payer_accepted_plans', `?provider_payer_network_id=eq.${contracts[0].id}&select=id,plan_id`);
      console.log(`   📋 Accepted plans: ${accepted.length}`);
    }
  }

  console.log('\n✅ Database check complete');
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
