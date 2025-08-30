# 🏗️ Moonlit Scheduler - Unified App Architecture Plan

## 🎯 **Current State Assessment**

### **✅ What We Have (Working)**
- **Professional Homepage** (`/`) - Elegant landing with testimonials, CTA buttons
- **Complete Booking Flow** (`/book`) - 7-step patient booking system  
- **Provider Dashboard** (`/dashboard/*`) - Full availability management system
- **Provider Signup** (`/auth/provider-signup`) - Complete onboarding flow
- **Authentication System** - Supabase auth with role-based access
- **Database Integration** - Real-time sync between all systems
- **EMR Integration** - IntakeQ appointment creation
- **Email Notifications** - Admin alerts for bookings

### **🔧 What Needs Organization**
- **Navigation flow** between patient and provider experiences
- **Role-based routing** (patients vs providers vs admins)
- **Consistent header/navigation** across all pages
- **Clear user journey paths** from landing to completion

---

## 🗺️ **Proposed Unified Architecture**

### **🏠 PATIENT JOURNEY**
```
Landing Page (/) 
    ↓ [Book Now CTA]
Booking Flow (/book)
    ↓ [Complete booking]
Confirmation Page (/booking/confirmation)
    ↓ [Optional]
Provider Directory (/providers) 
Insurance Information (/insurance)
About/Services (/about)
```

### **🩺 PROVIDER JOURNEY**
```
Landing Page (/) 
    ↓ [Provider Login/Join CTA]
Provider Login (/auth/login)
    ↓ [Authenticate]
Provider Dashboard (/dashboard)
    ├── Availability (/dashboard/availability)
    ├── Appointments (/dashboard/appointments) 
    ├── Virtual Visits (/dashboard/visits) [Future - Google Meet]
    ├── Profile (/dashboard/profile)
    └── Settings (/dashboard/settings)
```

### **⚙️ ADMIN JOURNEY**
```
Staff Login (/staff-login)
    ↓ [Authenticate]
Admin Dashboard (/admin)
    ├── Provider Management (/admin/providers)
    ├── Appointment Oversight (/admin/appointments)
    ├── System Analytics (/admin/analytics)
    └── Settings (/admin/settings)
```

---

## 🧭 **Navigation & Header Strategy**

### **🌟 Smart Contextual Header**

#### **For Anonymous Users (Landing/Marketing)**
```
[LOGO] Home | Providers | Insurance | About | Book Now | Provider Login
```

#### **For Authenticated Providers**
```
[LOGO] Dashboard | Appointments | Availability | Virtual Visits | [Profile Menu ↓]
```

#### **For Patients (During Booking)**
```
[LOGO] ← Back to Home | Booking Progress (Step X of 7) | Need Help?
```

### **🎯 Role-Based Routing Logic**
```javascript
// Middleware/Layout logic
if (user?.role === 'provider') {
  defaultRoute = '/dashboard/availability'
  showProviderNav = true
} else if (user?.role === 'admin') {
  defaultRoute = '/admin/dashboard'
  showAdminNav = true
} else {
  // Anonymous or patient
  defaultRoute = '/'
  showPatientNav = true
}
```

---

## 📱 **Page Organization Strategy**

### **🎨 Layout Hierarchy**
```
src/app/
├── layout.tsx (Root - auth, theme, globals)
├── page.tsx (Landing - marketing site)
├── booking-layout.tsx (Booking flow wrapper)
├── dashboard-layout.tsx (Provider dashboard wrapper)
└── admin-layout.tsx (Admin dashboard wrapper)

Components:
├── navigation/
│   ├── PublicHeader.tsx (Marketing site)  
│   ├── DashboardHeader.tsx (Provider)
│   ├── BookingHeader.tsx (Patient booking)
│   └── AdminHeader.tsx (Admin)
├── layouts/
│   ├── MarketingLayout.tsx
│   ├── DashboardLayout.tsx  
│   └── BookingLayout.tsx
```

### **🗂️ Route Structure**
```
/ (Marketing/Landing)
├── /about
├── /providers  
├── /insurance
└── /contact

/book (Patient Booking)
├── /book/welcome
├── /book/payer
├── /book/calendar
├── /book/insurance-info
├── /book/roi
├── /book/summary
└── /book/confirmation

/auth (Authentication)
├── /auth/login
├── /auth/provider-signup
└── /auth/reset-password

/dashboard (Provider Portal)
├── /dashboard/availability
├── /dashboard/appointments
├── /dashboard/visits (Google Meet integration)
├── /dashboard/profile
└── /dashboard/settings

/admin (Admin Portal)
├── /admin/providers
├── /admin/appointments
├── /admin/analytics
└── /admin/settings

/staff-login (Admin login)
```

---

## 🎭 **User Experience Flows**

### **🏥 Patient Flow (Primary)**
```
1. Land on homepage (/)
2. Read about services, see testimonials
3. Click "Book Appointment" CTA
4. Complete 7-step booking flow (/book/*)
5. Get confirmation + appointment details
6. Optional: Browse providers (/providers)
```

### **👩‍⚕️ Provider Flow (Secondary)**
```
1. Land on homepage (/)
2. Click "Provider Login" or "Join as Provider"
3. Login/signup (/auth/*)
4. Redirect to dashboard (/dashboard/availability)
5. Manage schedule, view appointments
6. Future: Launch Google Meet calls (/dashboard/visits)
```

### **🔧 Admin Flow (Tertiary)**
```
1. Direct to staff login (/staff-login)
2. Authenticate with admin credentials
3. Access admin dashboard (/admin)
4. Manage providers, oversee system
```

---

## 🎨 **Design System Consistency**

### **🌈 Visual Hierarchy**
- **Marketing Pages**: Full-width, elegant, testimonial-heavy
- **Booking Flow**: Focused, step-by-step, minimal distractions
- **Provider Dashboard**: Professional, functional, data-rich
- **Admin Portal**: Utilitarian, information-dense, powerful tools

### **🎭 Component Reuse Strategy**
```
Shared Components:
├── Button (variants: primary, secondary, outline)
├── Card (variants: marketing, dashboard, booking)
├── Input/Form (variants: marketing, dashboard)
├── Modal/Dialog (universal)
└── Loading/Error states (universal)

Page-Specific:
├── Marketing: Hero, Testimonials, CTA sections
├── Booking: Progress, StepWrapper, NavigationButtons
├── Dashboard: Sidebar, Cards, Calendar widgets
└── Admin: Tables, Charts, Management tools
```

---

## 🔄 **Integration Points**

### **🔗 Cross-System Data Flow**
```
Patient Books Appointment
    ↓
Creates record in Supabase
    ↓
Appears in Provider Dashboard
    ↓
Syncs with IntakeQ EMR
    ↓
Enables Google Meet integration
```

### **🔔 Notification System**
```
New Appointment → Email to Admin + Provider
Schedule Change → Email to affected parties
Virtual Visit Ready → Notification to both parties
System Issues → Admin alerts
```

---

## 🚀 **Implementation Plan**

### **Phase 1: Navigation & Routing**
1. ✅ Create unified header components for each user type
2. ✅ Implement role-based routing middleware
3. ✅ Update existing pages to use correct layouts
4. ✅ Test user flows end-to-end

### **Phase 2: Provider Dashboard Enhancement** 
1. ✅ Add appointment viewing to dashboard
2. ✅ Implement Google Meet integration page
3. ✅ Enhanced profile management
4. ✅ Settings and preferences

### **Phase 3: Admin Portal**
1. ✅ Provider management interface
2. ✅ System analytics and reporting
3. ✅ Appointment oversight tools
4. ✅ Configuration management

### **Phase 4: Polish & Enhancement**
1. ✅ Consistent styling across all pages
2. ✅ Performance optimization
3. ✅ Mobile responsiveness verification
4. ✅ User testing and feedback integration

---

## 🎯 **Success Metrics**

### **🏥 Patient Experience**
- ✅ **Clear path** from landing to booking completion
- ✅ **No confusion** about what to do next
- ✅ **Consistent branding** throughout journey
- ✅ **Mobile-friendly** on all devices

### **👩‍⚕️ Provider Experience**  
- ✅ **Easy onboarding** from signup to first availability set
- ✅ **Efficient workflow** for managing schedule
- ✅ **Clear visibility** into upcoming appointments
- ✅ **Seamless virtual visit** launching

### **🔧 Admin Experience**
- ✅ **Complete system oversight**
- ✅ **Provider management** tools
- ✅ **Analytics and insights**
- ✅ **Configuration control**

---

## 🎪 **The Vision: Unified Moonlit Experience**

### **🌟 One Cohesive Platform**
Instead of separate apps, users experience:
- **Seamless transitions** between sections
- **Consistent design language** throughout
- **Role-aware interfaces** that show relevant features
- **Integrated data** flowing between all systems

### **🎭 Multiple Personas, One Platform**
- **Patients**: Focus on booking and information
- **Providers**: Focus on schedule and patient management  
- **Admins**: Focus on system management and oversight

---

## ✅ **Ready to Build?**

This architecture plan gives us:
1. **Clear user journeys** for each persona
2. **Organized code structure** that scales
3. **Consistent design system** across features
4. **Integration points** between all components
5. **Future-ready foundation** for Google Meet and more

**Should we start with Phase 1: Navigation & Routing to unify the user experience?**