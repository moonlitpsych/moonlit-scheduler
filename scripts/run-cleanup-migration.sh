#!/bin/bash

# Moonlit Scheduler - Safe Database Cleanup Execution
# Date: 2025-10-31
# Purpose: Execute payer cleanup migration with safety checks

set -e  # Exit on error

echo "🔧 Moonlit Scheduler - Payer Database Cleanup"
echo "=============================================="
echo ""

# Check for required environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not set"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_KEY not set"
  exit 1
fi

echo "📊 Current state:"
echo ""
node scripts/check-payers-status.js | head -20
echo ""

# Ask for confirmation
echo "⚠️  WARNING: This will delete 8 duplicate payers from the database."
echo ""
echo "Duplicates to be deleted:"
echo "  - TriCare West (typo)"
echo "  - TriWest (admin name)"
echo "  - ACH pay #2"
echo "  - Cash pay #2"
echo "  - Credit card pay #2"
echo "  - SelectHealth Care (plan name, not payer)"
echo "  - SelectHealth Med (plan name, not payer)"
echo "  - SelectHealth Value (plan name, not payer)"
echo ""
echo "Expected result: 37 payers → 29 payers"
echo ""

read -p "Do you want to proceed? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Aborted by user"
  exit 0
fi

echo ""
echo "🚀 Executing migration..."
echo ""

# Execute migration using psql via supabase CLI
# This assumes you have supabase CLI installed and configured
if command -v supabase &> /dev/null; then
  # Use Supabase CLI
  echo "Using Supabase CLI..."
  cat database-migrations/034-cleanup-duplicate-payers.sql | supabase db execute
else
  # Use direct psql connection (requires DATABASE_URL)
  echo "Using direct PostgreSQL connection..."

  if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: Neither supabase CLI nor DATABASE_URL is available"
    echo "Please set DATABASE_URL or install Supabase CLI"
    exit 1
  fi

  psql "$DATABASE_URL" < database-migrations/034-cleanup-duplicate-payers.sql
fi

echo ""
echo "✅ Migration completed!"
echo ""
echo "📊 Final state:"
echo ""
node scripts/check-payers-status.js | head -20
echo ""

echo "✅ Cleanup complete! Verify the results above."
echo ""
echo "Next steps:"
echo "1. Review the payer count (should be 29)"
echo "2. Verify contracts still exist (should be 14 payers with contracts)"
echo "3. Test booking flow with TRICARE West and SelectHealth"
