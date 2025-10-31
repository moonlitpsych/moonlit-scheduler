#!/usr/bin/env node
const https = require('https');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
  console.log('📊 Current Payers in Database:\n');

  const payers = await query('payers', '?select=id,name&order=name');

  console.log(`Total payers: ${payers.length}\n`);

  payers.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.name} (ID: ${p.id})`);
  });

  console.log('\n---\n');

  // Check which payers have contracts
  console.log('📋 Payers with Provider Contracts:\n');

  const contracts = await query('provider_payer_networks', '?select=payer_id,status,effective_date,payers(name)');

  const payersWithContracts = {};
  contracts.forEach(c => {
    if (c.payers) {
      const payerName = c.payers.name;
      if (!payersWithContracts[payerName]) {
        payersWithContracts[payerName] = [];
      }
      payersWithContracts[payerName].push(c);
    }
  });

  Object.keys(payersWithContracts).sort().forEach((payerName, idx) => {
    const contracts = payersWithContracts[payerName];
    console.log(`${idx + 1}. ${payerName} - ${contracts.length} contract(s)`);
    contracts.forEach(c => {
      console.log(`   Status: ${c.status}, Effective: ${c.effective_date || 'N/A'}`);
    });
  });

  console.log('\n---\n');

  // Check which payers have plans
  console.log('📦 Payers with Plans Defined:\n');

  const plans = await query('payer_plans', '?select=payer_id,plan_name,payers(name)');

  const payersWithPlans = {};
  plans.forEach(p => {
    if (p.payers) {
      const payerName = p.payers.name;
      if (!payersWithPlans[payerName]) {
        payersWithPlans[payerName] = [];
      }
      payersWithPlans[payerName].push(p.plan_name);
    }
  });

  Object.keys(payersWithPlans).sort().forEach((payerName, idx) => {
    console.log(`${idx + 1}. ${payerName} - ${payersWithPlans[payerName].length} plan(s)`);
    payersWithPlans[payerName].forEach(plan => {
      console.log(`   - ${plan}`);
    });
  });

})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
