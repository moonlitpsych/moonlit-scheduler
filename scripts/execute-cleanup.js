#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY env vars');
  process.exit(1);
}

// Read the SQL migration file
const sqlFile = 'database-migrations/034-cleanup-duplicate-payers.sql';
const sql = fs.readFileSync(sqlFile, 'utf-8');

console.log('🚀 Executing payer cleanup migration...\n');
console.log('📄 Migration file:', sqlFile);
console.log('📊 Expected: 37 payers → 29 payers (delete 8 duplicates)\n');

// Execute SQL via Supabase REST API
const executeSQL = (sqlQuery) => {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);
    const body = JSON.stringify({ query: sqlQuery });

    const options = {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

(async () => {
  try {
    console.log('⏳ Executing SQL migration...\n');
    const result = await executeSQL(sql);
    console.log('✅ Migration executed successfully!\n');

    // Now verify the results
    console.log('📊 Verifying results...\n');
    const { query } = require('./check-payers-status.js');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nThis is likely because the Supabase REST API doesn\'t support raw SQL execution.');
    console.error('Please execute the migration via Supabase Dashboard SQL Editor instead.\n');
    console.error('Steps:');
    console.error('1. Open https://supabase.com/dashboard → Your Project → SQL Editor');
    console.error('2. Copy the contents of: database-migrations/034-cleanup-duplicate-payers.sql');
    console.error('3. Paste and click "Run"');
    console.error('4. Verify results by running: node scripts/check-payers-status.js');
    process.exit(1);
  }
})();
