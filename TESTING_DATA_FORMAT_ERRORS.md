# Testing Guide: Preventing Data Format Errors

## Overview

This guide describes the comprehensive testing system created to prevent the "no provider availability" bug caused by API data format mismatches between backend responses and frontend component expectations.

## The Problem

The CalendarView component was expecting fields like `provider_id`, `provider_name`, `available` but the API was returning `providerId`, `providerName`, `isAvailable`. This mismatch caused:
- Time slots not displaying in the calendar
- Silent failures in data processing  
- "No availability" errors for users

## The Solution

We've created a multi-layered testing and validation system to catch these issues automatically:

## 🧪 Testing Tools

### 1. API Contract Validation (`/api/debug/validate-api-contracts`)

**Purpose**: Validates that API endpoints return the exact field names and types that the frontend expects.

**Usage**:
```bash
curl http://localhost:3000/api/debug/validate-api-contracts
```

**What it tests**:
- Field name consistency (`providerId` vs `provider_id`)
- Data types match expectations
- Required fields are present
- Response structure is correct

**Example output**:
```json
{
  "summary": {
    "total_tests": 2,
    "passed": 2,
    "failed": 0,
    "pass_rate": 100
  },
  "recommendations": [
    "✅ All API contracts valid - CalendarView data mapping should work correctly"
  ]
}
```

### 2. Runtime Data Validation (`/lib/utils/dataValidation.ts`)

**Purpose**: Automatically normalizes API responses to handle field name variations.

**Key functions**:
- `mapApiSlotToTimeSlot()` - Converts API slots to CalendarView format
- `validateAndNormalizeData()` - Validates and normalizes array data
- `devValidateApiData()` - Development-only validation wrapper

**Usage in components**:
```typescript
import { mapApiSlotToTimeSlot } from '@/lib/utils/dataValidation'

// Automatically handles providerId vs provider_id
const convertedSlots = apiSlots.map(mapApiSlotToTimeSlot)
```

**Features**:
- Handles multiple field name variations
- Type validation
- Development-only logging (no production performance impact)
- Fallback mapping when validation fails

### 3. Integration Testing (`/api/debug/test-booking-integration`)

**Purpose**: Tests the complete booking flow end-to-end to ensure all APIs work together.

**Usage**:
```bash
curl http://localhost:3000/api/debug/test-booking-integration
```

**What it tests**:
1. Payer data fetching
2. Provider data for specific payers  
3. Availability data with correct field formats
4. API contract validation
5. Data format compatibility

### 4. Error Boundary (`/components/errors/DataValidationBoundary.tsx`)

**Purpose**: Catches and gracefully handles data format errors in the UI.

**Features**:
- Detects data mapping errors automatically
- Shows user-friendly error messages
- Provides debug information in development
- Links to validation tools
- Retry functionality

**Usage**:
```typescript
<DataValidationBoundary context="Calendar View">
  <CalendarView {...props} />
</DataValidationBoundary>
```

### 5. Automated Test Script (`test-booking-apis.sh`)

**Purpose**: One-command validation of all booking APIs.

**Usage**:
```bash
./test-booking-apis.sh
```

**Output example**:
```
🧪 Booking API Test Suite
=========================

✅ API contracts validation: PASSED (100% pass rate)
✅ Integration test: PASSED  
✅ Availability check: PASSED (11 slots found)
✅ Provider data check: PASSED (2 providers found)

🎉 All tests passed! Booking APIs are working correctly.
```

## 🔄 Development Workflow

### When Making API Changes:

1. **Before deploying**: Run the test script
   ```bash
   ./test-booking-apis.sh
   ```

2. **If tests fail**: Check specific validation
   ```bash
   curl http://localhost:3000/api/debug/validate-api-contracts
   ```

3. **Fix field mapping issues**: Update API responses or add field alternatives to validation schemas

4. **Verify fix**: Re-run tests until they pass

### When Adding New Components:

1. **Wrap in error boundary**:
   ```typescript
   import { withDataValidation } from '@/components/errors/DataValidationBoundary'
   export default withDataValidation(MyComponent, 'My Component Context')
   ```

2. **Use validation utilities**:
   ```typescript
   import { devValidateApiData } from '@/lib/utils/dataValidation'
   const validatedData = devValidateApiData(apiResponse, 'AVAILABLE_SLOT', 'My Component')
   ```

### When Debugging "No Availability" Issues:

1. **Check browser console** for validation warnings
2. **Run validation endpoint**: `/api/debug/validate-api-contracts`  
3. **Check integration test**: `/api/debug/test-booking-integration`
4. **Verify field mappings** in `dataValidation.ts` schemas

## 📊 Monitoring in Production

### Health Check Endpoints:

- **Contract Validation**: `GET /api/debug/validate-api-contracts`
- **Integration Test**: `GET /api/debug/test-booking-integration`

### Automated Monitoring:

Set up periodic checks (e.g., every hour) to run the test script:
```bash
# Add to cron job
0 * * * * /path/to/test-booking-apis.sh >> /var/log/booking-tests.log 2>&1
```

### Alerts:

Configure alerts when:
- API contract validation pass rate < 100%
- Integration test fails
- Availability check returns 0 slots

## 🛠️ Customization

### Adding New API Endpoints:

1. **Add to contract validation** (`validate-api-contracts/route.ts`):
   ```typescript
   const API_CONTRACTS = [
     // existing contracts...
     {
       endpoint: '/api/your-new-endpoint',
       method: 'POST',
       payload: { /* test data */ },
       expectedFields: {
         'data.items[].required_field': { type: 'string', required: true }
       }
     }
   ]
   ```

2. **Add to integration test** (`test-booking-integration/route.ts`):
   ```typescript
   const steps = [
     // existing steps...
     {
       name: 'Test Your New Endpoint',
       endpoint: '/api/your-new-endpoint',
       validate: (data) => {
         // validation logic
       }
     }
   ]
   ```

### Adding New Data Schemas:

1. **Update validation schemas** (`dataValidation.ts`):
   ```typescript
   export const API_SCHEMAS = {
     // existing schemas...
     YOUR_NEW_TYPE: {
       primary: {
         field_name: 'string'
       },
       alternatives: {
         field_name: ['fieldName', 'field_name', 'name']
       },
       required: ['field_name']
     }
   }
   ```

## 🎯 Benefits

- **Prevents silent failures** in data processing
- **Catches API changes** that break frontend compatibility  
- **Provides clear debugging** information for developers
- **Maintains data consistency** across API versions
- **Reduces "no availability" support tickets**
- **Enables confident refactoring** with validation safety net

## 📝 Maintenance

- **Review test contracts** when adding new API endpoints
- **Update field alternatives** when API responses change
- **Monitor test results** in CI/CD pipeline
- **Keep error messages** user-friendly and actionable

This comprehensive testing system ensures that data format mismatches are caught early and resolved quickly, preventing user-facing issues in the booking flow.