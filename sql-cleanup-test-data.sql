-- SQL script to cleanup test partner and organization data
-- Run this before importing actual data

-- First, let's see what test data exists
\echo 'Checking for test organizations:'
SELECT id, name, slug, status, created_at 
FROM organizations 
WHERE name ILIKE '%test%' 
   OR name ILIKE '%demo%' 
   OR name ILIKE '%sample%' 
   OR slug ILIKE '%test%' 
   OR slug ILIKE '%demo%'
   OR name ILIKE '%example%'
ORDER BY created_at DESC;

\echo 'Checking for test partner users:'
SELECT id, first_name, last_name, email, organization_id, status, created_at
FROM partner_users 
WHERE email ILIKE '%test%' 
   OR email ILIKE '%demo%' 
   OR email ILIKE '%sample%' 
   OR first_name ILIKE '%test%' 
   OR last_name ILIKE '%test%'
   OR email ILIKE '%example%'
ORDER BY created_at DESC;

\echo 'Checking for recently created organizations (potential test data):'
SELECT id, name, slug, status, created_at 
FROM organizations 
WHERE created_at >= '2025-08-20'  -- During partner dashboard development
  AND name NOT ILIKE '%psychiatry%'
  AND name NOT ILIKE '%moonlit%'
  AND name NOT ILIKE '%medical%'
  AND name NOT ILIKE '%health%'
ORDER BY created_at DESC;

-- Uncomment the following section to actually delete the test data
-- WARNING: This will permanently delete the identified test data

/*
\echo 'DELETING TEST DATA - Proceed with caution!'

-- Delete patient affiliations first (foreign key constraints)
DELETE FROM patient_affiliations 
WHERE organization_id IN (
    SELECT id FROM organizations 
    WHERE name ILIKE '%test%' 
       OR name ILIKE '%demo%' 
       OR name ILIKE '%sample%' 
       OR slug ILIKE '%test%' 
       OR slug ILIKE '%demo%'
       OR name ILIKE '%example%'
);

-- Delete partner users
DELETE FROM partner_users 
WHERE email ILIKE '%test%' 
   OR email ILIKE '%demo%' 
   OR email ILIKE '%sample%' 
   OR first_name ILIKE '%test%' 
   OR last_name ILIKE '%test%'
   OR email ILIKE '%example%';

-- Delete test organizations
DELETE FROM organizations 
WHERE name ILIKE '%test%' 
   OR name ILIKE '%demo%' 
   OR name ILIKE '%sample%' 
   OR slug ILIKE '%test%' 
   OR slug ILIKE '%demo%'
   OR name ILIKE '%example%';

-- Clean up related audit logs
DELETE FROM scheduler_audit_logs 
WHERE action LIKE '%partner%' 
  AND created_at >= '2025-08-20'
  AND (details::text ILIKE '%test%' OR details::text ILIKE '%demo%' OR details::text ILIKE '%sample%');

\echo 'Test data cleanup completed!'
*/

-- Just show counts for now
\echo 'Summary of potentially affected records:'
SELECT 
    (SELECT COUNT(*) FROM organizations WHERE name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%sample%' OR slug ILIKE '%test%' OR slug ILIKE '%demo%' OR name ILIKE '%example%') as test_organizations,
    (SELECT COUNT(*) FROM partner_users WHERE email ILIKE '%test%' OR email ILIKE '%demo%' OR email ILIKE '%sample%' OR first_name ILIKE '%test%' OR last_name ILIKE '%test%' OR email ILIKE '%example%') as test_partner_users,
    (SELECT COUNT(*) FROM patient_affiliations WHERE organization_id IN (SELECT id FROM organizations WHERE name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%sample%' OR slug ILIKE '%test%' OR slug ILIKE '%demo%' OR name ILIKE '%example%')) as test_patient_affiliations;

\echo '
To actually delete the test data:
1. Uncomment the deletion section in this file
2. Run the script again
3. Or run individual DELETE statements as needed
';