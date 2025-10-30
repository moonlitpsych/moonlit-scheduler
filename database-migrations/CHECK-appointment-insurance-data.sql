-- Check where payer information is stored in appointments
-- Sample appointments showing all payer-related fields
SELECT
  id,
  start_time::date as date,
  payer_id,
  insurance_info,
  payer_snapshot,
  member_snapshot,
  insurance_policy_id
FROM appointments
ORDER BY start_time DESC
LIMIT 10;
