/**
 * Setup Supabase Storage Bucket for ROI Documents
 * Run with: npx tsx scripts/setup-roi-storage.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupROIStorage() {
  console.log('📁 Setting up ROI documents storage bucket...\n')

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('❌ Error listing buckets:', listError.message)
      process.exit(1)
    }

    const bucketExists = buckets?.some(b => b.name === 'roi-documents')

    if (bucketExists) {
      console.log('✅ Bucket "roi-documents" already exists')
    } else {
      // Create bucket
      const { data, error: createError } = await supabase.storage.createBucket('roi-documents', {
        public: false, // Private bucket - requires authentication
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf']
      })

      if (createError) {
        console.error('❌ Error creating bucket:', createError.message)
        process.exit(1)
      }

      console.log('✅ Created bucket "roi-documents"')
    }

    // Set up RLS policies
    console.log('\n📋 Setting up Row Level Security policies...')
    console.log('\nRun the following SQL in Supabase SQL Editor:')
    console.log('=' .repeat(80))
    console.log(`
-- ROI Documents Storage Policies
-- Only authenticated partner users can access ROI documents for their organization

-- Policy 1: Partner users can upload ROI for their organization's patients
CREATE POLICY "Partner users can upload ROI documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'roi-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM partner_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  )
);

-- Policy 2: Partner users can view ROI for their organization's patients
CREATE POLICY "Partner users can view ROI documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'roi-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM partner_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  )
);

-- Policy 3: Partner users can delete ROI for their organization's patients
CREATE POLICY "Partner users can delete ROI documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'roi-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM partner_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  )
);

-- Policy 4: Partner users can update (replace) ROI for their organization's patients
CREATE POLICY "Partner users can update ROI documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'roi-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM partner_users
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  )
);
`)
    console.log('=' .repeat(80))

    console.log('\n✅ Storage setup complete!')
    console.log('\n📝 Next steps:')
    console.log('1. Copy the SQL above and run it in Supabase SQL Editor')
    console.log('2. Verify policies are created in Storage > Policies')
    console.log('3. Test ROI upload in partner dashboard')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

setupROIStorage()
