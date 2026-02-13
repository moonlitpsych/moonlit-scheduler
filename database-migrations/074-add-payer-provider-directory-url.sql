-- Migration 074: Add provider_directory_url to payers table
--
-- Purpose: Store links to each payer's official provider directory
-- so staff can search for additional providers beyond our curated list.

ALTER TABLE payers ADD COLUMN IF NOT EXISTS provider_directory_url TEXT;

COMMENT ON COLUMN payers.provider_directory_url IS
  'URL to the payer official provider directory/find-a-doctor tool';

-- Seed provider directory URLs for major payers
UPDATE payers SET provider_directory_url = 'https://selecthealth.org/find-a-doctor'
WHERE name = 'SelectHealth' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://selecthealth.org/find-a-doctor'
WHERE name = 'SelectHealth Integrated' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://www.regence.com/member/find-a-doctor'
WHERE name = 'Regence BlueCross BlueShield' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://www.aetna.com/dsepublic/'
WHERE name = 'Aetna' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://hcpdirectory.cigna.com/'
WHERE name = 'Cigna' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://www.uhc.com/find-a-doctor'
WHERE name = 'United Healthcare' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://www.molinahealthcare.com/members/ut/en-us/mem/medicaid/overvw/findprov.aspx'
WHERE name = 'Molina Utah' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://healthchoiceutah.com/find-a-provider/'
WHERE name = 'Health Choice Utah' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://findprovider.motivhealth.com/'
WHERE name = 'MotivHealth' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://providerlocator.firsthealth.com/'
WHERE name LIKE 'First Health Network%' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://www.dmba.com/nsc/provider'
WHERE name = 'DMBA' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://www.tricare-west.com/content/hnfs/home/tw/find-a-provider.html'
WHERE name = 'TRICARE West' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://healthcare.utah.edu/hmhi'
WHERE name = 'HMHI BHN' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://www.optumhealthslco.com/'
WHERE name LIKE 'Optum Salt Lake%' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://provider.optum.com/'
WHERE name = 'Optum Commercial Behavioral Health' AND provider_directory_url IS NULL;

UPDATE payers SET provider_directory_url = 'https://uhealthplan.utah.edu/find-a-doctor/'
WHERE name LIKE '%University of Utah Health Plans%' OR name LIKE '%HealthyU%' AND provider_directory_url IS NULL;
