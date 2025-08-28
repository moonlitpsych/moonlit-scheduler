# 🚀 HANDOFF PROMPT FOR NEXT CLAUDE CODE

## 🎯 PROJECT CONTEXT

You are inheriting **Moonlit Scheduler**, a **production-ready professional healthcare website with integrated booking platform**. This is a sophisticated, fully functional system that has been carefully developed and is currently deployed at `booking.trymoonlit.com`.

## 🏆 CURRENT STATUS: COMPLETE & FUNCTIONAL

**This is NOT a development project - it's a MAINTENANCE and ENHANCEMENT project.** The system is:

- ✅ **Fully functional** - All core features working perfectly
- ✅ **Production deployed** - Auto-deploys from main branch to Vercel
- ✅ **Professional grade** - Beautiful UI, robust error handling, EMR integration
- ✅ **Data consistent** - Real Supabase data, no mock data
- ✅ **UX optimized** - Smooth provider selection, auto-loading availability
- ✅ **Double-booking prevention** - Enterprise-level conflict checking

## 📚 ESSENTIAL READING

**CRITICAL**: Read `/Users/macsweeney/moonlit-scheduler/CLAUDE.md` completely before making any changes. This file contains:
- Complete system architecture 
- All working features and their file locations
- Database schema and relationships
- Testing procedures and results
- Common troubleshooting steps
- Development workflow requirements

## ⚠️ DEVELOPMENT WORKFLOW (MANDATORY)

**🚨 ALWAYS TEST LOCALLY FIRST**

```bash
# 1. NEVER push untested changes to main branch
# 2. ALWAYS run local development server first:
npm run dev
# 3. Test thoroughly at http://localhost:3000 or http://localhost:3001  
# 4. Get user confirmation before pushing
# 5. Main branch auto-deploys to production at booking.trymoonlit.com
```

**Rationale**: The user has explicitly requested this workflow after experiencing deployment issues.

## 🔧 KEY TECHNICAL DETAILS

### **Architecture Stack**
- **Framework**: Next.js 15.4.5 with TypeScript
- **Styling**: Tailwind CSS with Newsreader Google Font
- **Database**: Supabase PostgreSQL with real-time features
- **EMR Integration**: IntakeQ API with conflict checking  
- **Email**: Resend API (optional, logs to console as fallback)
- **Deployment**: Vercel with domain routing

### **Critical Files to Understand**
- `src/components/booking/views/CalendarView.tsx` - Main booking interface
- `src/app/api/patient-booking/merged-availability/route.ts` - Availability API
- `src/app/api/demo/enhanced-providers/route.ts` - Provider data API
- `src/lib/services/intakeQService.ts` - EMR integration
- `src/components/booking/BookingFlow.tsx` - Multi-step booking process

### **Database Key Tables**
- `providers` - Healthcare provider information
- `provider_payer_networks` - Insurance acceptance relationships
- `provider_availability_cache` - Available time slots
- `appointments` - Booking records with EMR sync
- `payers` - Insurance provider information

## 🎨 RECENT MAJOR IMPROVEMENTS (August 27, 2025)

**Provider Selection UX Enhancements**:
- ✅ Fixed race conditions in provider selection
- ✅ Auto-loading of soonest available appointment slots
- ✅ Removed all mock/demo data for real Supabase consistency
- ✅ Better default messaging ("Accepting New Patients")
- ✅ Reliable provider-specific availability filtering

**Technical Fixes Applied**:
- Fixed `data.providers` vs `data.data.providers` response structure issue
- Added explicit provider ID passing to prevent async state issues
- Enhanced debugging logs for troubleshooting
- Improved error handling for edge cases

## 🚨 CRITICAL WARNINGS

### **What NOT to Touch**
- **IntakeQ integration** - Working perfectly, very sensitive
- **Double-booking prevention logic** - Mission critical, thoroughly tested
- **Database schema** - Stable and populated with real data
- **Email notification system** - Working with fallback logging
- **Provider-payer relationship logic** - Complex but working

### **When Making Changes**
- **Always test the full booking flow end-to-end**
- **Verify provider selection works for all 6 providers**
- **Check console logs for any errors**  
- **Test both "By Availability" and "By Practitioner" modes**
- **Ensure calendar shows real availability data**

## 🛠️ COMMON TASKS YOU MIGHT BE ASKED

### **Likely Enhancement Requests**
1. **UI/UX improvements** - Styling, layout, responsive design
2. **New booking features** - Additional steps, validation, etc.
3. **Provider management** - Adding new providers, updating info
4. **Email template customization** - Modifying notification content
5. **Analytics/reporting** - Adding booking metrics, dashboards

### **Debugging Approach**
1. **Check browser console** for JavaScript errors
2. **Check server logs** for API errors (npm run dev output)
3. **Verify Supabase data** - Use Supabase dashboard
4. **Test IntakeQ integration** - Check IntakeQ dashboard
5. **Review CLAUDE.md troubleshooting section**

### **Environment Setup**
```bash
# Required environment variables in .env.local:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key  
SUPABASE_SERVICE_KEY=your_service_key
INTAKEQ_API_KEY=your_intakeq_key
RESEND_API_KEY=your_resend_key  # Optional
```

## 🎯 SUCCESS METRICS

**System is working correctly when**:
- All 6 providers show in "By Practitioner" mode
- Availability loads automatically when provider is selected  
- Calendar shows real time slots (not "no availability" errors)
- Booking flow completes end-to-end without errors
- Appointments appear in IntakeQ dashboard
- Admin emails are sent/logged
- No double-booking conflicts occur

## 💡 PRODUCTIVITY TIPS

1. **Use the existing debugging logs** - Extensive console logging already in place
2. **Reference CLAUDE.md frequently** - It contains all the answers
3. **Test with Utah Medicaid Fee-for-Service** - The main test payer
4. **Check the 6 providers**: Travis, Tatiana, C. Rufus, Merrick, Doug, Anthony
5. **Use browser dev tools** - Network tab shows API calls and responses

## 🙏 FINAL NOTES

**The user (C. Rufus Sweeney) is highly technical and appreciates**:
- Detailed explanations of changes made
- Systematic debugging approaches
- Testing locally before pushing
- Clear commit messages with context
- Proactive communication about what's working/not working

**This has been a collaborative and successful project.** The system is sophisticated, well-documented, and fully functional. Your role is to maintain this quality while adding requested enhancements.

**Key phrase to remember**: "ALWAYS test locally first before pushing to main branch"

---

*Handoff created: August 27, 2025*  
*System Status: Production Ready* ✅  
*Ready for next development iteration!* 🚀