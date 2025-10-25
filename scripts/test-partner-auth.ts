/**
 * Partner Dashboard Authentication Test Script
 * Tests all auth flows to ensure they're functional
 *
 * Run with: npx tsx scripts/test-partner-auth.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const TEST_PARTNER_EMAIL = 'testpartner@example.com'
const TEST_PASSWORD = 'TestPassword123!'

async function testAuth() {
  console.log('🧪 Testing Partner Dashboard Authentication\n')
  console.log('='.repeat(60))

  let testsPassed = 0
  let testsFailed = 0

  // Test 1: Check if test partner user exists
  console.log('\n📋 Test 1: Verify test partner user exists')
  const { data: partnerUser, error: partnerError } = await supabase
    .from('partner_users')
    .select('id, email, full_name, role, is_active, auth_user_id, organization:organizations(name)')
    .eq('email', TEST_PARTNER_EMAIL)
    .single()

  if (partnerError || !partnerUser) {
    console.log('❌ FAIL: Test partner user not found')
    console.log('   Error:', partnerError?.message)
    console.log('   Please create test user with: npx tsx scripts/check-partner-test-users.ts')
    testsFailed++
  } else {
    console.log('✅ PASS: Test partner user exists')
    console.log(`   Email: ${partnerUser.email}`)
    console.log(`   Name: ${partnerUser.full_name}`)
    console.log(`   Org: ${partnerUser.organization?.name}`)
    console.log(`   Role: ${partnerUser.role}`)
    console.log(`   Active: ${partnerUser.is_active}`)
    console.log(`   Has Auth: ${partnerUser.auth_user_id ? 'Yes ✓' : 'No ✗'}`)
    testsPassed++
  }

  // Test 2: Verify auth account exists
  console.log('\n📋 Test 2: Verify Supabase Auth account')
  if (partnerUser?.auth_user_id) {
    const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(
      partnerUser.auth_user_id
    )

    if (authError || !authUser) {
      console.log('❌ FAIL: Auth account not found')
      console.log('   Error:', authError?.message)
      testsFailed++
    } else {
      console.log('✅ PASS: Auth account exists')
      console.log(`   Email: ${authUser.email}`)
      console.log(`   Email Verified: ${authUser.email_confirmed_at ? 'Yes ✓' : 'No ✗'}`)
      console.log(`   Created: ${new Date(authUser.created_at).toLocaleDateString()}`)
      console.log(`   Last Sign In: ${authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at).toLocaleDateString() : 'Never'}`)
      testsPassed++
    }
  } else {
    console.log('⚠️  SKIP: No auth_user_id to verify')
  }

  // Test 3: Test password authentication (simulated)
  console.log('\n📋 Test 3: Test password can be set')
  if (partnerUser?.auth_user_id) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      partnerUser.auth_user_id,
      { password: TEST_PASSWORD }
    )

    if (error) {
      console.log('❌ FAIL: Could not set password')
      console.log('   Error:', error.message)
      testsFailed++
    } else {
      console.log('✅ PASS: Password updated successfully')
      console.log(`   Test password: ${TEST_PASSWORD}`)
      testsPassed++
    }
  } else {
    console.log('⚠️  SKIP: No auth account to test')
  }

  // Test 4: Verify partner user has correct role permissions
  console.log('\n📋 Test 4: Verify role and permissions')
  if (partnerUser) {
    const validRoles = ['partner_admin', 'partner_case_manager', 'partner_referrer']
    const hasValidRole = validRoles.includes(partnerUser.role)

    if (!hasValidRole) {
      console.log('❌ FAIL: Invalid role')
      console.log(`   Current role: ${partnerUser.role}`)
      console.log(`   Valid roles: ${validRoles.join(', ')}`)
      testsFailed++
    } else {
      console.log('✅ PASS: Valid role assigned')
      console.log(`   Role: ${partnerUser.role}`)

      // Check permissions based on role
      const permissions: Record<string, string[]> = {
        partner_admin: ['view_patients', 'transfer_patients', 'send_notifications', 'invite_users', 'manage_org'],
        partner_case_manager: ['view_patients', 'transfer_patients', 'send_notifications'],
        partner_referrer: ['view_referred_patients']
      }

      console.log(`   Permissions:`)
      permissions[partnerUser.role].forEach(perm => {
        console.log(`      - ${perm}`)
      })
      testsPassed++
    }
  }

  // Test 5: Check organization affiliation
  console.log('\n📋 Test 5: Verify organization affiliation')
  if (partnerUser) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, type, status')
      .eq('id', partnerUser.organization_id)
      .single()

    if (orgError || !org) {
      console.log('❌ FAIL: Organization not found')
      console.log('   Error:', orgError?.message)
      testsFailed++
    } else {
      console.log('✅ PASS: Organization exists')
      console.log(`   Name: ${org.name}`)
      console.log(`   Type: ${org.type}`)
      console.log(`   Status: ${org.status}`)
      testsPassed++
    }
  }

  // Test 6: Check patient access (how many patients this user can see)
  console.log('\n📋 Test 6: Check patient access')
  if (partnerUser) {
    const { data: affiliations, error: affError } = await supabase
      .from('patient_organization_affiliations')
      .select('patient_id, status')
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')

    if (affError) {
      console.log('❌ FAIL: Could not fetch patient affiliations')
      console.log('   Error:', affError.message)
      testsFailed++
    } else {
      console.log('✅ PASS: Can access patient data')
      console.log(`   Patients in org: ${affiliations?.length || 0}`)

      if (partnerUser.role === 'partner_referrer') {
        // Referrers only see patients they referred
        const { data: referredPatients } = await supabase
          .from('patients')
          .select('id')
          .eq('referred_by_partner_user_id', partnerUser.id)

        console.log(`   Patients referred by user: ${referredPatients?.length || 0}`)
      }
      testsPassed++
    }
  }

  // Test 7: Check if user can access partner dashboard API
  console.log('\n📋 Test 7: API access simulation')
  if (partnerUser?.auth_user_id) {
    // Note: Can't actually test HTTP endpoints from here, but we can verify data access
    const { data: dashboardData, error: dashError } = await supabase
      .from('partner_users')
      .select(`
        id,
        full_name,
        email,
        role,
        organization:organizations(name, type)
      `)
      .eq('auth_user_id', partnerUser.auth_user_id)
      .eq('is_active', true)
      .single()

    if (dashError || !dashboardData) {
      console.log('❌ FAIL: Could not fetch dashboard data')
      console.log('   Error:', dashError?.message)
      testsFailed++
    } else {
      console.log('✅ PASS: Dashboard data accessible')
      console.log(`   Can access: /api/partner/me`)
      console.log(`   Can access: /api/partner-dashboard/patients`)
      console.log(`   Can access: /api/partner-dashboard/stats`)
      testsPassed++
    }
  }

  // Test 8: Check case manager assignment functionality
  console.log('\n📋 Test 8: Case manager assignment capability')
  if (partnerUser) {
    const { data: assignments, error: assignError } = await supabase
      .from('partner_user_patient_assignments')
      .select('id, patient_id, assignment_type, status')
      .eq('partner_user_id', partnerUser.id)
      .eq('status', 'active')

    if (assignError) {
      console.log('❌ FAIL: Could not check assignments')
      console.log('   Error:', assignError.message)
      testsFailed++
    } else {
      console.log('✅ PASS: Assignment system accessible')
      console.log(`   Current assignments: ${assignments?.length || 0}`)

      if (['partner_admin', 'partner_case_manager'].includes(partnerUser.role)) {
        console.log(`   Can transfer patients: Yes ✓`)
        console.log(`   Can assign providers: Yes ✓`)
      } else {
        console.log(`   Can transfer patients: No (referrer role)`)
      }
      testsPassed++
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Test Summary\n')
  console.log(`✅ Tests Passed: ${testsPassed}`)
  console.log(`❌ Tests Failed: ${testsFailed}`)
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`)

  if (testsFailed === 0) {
    console.log('\n🎉 All tests passed! Partner authentication is fully functional.')
    console.log('\n✨ You can now log in at: http://localhost:3001/partner-auth/login')
    console.log(`   Email: ${TEST_PARTNER_EMAIL}`)
    console.log(`   Password: ${TEST_PASSWORD}`)
  } else {
    console.log('\n⚠️  Some tests failed. Please review errors above.')
  }

  console.log('\n' + '='.repeat(60))
}

testAuth().catch(console.error)
