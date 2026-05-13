# Partner Dashboard Performance Optimization Plan

## 📊 Current Performance Issues

### Load Time Analysis
- **Patient Roster Page**: ~2-3 seconds to load
- **Main Dashboard**: ~1-2 seconds to load
- **Individual Patient Page**: ~1-2 seconds to load

### Root Causes
1. **8+ database queries per page load**
2. **No pagination** - loading ALL patients at once
3. **Fetching unnecessary data** - appointments for all patients even when not displayed
4. **Sequential API calls** instead of parallel
5. **No caching** of static data
6. **Duplicate patient records** causing extra queries

## 🎯 Performance Goals
- Reduce initial load time to **< 500ms**
- Implement smooth pagination/infinite scroll
- Cache static data for instant access
- Optimize database queries

## 🚀 Optimization Plan

### Phase 1: Quick Wins (1-2 hours)
**Impact: 30-40% faster load times**

#### 1.1 Combine Database Queries
- [ ] Merge provider lookups into single query
- [ ] Combine appointment queries using window functions
- [ ] Use database views for complex joins

#### 1.2 Remove Unnecessary Data Fetching
- [ ] Only fetch appointment counts initially (not full appointment data)
- [ ] Load appointment details on-demand when expanded
- [ ] Remove unused fields from queries

#### 1.3 Add Database Indexes
```sql
-- Add these indexes for faster queries
CREATE INDEX idx_appointments_patient_start ON appointments(patient_id, start_time DESC);
CREATE INDEX idx_affiliations_org_status ON patient_organization_affiliations(organization_id, status);
CREATE INDEX idx_assignments_partner_status ON partner_user_patient_assignments(partner_user_id, status);
```

### Phase 2: Pagination & Lazy Loading (2-3 hours)
**Impact: 50-60% faster load times**

#### 2.1 Implement Server-Side Pagination
- [ ] Add pagination to `/api/partner-dashboard/patients`
- [ ] Default to 20 patients per page
- [ ] Add infinite scroll or pagination controls

#### 2.2 Lazy Load Appointment Data
- [ ] Initial load: Only show appointment counts
- [ ] On row expand: Fetch detailed appointment data
- [ ] Cache fetched appointment data

#### 2.3 Virtual Scrolling for Large Lists
- [ ] Implement react-window or similar for virtualization
- [ ] Only render visible rows in viewport

### Phase 3: Caching Strategy (2-3 hours)
**Impact: 70-80% faster subsequent loads**

#### 3.1 Client-Side Caching
- [ ] Cache provider list (changes rarely)
- [ ] Cache payer list (static data)
- [ ] Use SWR or React Query for smart caching

#### 3.2 API Response Caching
- [ ] Add Cache-Control headers to static data
- [ ] Implement stale-while-revalidate pattern
- [ ] Cache partner user data for session

#### 3.3 Optimistic Updates
- [ ] Update UI immediately on user actions
- [ ] Sync with backend asynchronously
- [ ] Handle conflicts gracefully

### Phase 4: Database Optimization (3-4 hours)
**Impact: 85-90% faster queries**

#### 4.1 Create Materialized Views
```sql
-- Pre-computed patient summary view
CREATE MATERIALIZED VIEW mv_patient_roster AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  poa.organization_id,
  poa.consent_on_file,
  COUNT(DISTINCT CASE WHEN a.start_time > NOW() THEN a.id END) as upcoming_count,
  MAX(CASE WHEN a.start_time < NOW() THEN a.start_time END) as last_appointment
FROM patients p
LEFT JOIN patient_organization_affiliations poa ON p.id = poa.patient_id
LEFT JOIN appointments a ON p.id = a.patient_id
GROUP BY p.id, poa.organization_id;

-- Refresh every hour
CREATE INDEX ON mv_patient_roster(organization_id);
```

#### 4.2 Optimize Existing Queries
- [ ] Use JOINs instead of multiple queries
- [ ] Add EXPLAIN ANALYZE to identify slow queries
- [ ] Optimize WHERE clauses with proper indexes

### Phase 5: Frontend Optimizations (1-2 hours)
**Impact: Better perceived performance**

#### 5.1 Loading States
- [ ] Add skeleton loaders for smooth experience
- [ ] Progressive data loading (show what's ready)
- [ ] Optimistic UI updates

#### 5.2 Code Splitting
- [ ] Lazy load modals and heavy components
- [ ] Split bundle by routes
- [ ] Preload critical resources

#### 5.3 Request Deduplication
- [ ] Prevent duplicate API calls
- [ ] Batch similar requests
- [ ] Cancel outdated requests

## 📈 Implementation Priority

### Week 1 - Immediate Impact
1. **Day 1**: Quick wins (Phase 1)
   - Combine queries
   - Add indexes
   - Remove unnecessary data

2. **Day 2-3**: Pagination (Phase 2)
   - Server-side pagination
   - Lazy loading
   - Virtual scrolling

### Week 2 - Long-term Performance
3. **Day 4-5**: Caching (Phase 3)
   - Client caching with SWR
   - API caching headers
   - Optimistic updates

4. **Day 6-7**: Database optimization (Phase 4)
   - Materialized views
   - Query optimization
   - Performance monitoring

## 🔍 Monitoring & Metrics

### Key Metrics to Track
- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Time to Interactive (TTI)
- API response times
- Database query times

### Tools
- Chrome DevTools Performance tab
- React DevTools Profiler
- Database query analyzer
- Application Performance Monitoring (APM)

## 🎉 Expected Results

### Before Optimization
- Initial load: 2-3 seconds
- Subsequent loads: 1-2 seconds
- Database queries: 8+
- Data transferred: ~500KB+

### After Optimization
- Initial load: < 500ms
- Subsequent loads: < 200ms (cached)
- Database queries: 2-3
- Data transferred: ~50KB (paginated)

## 📝 Code Examples

### Example: Optimized Patient Query
```typescript
// Before: Multiple queries
const patients = await getPatients()
const providers = await getProviders(patientIds)
const appointments = await getAppointments(patientIds)

// After: Single optimized query
const patientsWithData = await supabase
  .from('patient_roster_view')
  .select(`
    *,
    provider:providers(id, first_name, last_name),
    appointment_summary:appointment_counts(*)
  `)
  .eq('organization_id', orgId)
  .range(offset, offset + limit - 1)
```

### Example: SWR Caching
```typescript
// Add to patient roster page
import useSWR from 'swr'

const { data: patients, error, mutate } = useSWR(
  `/api/partner-dashboard/patients?page=${page}`,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minute
    fallbackData: initialData
  }
)
```

### Example: Virtual Scrolling
```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={patients.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <PatientRow
      patient={patients[index]}
      style={style}
    />
  )}
</FixedSizeList>
```

## Next Steps

1. **Review this plan with the team**
2. **Prioritize based on current pain points**
3. **Start with Phase 1 quick wins**
4. **Measure improvement after each phase**
5. **Adjust plan based on results**

---

*Last Updated: October 21, 2025*