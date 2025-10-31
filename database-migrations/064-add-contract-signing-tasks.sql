-- Add final contract signing tasks to payer credentialing workflows
-- These tasks represent the final steps after initial application submission
-- Created: Oct 30, 2025

-- ============================================================================
-- Add contract waiting and signing tasks to PDF submission workflows
-- ============================================================================

-- 1. Regence BCBS - Add contract steps
UPDATE payer_credentialing_workflows
SET task_templates = '[
  {
    "order": 1,
    "title": "Download Regence BCBS credentialing form",
    "description": "Download the PDF application form",
    "estimated_days": 0
  },
  {
    "order": 2,
    "title": "Fill out PDF application",
    "description": "Complete all required provider information",
    "estimated_days": 1
  },
  {
    "order": 3,
    "title": "Email completed form to Regence",
    "description": "Send completed PDF to general credentialing email",
    "estimated_days": 0
  },
  {
    "order": 4,
    "title": "Wait for contract from Regence",
    "description": "Monitor email for contract documents from Regence credentialing team. Typical response time: 30-60 days",
    "estimated_days": 45
  },
  {
    "order": 5,
    "title": "Sign and return contract to Regence",
    "description": "Review contract terms, sign, and return to Regence",
    "estimated_days": 2
  }
]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Regence BlueCross BlueShield');

-- 2. SelectHealth - Add contract steps
UPDATE payer_credentialing_workflows
SET task_templates = '[
  {
    "order": 1,
    "title": "Download SelectHealth credentialing form",
    "description": "Download the PDF application form from file storage",
    "estimated_days": 0
  },
  {
    "order": 2,
    "title": "Fill out PDF application",
    "description": "Complete all required provider information in the PDF form",
    "estimated_days": 1
  },
  {
    "order": 3,
    "title": "Email completed form to SelectHealth contact",
    "description": "Send completed PDF to credentialing contact person",
    "estimated_days": 0
  },
  {
    "order": 4,
    "title": "Wait for contract from SelectHealth",
    "description": "Monitor email for contract documents from SelectHealth credentialing contact. Typical response time: 30-60 days",
    "estimated_days": 45
  },
  {
    "order": 5,
    "title": "Sign and return contract to SelectHealth",
    "description": "Review contract terms, sign, and return to credentialing contact",
    "estimated_days": 2
  }
]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'SelectHealth Integrated');

-- 3. HMHI BHN - Add contract steps
UPDATE payer_credentialing_workflows
SET task_templates = '[
  {
    "order": 1,
    "title": "Download HMHI BHN credentialing form",
    "description": "Download the PDF application form",
    "estimated_days": 0
  },
  {
    "order": 2,
    "title": "Fill out PDF application",
    "description": "Complete all required provider information",
    "estimated_days": 1
  },
  {
    "order": 3,
    "title": "Email completed form to HMHI BHN",
    "description": "Send completed PDF to credentialing contact",
    "estimated_days": 0
  },
  {
    "order": 4,
    "title": "Wait for contract from HMHI BHN",
    "description": "Monitor email for contract documents from HMHI BHN credentialing team. Typical response time: 30-60 days",
    "estimated_days": 45
  },
  {
    "order": 5,
    "title": "Sign and return contract to HMHI BHN",
    "description": "Review contract terms, sign, and return to HMHI BHN",
    "estimated_days": 2
  }
]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'HMHI BHN');

-- 4. Health Choice Utah - Add contract steps
UPDATE payer_credentialing_workflows
SET task_templates = '[
  {
    "order": 1,
    "title": "Download Health Choice Utah credentialing form",
    "description": "Download the PDF application form",
    "estimated_days": 0
  },
  {
    "order": 2,
    "title": "Fill out PDF application",
    "description": "Complete all required provider information",
    "estimated_days": 1
  },
  {
    "order": 3,
    "title": "Email completed form to Health Choice Utah",
    "description": "Send completed PDF to credentialing contact",
    "estimated_days": 0
  },
  {
    "order": 4,
    "title": "Wait for contract from Health Choice Utah",
    "description": "Monitor email for contract documents from Health Choice Utah credentialing team. Typical response time: 30-60 days",
    "estimated_days": 45
  },
  {
    "order": 5,
    "title": "Sign and return contract to Health Choice Utah",
    "description": "Review contract terms, sign, and return to Health Choice Utah",
    "estimated_days": 2
  }
]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Health Choice Utah');

-- ============================================================================
-- Add contract steps to Excel submission workflows
-- ============================================================================

-- 5. Molina Utah - Add contract steps
UPDATE payer_credentialing_workflows
SET task_templates = '[
  {
    "order": 1,
    "title": "Download Molina provider roster spreadsheet",
    "description": "Download Excel template for provider roster",
    "estimated_days": 0
  },
  {
    "order": 2,
    "title": "Fill out provider information in spreadsheet",
    "description": "Add provider details to the roster template",
    "estimated_days": 1
  },
  {
    "order": 3,
    "title": "Email completed roster to Molina",
    "description": "Send completed spreadsheet to general credentialing email",
    "estimated_days": 0
  },
  {
    "order": 4,
    "title": "Wait for contract from Molina",
    "description": "Monitor email for contract documents from Molina credentialing team. Typical response time: 30-60 days",
    "estimated_days": 45
  },
  {
    "order": 5,
    "title": "Sign and return contract to Molina",
    "description": "Review contract terms, sign, and return to Molina",
    "estimated_days": 2
  }
]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'Molina Utah');

-- ============================================================================
-- Add contract steps to portal-based workflows
-- ============================================================================

-- 6. UUHP - Add contract steps
UPDATE payer_credentialing_workflows
SET task_templates = '[
  {
    "order": 1,
    "title": "Gather provider credentials and information",
    "description": "Compile all required provider documentation",
    "estimated_days": 0
  },
  {
    "order": 2,
    "title": "Email provider information to UUHP",
    "description": "Send compiled information to general credentialing email",
    "estimated_days": 0
  },
  {
    "order": 3,
    "title": "Confirm receipt and follow up",
    "description": "Verify UUHP received application and check on status",
    "estimated_days": 7
  },
  {
    "order": 4,
    "title": "Wait for contract from UUHP",
    "description": "Monitor email for contract documents from UUHP credentialing team. Typical response time: 30-60 days",
    "estimated_days": 45
  },
  {
    "order": 5,
    "title": "Sign and return contract to UUHP",
    "description": "Review contract terms, sign, and return to UUHP",
    "estimated_days": 2
  }
]'::jsonb
WHERE payer_id = (SELECT id FROM payers WHERE name = 'University of Utah Health Plans (UUHP)');

-- ============================================================================
-- Verification
-- ============================================================================

-- Check updated task counts
SELECT
  p.name as payer_name,
  pcw.workflow_type,
  jsonb_array_length(pcw.task_templates) as task_count,
  pcw.task_templates->4->>'title' as fourth_task,
  pcw.task_templates->4->>'title' as fifth_task
FROM payer_credentialing_workflows pcw
JOIN payers p ON p.id = pcw.payer_id
WHERE p.name IN (
  'Regence BlueCross BlueShield',
  'SelectHealth Integrated',
  'HMHI BHN',
  'Health Choice Utah',
  'Molina Utah',
  'University of Utah Health Plans (UUHP)'
)
ORDER BY p.name;
