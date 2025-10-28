/**
 * QUICK FIX: Manually refresh the materialized view
 *
 * Run this in Supabase SQL Editor to see updated patient statuses:
 */

REFRESH MATERIALIZED VIEW v_patient_activity_summary;

/**
 * This will update the view with current data from the database.
 * Daniel Matheny should now show as "inactive" in the admin dashboard.
 *
 * NOTE: This is a temporary fix. You'll need to run this every time
 * a patient status changes until we convert to a regular view.
 */
