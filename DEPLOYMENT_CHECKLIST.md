# Moonlit Finance — Deployment Checklist

## Pre-Deployment Verification

- [ ] Review all migration files in `/database-migrations/`
  - 041-create-finance-tables.sql
  - 042-provider-earnings-calc-engine.sql
  - 043-create-appointments-grid-view.sql
  - 044-seed-finance-test-data.sql (optional)

- [ ] Verify no schema conflicts with existing tables

- [ ] Review RLS policies match your auth setup

## Database Deployment

### Step 1: Backup Database
### Step 2: Run Migrations in Order
### Step 3: Verify Tables Created
### Step 4: Verify RLS Policies

## Application Deployment

### Step 5: Update Codebase
### Step 6: Verify API Endpoints
### Step 7: Test UI Pages
### Step 8: Test CSV Upload

## Production Deployment

### Step 9: Deploy to Production
### Step 10: Run Production Migrations
### Step 11: Smoke Test Production
### Step 12: Load Initial Data
### Step 13: Monitor Initial Usage
### Step 14: Train Users
### Step 15: Documentation Handoff

See FINANCE_README.md for full details on each step.
