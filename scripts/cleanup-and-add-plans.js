#!/usr/bin/env node
const https = require('https');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY env vars');
  process.exit(1);
}

const deleteRequest = (table, params = '') => {
  return new Promise((resolve, reject) => {
    const url = new URL(`/rest/v1/${table}${params}`, SUPABASE_URL);
    const options = {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation,count=exact'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const count = res.headers['content-range']?.split('/')[1] || '0';
        resolve({ count: parseInt(count), statusCode: res.statusCode });
      });
    });

    req.on('error', reject);
    req.end();
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
  console.log('🧹 Cleaning up mock data and adding real SelectHealth contract plans...\n');

  // Step 1: Get payer IDs
  console.log('1️⃣  Finding payers...');
  const payers = await query('payers', '?or=(name.ilike.*regence*,name.ilike.*selecthealth*,name.ilike.*aetna*)&select=id,name');
  const payerIds = payers.map(p => p.id);
  console.log(`✅ Found ${payers.length} payers: ${payers.map(p => p.name).join(', ')}\n`);

  const selectHealth = payers.find(p => p.name.match(/selecthealth/i));
  if (!selectHealth) {
    console.error('❌ SelectHealth not found');
    process.exit(1);
  }

  // Step 2: Get plan IDs
  console.log('2️⃣  Getting plan IDs...');
  const plans = await query('payer_plans', `?payer_id=in.(${payerIds.join(',')})&select=id`);
  const planIds = plans.map(p => p.id);
  console.log(`✅ Found ${planIds.length} plans to delete\n`);

  // Step 3: Delete aliases
  if (planIds.length > 0) {
    console.log('3️⃣  Deleting plan aliases...');
    const aliasResult = await deleteRequest('payer_plan_aliases', `?plan_id=in.(${planIds.join(',')})`);
    console.log(`✅ Deleted ${aliasResult.count} aliases\n`);
  }

  // Step 4: Delete plans
  console.log('4️⃣  Deleting mock plans...');
  const planResult = await deleteRequest('payer_plans', `?payer_id=in.(${payerIds.join(',')})`);
  console.log(`✅ Deleted ${planResult.count} plans\n`);

  // Step 5: Delete networks
  console.log('5️⃣  Deleting mock networks...');
  const networkResult = await deleteRequest('payer_networks', `?payer_id=in.(${payerIds.join(',')})`);
  console.log(`✅ Deleted ${networkResult.count} networks\n`);

  // Step 6: Insert real SelectHealth plans
  console.log('6️⃣  Inserting real SelectHealth contract plans...');

  const contractPlans = [
    { plan_name: 'Select Choice', plan_type: 'PPO', is_default: true, notes: 'From Dr. Privratsky contract, pages 23-24' },
    { plan_name: 'Select Care', plan_type: 'PPO', is_default: false, notes: 'From Dr. Privratsky contract, pages 25-26' },
    { plan_name: 'Select Med', plan_type: 'PPO', is_default: false, notes: 'From Dr. Privratsky contract, pages 27-28' },
    { plan_name: 'Select Value', plan_type: 'HMO', is_default: false, notes: 'From Dr. Privratsky contract, page 29' },
    { plan_name: 'SelectHealth Share', plan_type: 'PPO', is_default: false, notes: 'From Dr. Privratsky contract, pages 30-31' },
    { plan_name: 'Select Access', plan_type: 'OTHER', is_default: false, notes: 'From Dr. Privratsky contract, pages 32-36. Medicaid/CHIP product.' }
  ];

  const plansToInsert = contractPlans.map(p => ({
    payer_id: selectHealth.id,
    ...p,
    is_active: true,
    effective_date: '2025-10-13'
  }));

  const inserted = await insertRequest('payer_plans', plansToInsert);
  console.log(`✅ Inserted ${inserted.length} plans\n`);

  inserted.forEach((p, idx) => {
    console.log(`   ${idx + 1}. ${p.plan_name} (${p.plan_type})${p.is_default ? ' [DEFAULT]' : ''}`);
  });

  console.log('\n✅ Cleanup and insertion complete!');
  console.log('\nRun node scripts/check-selecthealth-db.js to verify');
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
