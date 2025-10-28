-- Update Kyle Roller's role to Psychiatrist (attending)
-- Current: "provider" (too generic, system treats as resident)
-- Updated: "Psychiatrist" (system will recognize as attending)

UPDATE providers
SET
  role = 'Psychiatrist',
  updated_at = NOW()
WHERE id = '06c5f00f-e2c1-46a7-bad1-55c406b1d190'
  AND first_name = 'Kyle'
  AND last_name = 'Roller';

-- Verify the update
SELECT
  id,
  first_name,
  last_name,
  role,
  title,
  is_active
FROM providers
WHERE id = '06c5f00f-e2c1-46a7-bad1-55c406b1d190';
