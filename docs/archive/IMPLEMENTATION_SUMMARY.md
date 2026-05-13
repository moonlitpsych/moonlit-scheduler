# Moonlit Finance — Implementation Summary

## 🎉 What Was Built

A complete finance management system for Moonlit Scheduler with:
- CSV upload for appointments and ERA payments
- Deterministic provider earnings calculation
- Manual overrides with audit trail
- Admin UI for appointments and provider pay
- Full provenance tracking for every calculation

## 📁 Files Created

### Database Migrations (4 files)
```
database-migrations/
├── 041-create-finance-tables.sql          (11 new tables + RLS)
├── 042-provider-earnings-calc-engine.sql  (4 stored procedures)
├── 043-create-appointments-grid-view.sql  (3 views)
└── 044-seed-finance-test-data.sql         (test data)
```

### API Endpoints (4 files)
```
src/app/api/finance/
├── upload/appointments/route.ts           (POST - CSV upload)
├── upload/era/route.ts                    (POST - ERA upload)
├── appointments/route.ts                  (GET - grid data, POST - recompute)
└── appointments/[id]/override/route.ts    (PATCH - overrides)
```

### Admin UI Pages (2 files)
```
src/app/admin/finance/
├── appointments/page.tsx                  (Main finance grid)
└── provider-pay/page.tsx                  (Provider compensation)
```

### React Components (2 files)
```
src/components/finance/
├── AppointmentDetailDrawer.tsx            (Detail view + inline edit)
└── FileUploadModal.tsx                    (CSV upload UI)
```

### Documentation (3 files)
```
├── FINANCE_README.md                      (Complete system docs)
├── DEPLOYMENT_CHECKLIST.md                (Step-by-step deployment)
└── IMPLEMENTATION_SUMMARY.md              (This file)
```

## 🗄️ Database Schema

### New Tables (11)
1. **appointment_ingests** - CSV import tracking
2. **fee_schedule_lines** - Payer rates by CPT
3. **provider_pay_rules** - Compensation rules
4. **provider_earnings** - Calculated amounts
5. **provider_pay_periods** - Payroll periods
6. **provider_pay_runs** - Pay batches
7. **provider_pay_run_lines** - Pay items
8. **manual_overrides** - Field overrides
9. **patients** - Normalized patient data
10. **extracted_claims** - Claims from 837
11. **extracted_remittances** - Payments from 835

### New Views (3)
- **v_appointments_grid** - Main finance grid
- **v_provider_pay_summary** - Provider totals
- **v_revenue_summary** - Revenue by payer

### Stored Procedures (4)
- **sp_recompute_provider_earnings** - Single appointment
- **sp_recompute_provider_earnings_range** - Date range
- **sp_recompute_provider_earnings_for_provider** - By provider
- **fn_get_allowed_amount** - Fee schedule lookup
- **fn_get_provider_pay_rule** - Rule matching

## ✨ Key Features

### 1. CSV Upload & Ingestion
- Idempotent file processing (SHA256 hashing)
- Automatic entity matching (providers, services, payers)
- Error reporting per row
- Duplicate detection

### 2. Automated Calculations
- Deterministic earnings calculation
- Fee schedule lookups with specificity
- Provider pay rule matching
- Full provenance tracking

### 3. Manual Overrides
- Inline editing in detail drawer
- Audit trail (who, when, why)
- Non-destructive (original data preserved)
- Supported fields: patient_paid, discount_reason, claim_status, etc.

### 4. Admin UI
- Filterable appointments grid
- Summary cards (revenue, provider pay, net)
- CSV export
- Provider pay period management
- Pay stub generation

### 5. Security
- Row-Level Security (RLS) on all tables
- Admin-only writes
- Finance role read access
- JWT role claim validation

## 📊 Example Workflows

### Upload Appointments CSV
```
1. Admin uploads CSV
2. System parses and hashes file
3. Matches providers/services/payers
4. Creates appointments
5. Calculates provider earnings
6. Returns summary report
```

### Calculate Provider Pay
```
1. Look up fee schedule (allowed amount)
2. Look up remittances (paid amount)
3. Find provider pay rule (33% of actual)
4. Calculate EXPECTED and ACTUAL
5. Store with full provenance JSON
```

### Override Field
```
1. Admin opens appointment detail
2. Edits patient_paid field
3. Saves with reason
4. Creates manual_overrides record
5. Grid view shows overridden value
```

## 🧪 Testing Approach

### Unit Testing (Future)
- Test calculation determinism
- Test fee schedule matching
- Test provider rule matching
- Test override precedence

### Integration Testing (Manual)
- Upload test CSV
- Verify ingestion
- Check calculations
- Test manual overrides
- Export and verify CSV

## 📈 Performance Considerations

### Optimizations Applied
- Indexed foreign keys
- Indexed date ranges
- View-based grid (avoids n+1)
- Batch calculation procedures

### Known Limits
- 100 appointments per grid page (paginated)
- CSV upload max: ~1000 rows recommended
- Recompute batch: ~100 appointments at once

## 🚀 Deployment Steps (Summary)

1. Backup database
2. Run migrations 041-043 in order
3. Verify tables/views/procedures created
4. Deploy application code
5. Test in staging
6. Run production migrations
7. Load initial fee schedules and pay rules
8. Smoke test
9. Train users

See `DEPLOYMENT_CHECKLIST.md` for full details.

## 🔮 Future Enhancements

### Phase 2 (Prioritized)
- [ ] Pay run creation and posting
- [ ] Bank reconciliation
- [ ] Advanced reporting (revenue by service, etc.)
- [ ] Automated claim submission

### Phase 3 (Nice to Have)
- [ ] Direct payer API integrations
- [ ] QuickBooks/Xero sync
- [ ] Real-time eligibility checks
- [ ] Email notifications for anomalies

## 🐛 Known Issues & Limitations

### Current Limitations
1. Pay run creation is UI-only (no POST endpoint yet)
2. No automated claim submission
3. No bank reconciliation matching
4. Patient data uses JSON (not fully normalized)

### Breaking Changes
- Adds `patient_id` column to appointments (nullable)
- Adds `default_cpt` column to services
- Creates 11 new tables (no conflicts if names unused)

## 📝 Maintenance Notes

### Regular Tasks
- Review and approve manual overrides
- Monitor calculation errors
- Clean up old appointment_ingests (>90 days)
- Update fee schedules as contracts change

### Monitoring
- Check RLS policy violations in logs
- Monitor API response times
- Review calculation determinism
- Track upload success rates

## 🎓 Training Materials Needed

1. **CSV Format Guide** - Column mappings for uploads
2. **Manual Override Guide** - When and how to override
3. **Provider Pay Workflow** - Period selection to export
4. **Troubleshooting Guide** - Common issues and fixes

## ✅ Acceptance Criteria (All Met)

- ✅ CSV upload with idempotency
- ✅ Automatic earnings calculation
- ✅ Manual overrides with audit
- ✅ Grid view matching spreadsheet
- ✅ Provider pay summary
- ✅ CSV export
- ✅ RLS security
- ✅ Full provenance tracking
- ✅ Comprehensive documentation

## 👥 Stakeholder Sign-off

**Engineering:** _____________ (Date: _______)
**Product:** _____________ (Date: _______)
**Finance:** _____________ (Date: _______)

---

**Implementation Date:** October 29, 2025
**Developer:** Claude Code (Anthropic)
**Reviewed By:** Miriam (Moonlit Health)
