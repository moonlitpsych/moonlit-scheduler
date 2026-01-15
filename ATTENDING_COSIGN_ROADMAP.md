# Attending Co-Signature Workflow: Technical Roadmap

**Document Version:** 1.0  
**Date:** January 15, 2026  
**Status:** Implementation Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [Architecture Overview](#3-architecture-overview)
4. [Data Model](#4-data-model)
5. [Webhook Implementation](#5-webhook-implementation)
6. [Dashboard UI](#6-dashboard-ui)
7. [API Routes](#7-api-routes)
8. [Edge Cases & Safeguards](#8-edge-cases--safeguards)
9. [Implementation Phases](#9-implementation-phases)
10. [Testing Plan](#10-testing-plan)
11. [Appendix: API Documentation](#appendix-api-documentation)

---

## 1. Executive Summary

### The Problem

Moonlit Psychiatry employs psychiatry residents who see patients under attending supervision using the "incident-to" billing model (42 CFR 410.26(b)(5)). For payers that require attending co-signatures, the current workflow is manual and error-prone:

- Resident completes a note in IntakeQ
- Attending must remember to check for unsigned notes
- No filtering by payer (some payers require co-sign, others don't)
- No central queue to track pending signatures

### The Solution

Build a **payer-aware co-signature queue** that:

1. Automatically detects when a resident locks a note
2. Checks if the patient's payer requires attending co-signature
3. Adds qualifying notes to a dashboard queue for the attending
4. Marks notes as signed when the attending co-signs in IntakeQ

### Key Design Decision

We build a **queue/filtering layer on top of IntakeQ's native signing workflow**—not a replacement. The attending will:

1. View the filtered queue in the moonlit-scheduler dashboard
2. Click to open the note in IntakeQ's native UI
3. Review, add attestation signature, and re-lock in IntakeQ

This approach keeps the legal attestation in the EHR (where it belongs) while solving the discovery/filtering problem.

---

## 2. Business Context

### Payer Requirements

| Payer | Co-Signature Required | Notes |
|-------|----------------------|-------|
| Utah Medicaid | ✅ Yes | Always requires attending supervision |
| HMHI-BHN | ✅ Yes | University of Utah employee plan |
| SelectHealth | ✅ Yes | Both Medicaid & Commercial products |
| DMBA | ✅ Yes | LDS Church employee plan |
| Self-Pay | ❌ No (future) | When residents are credentialed |

### Current State

- IntakeQ's native supervisor workflow exists but lacks payer-based filtering
- All notes go to a single queue regardless of whether co-sign is needed
- Attending wastes time reviewing notes that don't require co-signature

### Target State

- Only notes requiring co-signature appear in the attending's queue
- Queue is filterable by payer, date, resident
- Clear status tracking: Pending → Signed
- Direct link to IntakeQ for signing

---

## 3. Architecture Overview

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  INTAKEQ                                │  MOONLIT-SCHEDULER                     │
├────────────────────────────────────────┼─────────────────────────────────────────┤
│                                        │                                         │
│  1. Resident completes note            │                                         │
│  2. Resident clicks "Lock"             │                                         │
│       │                                │                                         │
│       ▼                                │                                         │
│  3. "Note Locked" webhook fires ───────────────▶ 4. Webhook received             │
│     (fires for ALL note locks)         │            │                            │
│                                        │            ▼                            │
│                                        │    5. Fetch full note                   │
│     ◀──────────────────────────────────────────  GET /notes/{id}                 │
│  Returns: { AppointmentId, ... }       │            │                            │
│                                        │            ▼                            │
│                                        │    6. Fetch appointment                 │
│     ◀──────────────────────────────────────────  GET /appointments/{id}          │
│  Returns: { LocationName, ... }        │            │                            │
│                                        │            ▼                            │
│                                        │    7. Lookup payer table:               │
│                                        │       "Does this payer                  │
│                                        │        require co-sign?"                │
│                                        │            │                            │
│                                        │      ┌─────┴─────┐                      │
│                                        │      NO          YES                    │
│                                        │      │           │                      │
│                                        │    Ignore    8. Add to                  │
│                                        │              cosign_queue               │
│                                        │                                         │
│                                        ├─────────────────────────────────────────┤
│                                        │  ATTENDING DASHBOARD                    │
│                                        │                                         │
│                                        │  9. Attending views pending queue       │
│                                        │  10. Clicks note → Opens IntakeQ        │
│                                        │                                         │
├────────────────────────────────────────┤                                         │
│                                        │                                         │
│  11. Attending opens note in IntakeQ   │                                         │
│  12. Clicks "Unlock"                   │                                         │
│  13. Adds signature/attestation        │                                         │
│  14. Clicks "Lock"                     │                                         │
│       │                                │                                         │
│       ▼                                │                                         │
│  15. "Note Locked" webhook fires ──────────────▶ 16. Webhook received            │
│      (same webhook as step 3!)         │             │                           │
│                                        │             ▼                           │
│                                        │     17. Check: Is note_id              │
│                                        │         already in queue?              │
│                                        │             │                           │
│                                        │       ┌─────┴─────┐                     │
│                                        │       NO          YES                   │
│                                        │       │           │                     │
│                                        │    (First lock,  (Re-lock,             │
│                                        │     follow       mark as               │
│                                        │     steps 5-8)   SIGNED)               │
│                                        │                                         │
└────────────────────────────────────────┴─────────────────────────────────────────┘
```

### Key Insight: Webhook Dual-Purpose

IntakeQ's "Note Locked" webhook fires **every time** a note is locked—not just the first time. This allows us to use the same webhook for both:

1. **First lock (by resident):** Add to queue if payer requires co-sign
2. **Re-lock (by attending):** Mark as signed if note is already in queue

---

## 4. Data Model

### Supabase Schema

```sql
-- =====================================================
-- PAYER CO-SIGN REQUIREMENTS TABLE
-- =====================================================
-- Maps IntakeQ location names to co-sign requirements
-- Note: In IntakeQ, Location = Payer (by Moonlit configuration)

CREATE TABLE IF NOT EXISTS payer_cosign_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- IntakeQ mapping
  intakeq_location_id VARCHAR,                    -- IntakeQ's internal ID (if available)
  intakeq_location_name VARCHAR NOT NULL UNIQUE,  -- The LocationName from IntakeQ
  
  -- Business logic
  requires_cosign BOOLEAN NOT NULL DEFAULT true,
  
  -- Display
  display_name VARCHAR NOT NULL,                  -- Friendly name for UI
  
  -- Metadata
  notes TEXT,                                     -- Any special instructions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for lookup by location name (the join key from IntakeQ)
CREATE INDEX IF NOT EXISTS idx_payer_cosign_location 
  ON payer_cosign_requirements(intakeq_location_name);


-- =====================================================
-- CO-SIGNATURE QUEUE TABLE
-- =====================================================
-- Stores notes awaiting attending co-signature

CREATE TABLE IF NOT EXISTS cosign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- IntakeQ identifiers (for idempotency and linking)
  note_id VARCHAR NOT NULL UNIQUE,               -- IntakeQ Note ID (unique constraint prevents duplicates)
  appointment_id VARCHAR NOT NULL,               -- IntakeQ Appointment ID (for enrichment)
  client_id INTEGER NOT NULL,                    -- IntakeQ Client ID
  
  -- Patient info (denormalized for display)
  patient_name VARCHAR NOT NULL,
  
  -- Payer info (denormalized for filtering)
  payer_location_name VARCHAR NOT NULL,          -- From appointment.LocationName
  payer_display_name VARCHAR NOT NULL,           -- From payer_cosign_requirements.display_name
  
  -- Provider info (resident who created the note)
  resident_name VARCHAR NOT NULL,
  resident_email VARCHAR,
  
  -- Note metadata
  note_date TIMESTAMP WITH TIME ZONE NOT NULL,   -- When the note was created
  note_type VARCHAR,                             -- E.g., "Progress Note", "Intake Note"
  service_name VARCHAR,                          -- Service type from appointment
  
  -- Queue status
  status VARCHAR NOT NULL DEFAULT 'pending'      -- 'pending', 'signed', 'skipped'
    CHECK (status IN ('pending', 'signed', 'skipped')),
  
  -- Timestamps
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- When added to queue
  signed_at TIMESTAMP WITH TIME ZONE,               -- When marked as signed
  signed_by VARCHAR,                                -- Attending who signed
  
  -- IntakeQ link (for direct navigation)
  intakeq_note_url VARCHAR GENERATED ALWAYS AS (
    'https://intakeq.com/app/notes/' || note_id
  ) STORED,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cosign_queue_status 
  ON cosign_queue(status);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_payer 
  ON cosign_queue(payer_location_name);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_resident 
  ON cosign_queue(resident_name);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_date 
  ON cosign_queue(note_date DESC);
CREATE INDEX IF NOT EXISTS idx_cosign_queue_pending_date 
  ON cosign_queue(status, note_date DESC) 
  WHERE status = 'pending';


-- =====================================================
-- WEBHOOK AUDIT LOG TABLE
-- =====================================================
-- Tracks all webhook events for debugging

CREATE TABLE IF NOT EXISTS cosign_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Webhook payload
  webhook_type VARCHAR NOT NULL,                  -- 'Note Locked', etc.
  note_id VARCHAR,
  client_id INTEGER,
  raw_payload JSONB,
  
  -- Processing result
  action_taken VARCHAR,                           -- 'added_to_queue', 'marked_signed', 'ignored_no_cosign', 'ignored_note_not_found'
  processing_error TEXT,
  
  -- Metadata
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for debugging specific notes
CREATE INDEX IF NOT EXISTS idx_cosign_webhook_note 
  ON cosign_webhook_log(note_id);


-- =====================================================
-- SEED DATA: PAYER CO-SIGN REQUIREMENTS
-- =====================================================

INSERT INTO payer_cosign_requirements (intakeq_location_name, display_name, requires_cosign, notes) 
VALUES
  ('Medicaid', 'Utah Medicaid', true, 'All Medicaid patients require attending supervision'),
  ('HMHI-BHN', 'HMHI-BHN (U of U)', true, 'University of Utah employee plan'),
  ('SelectHealth', 'SelectHealth', true, 'Includes both Medicaid & Commercial'),
  ('SelectHealth Medicaid', 'SelectHealth Medicaid', true, 'Medicaid MCO'),
  ('SelectHealth Commercial', 'SelectHealth Commercial', true, 'Commercial plans'),
  ('DMBA', 'DMBA', true, 'LDS Church employee plan'),
  ('Regence', 'Regence BlueCross', true, 'Commercial'),
  ('Molina', 'Molina Healthcare', true, 'Medicaid MCO'),
  ('Self-Pay', 'Self-Pay', false, 'No co-sign required for self-pay')
ON CONFLICT (intakeq_location_name) 
DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  requires_cosign = EXCLUDED.requires_cosign,
  notes = EXCLUDED.notes,
  updated_at = NOW();


-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE payer_cosign_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosign_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosign_webhook_log ENABLE ROW LEVEL SECURITY;

-- Service role (webhook handler) can read/write all
CREATE POLICY "Service role full access to payer_cosign_requirements"
  ON payer_cosign_requirements FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to cosign_queue"
  ON cosign_queue FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to cosign_webhook_log"
  ON cosign_webhook_log FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated admin users can read/update queue
CREATE POLICY "Admins can view cosign_queue"
  ON cosign_queue FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can update cosign_queue"
  ON cosign_queue FOR UPDATE
  USING (auth.role() = 'authenticated');
```

### Entity Relationship

```
┌─────────────────────────────────────┐
│  payer_cosign_requirements          │
├─────────────────────────────────────┤
│  intakeq_location_name (PK, unique) │◄──────┐
│  display_name                       │       │
│  requires_cosign                    │       │
└─────────────────────────────────────┘       │
                                              │ FK: payer_location_name
┌─────────────────────────────────────┐       │
│  cosign_queue                       │       │
├─────────────────────────────────────┤       │
│  note_id (PK, unique)               │       │
│  appointment_id                     │       │
│  payer_location_name ───────────────┼───────┘
│  patient_name                       │
│  resident_name                      │
│  status                             │
│  intakeq_note_url (computed)        │
└─────────────────────────────────────┘
```

---

## 5. Webhook Implementation

### New Webhook Route

**File:** `src/app/api/webhooks/intakeq-note-locked/route.ts`

```typescript
// IntakeQ "Note Locked" webhook handler for co-signature queue
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Types
interface NoteLockWebhookPayload {
  NoteId: string
  Type: string  // "Note Locked"
  ClientId: number
}

interface IntakeQNote {
  Id: string
  AppointmentId?: string
  ClientName: string
  PractitionerName: string
  PractitionerEmail?: string
  Date: number  // Unix timestamp
  Status: string
  Questions: Array<{
    Text: string
    Answer: string
  }>
}

interface IntakeQAppointment {
  Id: string
  LocationName: string
  ServiceName: string
  ClientName: string
  PractitionerName: string
  Status: string
}

// Initialize Supabase with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// IntakeQ API helper
async function fetchFromIntakeQ<T>(endpoint: string): Promise<T | null> {
  const response = await fetch(`https://intakeq.com/api/v1${endpoint}`, {
    headers: {
      'X-Auth-Key': process.env.INTAKEQ_API_KEY!,
      'Accept': 'application/json'
    }
  })
  
  if (!response.ok) {
    console.error(`IntakeQ API error: ${response.status} for ${endpoint}`)
    return null
  }
  
  return response.json()
}

export async function POST(request: NextRequest) {
  const receivedAt = new Date().toISOString()
  let payload: NoteLockWebhookPayload | null = null
  
  try {
    // 1. Parse webhook payload
    payload = await request.json()
    
    console.log('📨 Note Locked webhook received:', {
      noteId: payload.NoteId,
      type: payload.Type,
      clientId: payload.ClientId
    })
    
    // 2. Verify this is a "Note Locked" event
    if (payload.Type !== 'Note Locked') {
      await logWebhookEvent(payload, 'ignored_wrong_type')
      return NextResponse.json({ success: true, action: 'ignored_wrong_type' })
    }
    
    // 3. Check if note is already in queue
    const { data: existingEntry } = await supabase
      .from('cosign_queue')
      .select('id, status')
      .eq('note_id', payload.NoteId)
      .single()
    
    if (existingEntry) {
      // This is a RE-LOCK — mark as signed if pending
      if (existingEntry.status === 'pending') {
        await supabase
          .from('cosign_queue')
          .update({
            status: 'signed',
            signed_at: new Date().toISOString(),
            signed_by: 'Attending (via IntakeQ)', // We don't know who specifically
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEntry.id)
        
        console.log('✅ Note marked as signed:', payload.NoteId)
        await logWebhookEvent(payload, 'marked_signed')
        return NextResponse.json({ success: true, action: 'marked_signed' })
      } else {
        // Already signed or skipped, ignore
        await logWebhookEvent(payload, 'ignored_already_processed')
        return NextResponse.json({ success: true, action: 'ignored_already_processed' })
      }
    }
    
    // 4. FIRST LOCK — Fetch full note to get AppointmentId
    const note = await fetchFromIntakeQ<IntakeQNote>(`/notes/${payload.NoteId}`)
    
    if (!note) {
      await logWebhookEvent(payload, 'error_note_not_found')
      return NextResponse.json({ success: false, error: 'Note not found' }, { status: 404 })
    }
    
    if (!note.AppointmentId) {
      // Note without appointment — skip (can't determine payer)
      console.log('⚠️ Note has no AppointmentId, skipping:', payload.NoteId)
      await logWebhookEvent(payload, 'ignored_no_appointment')
      return NextResponse.json({ success: true, action: 'ignored_no_appointment' })
    }
    
    // 5. Fetch appointment to get LocationName (payer)
    const appointment = await fetchFromIntakeQ<IntakeQAppointment>(
      `/appointments/${note.AppointmentId}`
    )
    
    if (!appointment) {
      await logWebhookEvent(payload, 'error_appointment_not_found')
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 })
    }
    
    // 6. Look up payer co-sign requirement
    const { data: payerConfig } = await supabase
      .from('payer_cosign_requirements')
      .select('requires_cosign, display_name')
      .eq('intakeq_location_name', appointment.LocationName)
      .single()
    
    if (!payerConfig) {
      console.log(`⚠️ Unknown payer location: ${appointment.LocationName}`)
      await logWebhookEvent(payload, 'ignored_unknown_payer', {
        locationName: appointment.LocationName
      })
      // Default to requiring co-sign for unknown payers
    }
    
    const requiresCosign = payerConfig?.requires_cosign ?? true  // Default to true if unknown
    
    if (!requiresCosign) {
      console.log(`ℹ️ Payer ${appointment.LocationName} does not require co-sign, skipping`)
      await logWebhookEvent(payload, 'ignored_no_cosign_required')
      return NextResponse.json({ success: true, action: 'ignored_no_cosign_required' })
    }
    
    // 7. Add to co-sign queue
    const { error: insertError } = await supabase
      .from('cosign_queue')
      .insert({
        note_id: payload.NoteId,
        appointment_id: note.AppointmentId,
        client_id: payload.ClientId,
        patient_name: note.ClientName,
        payer_location_name: appointment.LocationName,
        payer_display_name: payerConfig?.display_name ?? appointment.LocationName,
        resident_name: note.PractitionerName,
        resident_email: note.PractitionerEmail,
        note_date: new Date(note.Date).toISOString(),
        note_type: detectNoteType(note),
        service_name: appointment.ServiceName,
        status: 'pending'
      })
    
    if (insertError) {
      console.error('❌ Failed to insert into queue:', insertError)
      await logWebhookEvent(payload, 'error_insert_failed', { error: insertError.message })
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
    }
    
    console.log('✅ Note added to co-sign queue:', {
      noteId: payload.NoteId,
      patient: note.ClientName,
      payer: appointment.LocationName,
      resident: note.PractitionerName
    })
    
    await logWebhookEvent(payload, 'added_to_queue')
    return NextResponse.json({ success: true, action: 'added_to_queue' })
    
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error)
    if (payload) {
      await logWebhookEvent(payload, 'error_exception', { error: error.message })
    }
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper: Detect note type from content
function detectNoteType(note: IntakeQNote): string {
  const titleQuestion = note.Questions?.find(q => 
    q.Text.toLowerCase().includes('note type') || 
    q.Text.toLowerCase().includes('visit type')
  )
  if (titleQuestion?.Answer) {
    return titleQuestion.Answer
  }
  return 'Progress Note'  // Default
}

// Helper: Log webhook event for debugging
async function logWebhookEvent(
  payload: NoteLockWebhookPayload,
  action: string,
  extra?: Record<string, any>
) {
  await supabase
    .from('cosign_webhook_log')
    .insert({
      webhook_type: payload.Type,
      note_id: payload.NoteId,
      client_id: payload.ClientId,
      action_taken: action,
      raw_payload: { ...payload, ...extra }
    })
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'IntakeQ Note Locked webhook for co-sign queue',
    timestamp: new Date().toISOString()
  })
}
```

### Webhook URL to Configure in IntakeQ

```
https://trymoonlit.com/api/webhooks/intakeq-note-locked
```

---

## 6. Dashboard UI

### Location in App

The co-signature queue belongs in the **Provider Dashboard** under a new navigation section:

```
Provider Dashboard
├── Dashboard (home)
├── Scheduling
│   ├── My Availability
│   ├── My Calendar
│   └── Schedule Exceptions
├── Network & Coverage
│   └── Network & Coverage
├── Clinical Workflows        ◄── NEW SECTION
│   └── Co-Sign Queue        ◄── NEW PAGE
├── Personal Profile
│   ├── Edit Profile
│   └── Account Settings
└── Administration (admin only)
```

### Page: `/dashboard/cosign-queue/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  Filter,
  RefreshCw,
  User,
  Building2,
  Calendar
} from 'lucide-react'

interface CosignQueueItem {
  id: string
  note_id: string
  patient_name: string
  payer_display_name: string
  resident_name: string
  note_date: string
  note_type: string | null
  service_name: string | null
  status: 'pending' | 'signed' | 'skipped'
  intakeq_note_url: string
  added_at: string
  signed_at: string | null
}

export default function CosignQueuePage() {
  const [items, setItems] = useState<CosignQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'signed'>('pending')
  const [payerFilter, setPayerFilter] = useState<string>('all')
  const [payers, setPayers] = useState<string[]>([])
  
  // Fetch queue items
  const fetchQueue = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.append('status', filter)
      if (payerFilter !== 'all') params.append('payer', payerFilter)
      
      const response = await fetch(`/api/cosign-queue?${params}`)
      const data = await response.json()
      
      setItems(data.items || [])
      setPayers(data.payers || [])
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    }
    setLoading(false)
  }
  
  useEffect(() => {
    fetchQueue()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [filter, payerFilter])
  
  const pendingCount = items.filter(i => i.status === 'pending').length
  
  const openInIntakeQ = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#091747]">
            Co-Signature Queue
          </h1>
          <p className="text-gray-600">
            Notes awaiting attending co-signature
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Pending badge */}
          <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
            {pendingCount} pending
          </div>
          
          {/* Refresh button */}
          <button
            onClick={fetchQueue}
            className="p-2 text-gray-500 hover:text-[#BF9C73] rounded-lg hover:bg-[#FEF8F1]"
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">Filter:</span>
          </div>
          
          {/* Status filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['pending', 'signed', 'all'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  filter === status
                    ? 'bg-white text-[#091747] shadow-sm'
                    : 'text-gray-600 hover:text-[#091747]'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Payer filter */}
          <select
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
          >
            <option value="all">All Payers</option>
            {payers.map(payer => (
              <option key={payer} value={payer}>{payer}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Queue Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600">No notes awaiting co-signature</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Patient
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Payer
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Resident
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Note Date
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr 
                  key={item.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  {/* Status */}
                  <td className="px-4 py-3">
                    {item.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">Pending</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Signed</span>
                      </span>
                    )}
                  </td>
                  
                  {/* Patient */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">
                        {item.patient_name}
                      </span>
                    </div>
                    {item.note_type && (
                      <span className="text-xs text-gray-500">
                        {item.note_type}
                      </span>
                    )}
                  </td>
                  
                  {/* Payer */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {item.payer_display_name}
                      </span>
                    </div>
                  </td>
                  
                  {/* Resident */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {item.resident_name}
                    </span>
                  </td>
                  
                  {/* Date */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-900">
                          {formatDate(item.note_date)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatTime(item.note_date)}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  {/* Action */}
                  <td className="px-4 py-3">
                    {item.status === 'pending' ? (
                      <button
                        onClick={() => openInIntakeQ(item.intakeq_note_url)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#BF9C73] text-white text-sm font-medium rounded-lg hover:bg-[#a8875f] transition-colors"
                      >
                        <span>Review & Sign</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => openInIntakeQ(item.intakeq_note_url)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <span>View Note</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Footer info */}
      <div className="mt-4 text-sm text-gray-500">
        <p>
          Notes are automatically added when residents lock them in IntakeQ.
          Click "Review & Sign" to open the note in IntakeQ, unlock, add your co-signature, and re-lock.
        </p>
      </div>
    </div>
  )
}
```

### Update Sidebar Navigation

Add to `DashboardSidebar.tsx`:

```typescript
// In navigationItems array, add after 'Network & Coverage':

// Clinical Workflows Section
{ id: 'cosign-queue', label: 'Co-Sign Queue', icon: FileSignature, href: '/dashboard/cosign-queue', section: 'clinical' },

// And update getSectionLabel:
case 'clinical': return 'Clinical Workflows';

// And add to render order:
{renderNavigationSection('clinical')}
```

---

## 7. API Routes

### Queue Endpoint: `/api/cosign-queue/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const payer = searchParams.get('payer')
  
  let query = supabase
    .from('cosign_queue')
    .select('*')
    .order('note_date', { ascending: false })
  
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  
  if (payer && payer !== 'all') {
    query = query.eq('payer_display_name', payer)
  }
  
  const { data: items, error } = await query.limit(100)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Get unique payers for filter dropdown
  const { data: payersData } = await supabase
    .from('cosign_queue')
    .select('payer_display_name')
    .order('payer_display_name')
  
  const payers = [...new Set(payersData?.map(p => p.payer_display_name) || [])]
  
  return NextResponse.json({ items, payers })
}

// Manual status update (if needed)
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { noteId, status, signedBy } = body
  
  const updateData: Record<string, any> = {
    status,
    updated_at: new Date().toISOString()
  }
  
  if (status === 'signed') {
    updateData.signed_at = new Date().toISOString()
    updateData.signed_by = signedBy || 'Manual update'
  }
  
  const { error } = await supabase
    .from('cosign_queue')
    .update(updateData)
    .eq('note_id', noteId)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ success: true })
}
```

### Stats Endpoint: `/api/cosign-queue/stats/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Get counts by status
  const { data: pending } = await supabase
    .from('cosign_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  
  const { data: signedToday } = await supabase
    .from('cosign_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'signed')
    .gte('signed_at', new Date().toISOString().split('T')[0])
  
  const { data: signedThisWeek } = await supabase
    .from('cosign_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'signed')
    .gte('signed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  
  return NextResponse.json({
    pending: pending?.length || 0,
    signedToday: signedToday?.length || 0,
    signedThisWeek: signedThisWeek?.length || 0
  })
}
```

---

## 8. Edge Cases & Safeguards

### Edge Case 1: Resident Unlocks and Re-locks Before Attending Signs

**Problem:** If a resident unlocks their own note to make edits and re-locks it, the webhook would fire again and could incorrectly mark it as signed.

**Solution (Recommended for v1):** Accept this edge case initially. It's rare for residents to re-edit locked notes. Document as known limitation.

**Future Enhancement:** On re-lock, fetch the full note and verify an attending signature field exists before marking as signed.

### Edge Case 2: Unknown Payer Location

**Problem:** A new payer location is added to IntakeQ but not in our `payer_cosign_requirements` table.

**Solution:** Default to `requires_cosign = true` for unknown payers. Better to require an unnecessary co-sign than to miss one.

```typescript
const requiresCosign = payerConfig?.requires_cosign ?? true  // Default to true
```

### Edge Case 3: Note Without Appointment

**Problem:** Some notes might be created without an associated appointment (standalone notes).

**Solution:** Skip these notes—we can't determine the payer without an appointment.

```typescript
if (!note.AppointmentId) {
  console.log('Note has no AppointmentId, skipping')
  return NextResponse.json({ action: 'ignored_no_appointment' })
}
```

### Edge Case 4: API Rate Limits

**Problem:** IntakeQ has rate limits (10 requests/min, 500/day on standard plan).

**Solution:** 
- Batch operations during low-volume periods
- Cache payer config in memory (doesn't change often)
- Monitor rate limit headers in responses

### Edge Case 5: Webhook Delivery Failures

**Problem:** Webhook might fail to deliver or be retried.

**Solution:** 
- Use `note_id` as unique key—duplicate webhooks for same note are no-ops
- Implement webhook audit log for debugging
- Consider IntakeQ's webhook retry policy

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Get the basic infrastructure in place

- [ ] Run database migrations (create tables)
- [ ] Seed payer co-sign requirements
- [ ] Implement webhook handler
- [ ] Configure webhook URL in IntakeQ settings
- [ ] Test webhook with manual note locks

**Success Criteria:** Webhook receives events and logs them correctly

### Phase 2: Queue Logic (Week 2)

**Goal:** Implement full queue logic

- [ ] Implement payer lookup and filtering
- [ ] Implement queue insertion for qualifying notes
- [ ] Implement re-lock detection (mark as signed)
- [ ] Add comprehensive logging
- [ ] Test end-to-end flow

**Success Criteria:** Notes appear in queue when residents lock them

### Phase 3: Dashboard UI (Week 3)

**Goal:** Build the attending-facing interface

- [ ] Create Co-Sign Queue page
- [ ] Add to dashboard navigation
- [ ] Implement filtering (status, payer)
- [ ] Add auto-refresh
- [ ] Link to IntakeQ notes

**Success Criteria:** Attending can view queue and click through to IntakeQ

### Phase 4: Polish & Deploy (Week 4)

**Goal:** Production readiness

- [ ] Add error handling and retry logic
- [ ] Add monitoring/alerting for queue backlog
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Train attending on new workflow

**Success Criteria:** System running in production with real notes

---

## 10. Testing Plan

### Unit Tests

```typescript
// tests/cosign-queue/webhook-handler.test.ts

describe('Note Locked Webhook Handler', () => {
  test('adds note to queue when payer requires cosign', async () => {
    // Mock IntakeQ API responses
    // Verify queue insertion
  })
  
  test('ignores note when payer does not require cosign', async () => {
    // Mock Self-Pay appointment
    // Verify no queue insertion
  })
  
  test('marks note as signed on re-lock', async () => {
    // Pre-populate queue with pending note
    // Send webhook with same note_id
    // Verify status updated to signed
  })
  
  test('handles unknown payer by defaulting to require cosign', async () => {
    // Mock appointment with unknown LocationName
    // Verify note added to queue
  })
})
```

### Integration Tests

```typescript
// tests/cosign-queue/integration.test.ts

describe('Co-Sign Queue Integration', () => {
  test('full workflow: resident lock → queue → attending sign', async () => {
    // 1. Simulate resident locking note
    // 2. Verify appears in queue
    // 3. Simulate attending re-lock
    // 4. Verify marked as signed
  })
})
```

### Manual Testing Checklist

- [ ] Lock a note in IntakeQ as resident
- [ ] Verify note appears in queue within 30 seconds
- [ ] Verify patient name, payer, date are correct
- [ ] Click "Review & Sign" → opens correct note in IntakeQ
- [ ] In IntakeQ: unlock, add signature, re-lock
- [ ] Verify note status changes to "Signed" in queue
- [ ] Filter by payer → verify filtering works
- [ ] Filter by status → verify filtering works

---

## Appendix: API Documentation

### IntakeQ Notes API

**Endpoint:** `GET https://intakeq.com/api/v1/notes/{noteId}`

**Headers:**
```
X-Auth-Key: {your_api_key}
Accept: application/json
```

**Response:**
```json
{
  "Id": "abc123",
  "AppointmentId": "def456",
  "ClientName": "John Doe",
  "ClientId": 12345,
  "PractitionerName": "Dr. Resident",
  "PractitionerEmail": "resident@example.com",
  "Date": 1705329600000,
  "Status": "Locked",
  "Questions": [
    {
      "Text": "Chief Complaint",
      "Answer": "Follow-up for depression"
    }
  ]
}
```

### IntakeQ Appointments API

**Endpoint:** `GET https://intakeq.com/api/v1/appointments/{appointmentId}`

**Response:**
```json
{
  "Id": "def456",
  "ClientId": 12345,
  "ClientName": "John Doe",
  "PractitionerId": "prac789",
  "PractitionerName": "Dr. Resident",
  "ServiceName": "Follow-Up (30 min)",
  "LocationName": "Medicaid",
  "Status": "Completed"
}
```

### IntakeQ Webhook Payload

**Event:** `Note Locked`

**Payload:**
```json
{
  "NoteId": "abc123",
  "Type": "Note Locked",
  "ClientId": 12345
}
```

### IntakeQ Webhook Configuration

Navigate to: IntakeQ → Settings → API Settings → Note Webhook URL

Enter: `https://trymoonlit.com/api/webhooks/intakeq-note-locked`

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-15 | Claude | Initial roadmap |

---

*This document serves as the technical specification for implementing the attending co-signature workflow. It should be updated as implementation progresses and requirements evolve.*
