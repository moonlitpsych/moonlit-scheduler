# Athena Health Production Readiness Checklist

## 🔐 Developer Portal Configuration

### Required Scopes for Production App
Ensure your app in the Developer Portal has these scopes enabled:

#### Core API Scopes
- `athena/service/Athenanet.MDP.*` ✅ (Already working)
- `user/Provider.read` - Read provider information
- `user/Patient.write` - Create and update patients
- `user/Patient.read` - Read patient information
- `user/Appointment.write` - Create and modify appointments
- `user/Appointment.read` - Read appointment data
- `user/Scheduling.write` - Access scheduling functionality
- `user/Scheduling.read` - Read scheduling data

#### Optional Advanced Scopes
- `user/Insurance.read` - Read insurance information
- `user/Chart.read` - Access patient charts (if needed)
- `user/Billing.read` - Read billing information (if needed)

### Webhook Configuration
1. **Webhook URL**: Set up webhook endpoint in portal
   - Sandbox: `https://your-staging-domain.com/api/webhooks/athena`
   - Production: `https://your-production-domain.com/api/webhooks/athena`

2. **Events to Subscribe To**:
   - `appointment.created`
   - `appointment.updated`
   - `appointment.cancelled`
   - `patient.created`
   - `patient.updated`
   - `provider.updated`

### Rate Limits
- **Current Sandbox**: 5 requests/second (configurable in .env)
- **Production**: Verify limits with Athena support
- **Implement**: Exponential backoff for rate limit handling ✅

## 🚀 Pre-Production Testing

### 1. Provider Data Setup
```bash
# Test provider sync
curl -X POST http://localhost:3000/api/athena/test-connection \
  -H "Content-Type: application/json" \
  -d '{"action": "sync-providers"}'
```

### 2. Department Mapping
Add real departments to your Supabase database:
```sql
-- Example departments (update with real Athena department IDs)
INSERT INTO departments (athena_department_id, name, specialty) VALUES
('1', 'Psychiatry', 'Mental Health'),
('2', 'Psychology', 'Counseling'),
('3', 'Teletherapy', 'Remote Sessions');
```

### 3. Appointment Type Mapping
Configure appointment types in Athena portal:
- `consultation` - Initial consultation
- `followup` - Follow-up appointment  
- `therapy` - Therapy session
- `evaluation` - Psychological evaluation

## 🔧 Environment Variables for Production

### Required Production Variables
```bash
# Production Athena Configuration
ATHENA_CLIENT_ID=your_production_client_id
ATHENA_CLIENT_SECRET=your_production_client_secret
ATHENA_ENVIRONMENT=production
ATHENA_BASE_URL=https://api.athenahealth.com  # No "preview"
ATHENA_TOKEN_URL=https://api.athenahealth.com/oauth2/v1/token
ATHENA_PRACTICE_ID=your_production_practice_id

# Production webhook security
ATHENA_WEBHOOK_SECRET=strong_random_webhook_secret
ATHENA_WEBHOOK_URL=https://your-domain.com/api/webhooks/athena

# Rate limiting for production
ATHENA_REQUESTS_PER_SECOND=10
ATHENA_MAX_RETRIES=5
```

## 📋 Solution Validation Requirements

Based on the Athena email, you need to complete Solution Validation before production:

### 1. Technical Specification Document
Create a tech spec documenting:
- **Integration Overview**: How your app uses Athena APIs
- **Data Flow**: Patient booking → Athena appointment creation
- **Security Measures**: Authentication, data encryption, HIPAA compliance
- **Error Handling**: Retry logic, rollback mechanisms
- **Monitoring**: Logging and alerting setup

### 2. Security Review Items
- ✅ OAuth2 implementation with secure token storage
- ✅ HTTPS enforcement for all API calls
- ✅ Webhook signature verification
- ✅ No API keys in client-side code
- ✅ Proper error handling without exposing sensitive data

### 3. Testing Documentation
Document test cases for:
- ✅ Successful appointment creation
- ✅ Failed appointment handling with rollback
- ✅ Provider synchronization
- ✅ Webhook event processing
- ✅ Rate limit handling

## 🏥 Production Deployment Steps

### Phase 1: Staging Environment
1. Deploy to staging with production-like Athena sandbox
2. Test with real provider data from Athena
3. Validate webhook events
4. Performance testing with concurrent bookings

### Phase 2: Solution Validation Submission
1. Submit tech spec to Athena via Customer Support
2. Reference Service ID: PROJ-294665
3. Demonstrate sandbox testing results
4. Address any Athena feedback

### Phase 3: Production Credentials
1. Receive production OAuth2 credentials
2. Update environment variables
3. Deploy to production
4. Monitor initial appointments

## 🔍 Monitoring & Maintenance

### Key Metrics to Track
- Athena API response times
- Authentication token refresh success rate
- Appointment creation success/failure rate
- Webhook event processing delays
- Provider sync frequency and success

### Alerting Setup
- Failed Athena API calls
- Authentication failures
- Webhook signature verification failures
- High error rates or timeouts

## ✅ Current Status
- [x] Athena authentication working
- [x] API integration complete
- [x] Appointment booking logic built
- [x] Webhook handlers implemented
- [x] Error handling and rollbacks
- [ ] Real provider data testing
- [ ] Production scopes configuration
- [ ] Solution validation submission
- [ ] Production credentials and deployment