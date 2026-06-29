-- Migration 094: create admin_audit_log
--
-- WHY: logAdminAudit() in src/lib/services/auditService.ts was a no-op stub — the
-- real insert was commented out "until admin_audit_log table is created". As a
-- result, destructive admin operations (notably the apply-contract supervision
-- reconcile) left NO audit trail. On 2026-06-26 that reconcile hard-deleted all 8
-- of Optum Commercial's supervised relationships with no recoverable record.
--
-- This table is the general-purpose admin audit sink the service was written for.
-- It is intentionally NOT admin_action_logs (migration 006): that table is
-- impersonation-specific and has a NOT NULL provider_id FK, so it cannot record
-- payer- or supervision-scoped changes.

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id TEXT NOT NULL,            -- admin email / id ('admin' until session wiring lands)
    action      TEXT NOT NULL,              -- e.g. update_payer, upsert_ppn, delete_supervision
    entity      TEXT NOT NULL,              -- payers | provider_payer_networks | supervision_relationships
    entity_id   TEXT,                       -- affected row id (text: ids are UUIDs but kept generic)
    before_data JSONB,                      -- row state before the change (null for creates)
    after_data  JSONB,                      -- row state after the change (null for deletes/retires)
    note        TEXT,                       -- human-readable note incl. the required audit note
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity   ON admin_audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action   ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created  ON admin_audit_log(created_at DESC);

COMMENT ON TABLE admin_audit_log IS 'General-purpose audit trail for admin write operations (payers, contracts, supervision). Written by logAdminAudit().';
