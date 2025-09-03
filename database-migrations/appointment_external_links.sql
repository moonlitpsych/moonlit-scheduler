-- Create appointment_external_links caching table for EHR video links
-- This table stores cached video links and external URLs from EHR systems

CREATE TABLE IF NOT EXISTS appointment_external_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Link to appointment
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    
    -- EHR system info
    ehr_system TEXT NOT NULL, -- 'athena', 'intakeq', etc.
    ehr_appointment_id TEXT NOT NULL, -- External appointment ID
    
    -- Link data
    link_type TEXT NOT NULL, -- 'video', 'patient_portal', 'provider_portal', etc.
    url TEXT NOT NULL,
    
    -- Video-specific fields
    patient_url TEXT,
    provider_url TEXT,
    waiting_room_url TEXT,
    session_id TEXT,
    
    -- Expiration and caching
    expires_at TIMESTAMPTZ,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    
    -- Status and metadata
    status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
    link_metadata JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID, -- Partner user or system that cached the link
    
    -- Indexes
    CONSTRAINT unique_appointment_link_type UNIQUE(appointment_id, link_type, ehr_system)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_external_links_appointment_id ON appointment_external_links(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_external_links_ehr ON appointment_external_links(ehr_system, ehr_appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_external_links_expires ON appointment_external_links(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointment_external_links_status ON appointment_external_links(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_appointment_external_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_appointment_external_links_updated_at
    BEFORE UPDATE ON appointment_external_links
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_external_links_updated_at();

-- Add access tracking function
CREATE OR REPLACE FUNCTION track_link_access(link_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE appointment_external_links 
    SET 
        access_count = access_count + 1,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE id = link_id;
END;
$$ language 'plpgsql';

-- Comment on table
COMMENT ON TABLE appointment_external_links IS 'Caches video links and external URLs from EHR systems with expiration tracking';

-- Sample usage comments
/*

-- Cache video link for IntakeQ appointment
INSERT INTO appointment_external_links (
    appointment_id,
    ehr_system, 
    ehr_appointment_id,
    link_type,
    url,
    patient_url,
    provider_url,
    session_id,
    expires_at
) VALUES (
    'appointment-uuid',
    'intakeq',
    '12345',
    'video',
    'https://intakeq.com/booking/12345/video/patient',
    'https://intakeq.com/booking/12345/video/patient',
    'https://intakeq.com/admin/appointments/12345/video',
    'intakeq_12345_1693737600',
    NOW() + INTERVAL '4 hours'
);

-- Retrieve cached video links for appointment
SELECT 
    link_type,
    url,
    patient_url,
    provider_url,
    waiting_room_url,
    session_id,
    expires_at,
    status,
    access_count
FROM appointment_external_links 
WHERE appointment_id = 'appointment-uuid' 
    AND ehr_system = 'intakeq'
    AND link_type = 'video'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND status = 'active'
ORDER BY cached_at DESC
LIMIT 1;

-- Track link access
SELECT track_link_access('link-uuid');

-- Clean up expired links (run as cron job)
DELETE FROM appointment_external_links 
WHERE expires_at < NOW() 
    AND expires_at IS NOT NULL;

*/