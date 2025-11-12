/**
 * Direct Migration Runner
 * Shows instructions for running migrations
 */

require('dotenv').config({ path: '.env.local' });

// Parse Supabase URL to get connection info
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project ref from:', SUPABASE_URL);
  process.exit(1);
}

console.log('='.repeat(80));
console.log('🚀 Database Migration Runner (Direct SQL)');
console.log('   Feature: /book-now Hybrid Booking Flow');
console.log('   Project:', projectRef);
console.log('='.repeat(80));
console.log('');
console.log('⚠️  This script requires direct database access.');
console.log('');
console.log('📝 Please run the migrations manually using one of these methods:');
console.log('');
console.log('---');
console.log('Option 1: Supabase SQL Editor (Recommended)');
console.log('---');
console.log('1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
console.log('2. Copy/paste contents of: database-migrations/066-add-intakeq-location-to-payers.sql');
console.log('3. Click "Run"');
console.log('4. Verify success message');
console.log('5. Create new query');
console.log('6. Copy/paste contents of: database-migrations/067-seed-intakeq-locations.sql');
console.log('7. Click "Run"');
console.log('8. Verify 16 payers updated');
console.log('');
console.log('---');
console.log('Option 2: psql Command Line');
console.log('---');
console.log('If you have psql installed and database credentials:');
console.log('');
console.log('  psql "postgresql://postgres:[password]@db.' + projectRef + '.supabase.co:5432/postgres" \\');
console.log('    -f database-migrations/066-add-intakeq-location-to-payers.sql');
console.log('');
console.log('  psql "postgresql://postgres:[password]@db.' + projectRef + '.supabase.co:5432/postgres" \\');
console.log('    -f database-migrations/067-seed-intakeq-locations.sql');
console.log('');
console.log('---');
console.log('After Running Migrations:');
console.log('---');
console.log('Verify with this query in SQL Editor:');
console.log('');
console.log('  SELECT name, state, intakeq_location_id');
console.log('  FROM payers');
console.log('  WHERE intakeq_location_id IS NOT NULL');
console.log('  ORDER BY name;');
console.log('');
console.log('Expected: 16 rows returned');
console.log('='.repeat(80));
