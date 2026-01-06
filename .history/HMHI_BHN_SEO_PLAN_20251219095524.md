# HMHI-BHN SEO Implementation Plan

## Moonlit Psychiatry — University of Utah Employee Landing Page & Site-Wide SEO Updates

**Created:** December 2024  
**Status:** Ready for Implementation  
**Estimated Implementation Time:** 2-3 hours

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Problem We're Solving](#the-problem-were-solving)
3. [Keyword Research Strategy](#keyword-research-strategy)
4. [Implementation Overview](#implementation-overview)
5. [Part 1: Dedicated Landing Page](#part-1-dedicated-landing-page)
6. [Part 2: Site-Wide SEO Updates](#part-2-site-wide-seo-updates)
7. [Part 3: Homepage Content Updates](#part-3-homepage-content-updates)
8. [Technical Implementation Details](#technical-implementation-details)
9. [Testing & Verification Checklist](#testing--verification-checklist)
10. [Measurement & Iteration](#measurement--iteration)

---

## Executive Summary

This document outlines the implementation plan for SEO optimization targeting University of Utah employees with HMHI-BHN (Huntsman Mental Health Institute - Behavioral Health Network) insurance coverage.

**Key deliverables:**
1. A dedicated landing page at `/university-of-utah-employees`
2. Updated site-wide SEO metadata
3. Homepage content additions mentioning U of U/HMHI-BHN
4. Structured data for local SEO

**Why this matters:**
- HMHI-BHN patients generate ~2x the profit of Medicaid patients
- ~120,000 lives are covered by HMHI-BHN (U of U employees + families)
- Most employees don't know they have HMHI-BHN—they think they have "Regence" or "UUHP"
- We're solving a real patient problem (avoiding surprise bills) while capturing high-value patients

---

## The Problem We're Solving

### The Knowledge Gap

University of Utah employees with the **Advantage Plan** or the new **U of U Community Plan** have their mental health benefits carved out to HMHI-BHN. However:

1. **Employees don't know this.** Their medical card says "Regence" or "UUHP"
2. **They search with wrong terms.** They look for "psychiatrist Regence Utah"
3. **Providers don't know either.** A practice might accept "Regence" for medical but not be credentialed with HMHI-BHN for behavioral health
4. **Result: Surprise bills.** Patient sees provider, gets billed out-of-network

### Our Competitive Advantage

Moonlit IS credentialed with HMHI-BHN. This was not trivial—we had to meet with their network managers and demonstrate our value proposition (MD/DO-only, after-hours/weekend availability, highly organized).

### The Opportunity

By creating content that:
1. Captures searches from confused U of U employees
2. Educates them about their actual coverage
3. Positions Moonlit as the in-network solution

We solve their problem AND capture the highest-value patient segment.

---

## Keyword Research Strategy

### Primary Target Keywords

Based on user behavior analysis and competitor research:

| Keyword | Search Intent | Priority |
|---------|---------------|----------|
| `psychiatrist university of utah` | Finding care near campus | High |
| `psychiatrist regence utah` | Insurance-based search | High |
| `psychiatrist UUHP` | Insurance-based search | High |
| `university of utah health plans psychiatrist` | Insurance-based search | High |
| `HMHI-BHN psychiatrist` | Direct network search (rare but high intent) | Medium |
| `psychiatrist salt lake city accepting new patients` | Availability search | Medium |
| `university of utah employee mental health` | Benefits-focused search | Medium |
| `regence blue cross psychiatrist salt lake city` | Full carrier name search | Medium |

### Long-Tail Keywords to Target

These appear in page content for semantic SEO:

- "university of utah behavioral health coverage"
- "u of u employee psychiatry"
- "huntsman mental health institute network"
- "regence behavioral health carve out"
- "UUHP mental health provider"
- "university of utah advantage plan psychiatrist"

### How to Validate These Keywords

**Recommended tools to pull actual search volume:**

1. **Google Keyword Planner** (Free with Google Ads account)
   - Create account at ads.google.com
   - Go to Tools → Keyword Planner → "Get search volume and forecasts"
   - Enter keywords above to see monthly search volume in Utah

2. **Google Search Console** (After implementation)
   - Will show actual queries driving traffic to the new page
   - Reveals opportunities we didn't anticipate

3. **Google Trends** (Free, immediate)
   - Compare relative popularity of "psychiatrist regence" vs "psychiatrist selecthealth" in Utah
   - URL: trends.google.com

---

## Implementation Overview

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/university-of-utah-employees/page.tsx` | Dedicated landing page |
| `src/app/university-of-utah-employees/layout.tsx` | Page-specific metadata |

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Update default site metadata |
| `src/app/page.tsx` | Add U of U mention to homepage |
| `src/app/ways-to-pay/page.tsx` | (Optional) Add HMHI-BHN callout |

---

## Part 1: Dedicated Landing Page

### URL Structure

**Primary URL:** `/university-of-utah-employees`

**Rationale:**
- Clear, descriptive, keyword-rich
- Matches user mental model ("I'm a U of U employee looking for care")
- Professional appearance for linking/sharing

**Alternative considered:** `/uofu-psychiatry` — rejected as too abbreviated, less searchable

### Page Content Structure

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (shared site header)                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HERO SECTION                                               │
│  ├─ H1: Psychiatry for University of Utah Employees        │
│  ├─ Subhead: We're in-network with HMHI-BHN                │
│  └─ CTA: Check your coverage & book                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EDUCATION SECTION                                          │
│  ├─ H2: Your mental health coverage isn't what you think   │
│  ├─ Explanation of HMHI-BHN carve-out                       │
│  ├─ Warning about surprise bills                            │
│  └─ "We're one of the few practices credentialed..."        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  INSURANCE CLARITY SECTION                                  │
│  ├─ H2: Which plan do you have?                             │
│  ├─ Advantage Plan → HMHI-BHN (we're in-network ✓)         │
│  ├─ U of U Community Plan → HMHI-BHN (we're in-network ✓)  │
│  └─ CDHP → Regence ValueCare (we're in-network ✓)          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WHY MOONLIT SECTION                                        │
│  ├─ H2: Why U of U employees choose Moonlit                │
│  ├─ MD/DO physicians only (no NPs)                          │
│  ├─ Evening & weekend availability                          │
│  ├─ Telehealth from anywhere in Utah                        │
│  └─ Fast appointments (often within days)                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CTA SECTION                                                │
│  ├─ H2: Ready to book?                                      │
│  ├─ Primary CTA: Book now (→ /book-now with HMHI-BHN pre)  │
│  └─ Secondary: Questions? Contact us                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  FOOTER (shared site footer)                                │
└─────────────────────────────────────────────────────────────┘
```

### Full Page Copy

```markdown
# Psychiatry for University of Utah Employees

**We're in-network with HMHI-BHN — your actual behavioral health plan.**

[Book Now]  [Check Your Coverage]

---

## Your mental health coverage isn't what you think

If you work at the University of Utah, your insurance card probably says **Regence Blue Cross Blue Shield** or **University of Utah Health Plans (UUHP)**. 

But here's what most employees don't realize: **your mental health benefits are managed separately** through the Huntsman Mental Health Institute Behavioral Health Network (HMHI-BHN).

This matters because many practices in Salt Lake City accept "Regence" for medical care but **aren't credentialed with HMHI-BHN** for behavioral health. The result? You show up for your appointment thinking you're covered, and later receive a surprise bill.

**Moonlit Psychiatry is fully credentialed with HMHI-BHN.** When you see us, your visit is covered at your in-network rate—no surprises.

---

## Which plan do you have?

| Your Plan | Your Mental Health Network | Moonlit Status |
|-----------|---------------------------|----------------|
| **Advantage Plan** | HMHI-BHN | ✓ We're in-network |
| **U of U Community Plan** | HMHI-BHN | ✓ We're in-network |
| **Consumer Directed Health Plan (CDHP)** | Regence ValueCare | ✓ We're in-network |

Not sure which plan you have? Check your benefits portal at [benefits.utah.edu](https://benefits.utah.edu) or call HR at (801) 581-7447.

---

## Why U of U employees choose Moonlit

### Physicians only — no nurse practitioners
Every Moonlit provider is an MD or DO. We believe in offering the deepest level of psychiatric training available.

### Evening and weekend appointments
We know your schedule is demanding. That's why we offer appointments outside standard business hours.

### Telehealth across all of Utah
See us from your office, your home, or anywhere in the state. No commute, no parking, no waiting rooms.

### Fast access to care
Most patients are seen within days, not weeks. When you need help, you shouldn't have to wait.

---

## Ready to book?

Moonlit Psychiatry is proud to serve the University of Utah community. We accept HMHI-BHN, Regence, and most major insurance plans.

[Book Your Appointment]

**Questions about coverage?**  
Email: hello@trymoonlit.com  
Phone: (385) 246-2522

---

*Moonlit Psychiatry is located at 1336 S 1100 E, Salt Lake City, UT 84105 — just minutes from the U of U campus.*
```

### SEO Metadata for Landing Page

```typescript
// src/app/university-of-utah-employees/layout.tsx

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Psychiatrist for University of Utah Employees | HMHI-BHN In-Network | Moonlit Psychiatry',
  description: 'U of U employees: Your mental health coverage is through HMHI-BHN, not Regence. Moonlit Psychiatry is in-network with HMHI-BHN. MD/DO physicians only. Evening & weekend appointments available.',
  keywords: [
    'university of utah psychiatrist',
    'HMHI-BHN psychiatrist',
    'psychiatrist regence utah',
    'university of utah health plans psychiatrist',
    'UUHP mental health',
    'psychiatrist salt lake city',
    'u of u employee mental health',
    'huntsman mental health institute network'
  ],
  openGraph: {
    title: 'Psychiatry for University of Utah Employees',
    description: 'We\'re in-network with HMHI-BHN — your actual behavioral health plan. MD/DO physicians. Evening & weekend availability.',
    url: 'https://booking.trymoonlit.com/university-of-utah-employees',
    siteName: 'Moonlit Psychiatry',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Psychiatry for U of U Employees | Moonlit',
    description: 'In-network with HMHI-BHN. MD/DO physicians only. Book today.',
  },
  alternates: {
    canonical: 'https://booking.trymoonlit.com/university-of-utah-employees',
  },
}

export default function UniversityOfUtahLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
```

### React Component Implementation

```tsx
// src/app/university-of-utah-employees/page.tsx

import Link from 'next/link'
import Image from 'next/image'

export default function UniversityOfUtahEmployeesPage() {
  return (
    <div className="bg-[#FEF8F1] min-h-screen">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-12">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl text-[#091747] font-['Newsreader'] font-light leading-tight mb-6">
            Psychiatry for University of Utah Employees
          </h1>
          <p className="text-xl text-[#091747]/80 font-['Newsreader'] mb-8 max-w-2xl mx-auto">
            We're in-network with <strong>HMHI-BHN</strong> — your actual behavioral health plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/book-now"
              className="bg-[#BF9C73] hover:bg-[#A8865F] text-white px-8 py-4 rounded-lg font-['Newsreader'] text-lg transition-all duration-300 hover:shadow-md"
            >
              Book now
            </Link>
            <Link
              href="/ways-to-pay"
              className="bg-[#FEF8F1] hover:bg-white text-[#BF9C73] px-8 py-4 rounded-lg font-['Newsreader'] text-lg border border-[#BF9C73] transition-all duration-300 hover:shadow-md"
            >
              Check your coverage
            </Link>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-6">
            Your mental health coverage isn't what you think
          </h2>
          
          <div className="space-y-4 text-[#091747]/80 font-['Newsreader'] text-lg leading-relaxed">
            <p>
              If you work at the University of Utah, your insurance card probably says <strong>Regence Blue Cross Blue Shield</strong> or <strong>University of Utah Health Plans (UUHP)</strong>.
            </p>
            <p>
              But here's what most employees don't realize: <strong>your mental health benefits are managed separately</strong> through the Huntsman Mental Health Institute Behavioral Health Network (HMHI-BHN).
            </p>
            <p>
              This matters because many practices in Salt Lake City accept "Regence" for medical care but <strong>aren't credentialed with HMHI-BHN</strong> for behavioral health. The result? You show up for your appointment thinking you're covered, and later receive a surprise bill.
            </p>
          </div>

          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-green-800 font-['Newsreader'] text-lg">
                <strong>Moonlit Psychiatry is fully credentialed with HMHI-BHN.</strong> When you see us, your visit is covered at your in-network rate—no surprises.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plan Comparison Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-8 text-center">
          Which plan do you have?
        </h2>
        
        <div className="grid gap-4">
          {/* Advantage Plan */}
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747]">Advantage Plan</h3>
                <p className="text-[#091747]/70 font-['Newsreader']">Mental health network: HMHI-BHN</p>
              </div>
              <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                ✓ We're in-network
              </span>
            </div>
          </div>

          {/* U of U Community Plan */}
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747]">U of U Community Plan</h3>
                <p className="text-[#091747]/70 font-['Newsreader']">Mental health network: HMHI-BHN</p>
              </div>
              <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                ✓ We're in-network
              </span>
            </div>
          </div>

          {/* CDHP */}
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747]">Consumer Directed Health Plan (CDHP)</h3>
                <p className="text-[#091747]/70 font-['Newsreader']">Mental health network: Regence ValueCare</p>
              </div>
              <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                ✓ We're in-network
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-[#091747]/60 font-['Newsreader'] mt-6">
          Not sure which plan you have? Check your benefits portal at{' '}
          <a href="https://benefits.utah.edu" className="text-[#BF9C73] hover:underline" target="_blank" rel="noopener noreferrer">
            benefits.utah.edu
          </a>{' '}
          or call HR at (801) 581-7447.
        </p>
      </section>

      {/* Why Moonlit Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-10 text-center">
          Why U of U employees choose Moonlit
        </h2>
        
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Physicians only
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              Every Moonlit provider is an MD or DO. We believe in offering the deepest level of psychiatric training available.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Evening & weekend appointments
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              We know your schedule is demanding. That's why we offer appointments outside standard business hours.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Telehealth across Utah
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              See us from your office, your home, or anywhere in the state. No commute, no parking, no waiting rooms.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Fast access to care
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              Most patients are seen within days, not weeks. When you need help, you shouldn't have to wait.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-[#091747] rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-white mb-4">
            Ready to book?
          </h2>
          <p className="text-white/80 font-['Newsreader'] text-lg mb-8 max-w-xl mx-auto">
            Moonlit Psychiatry is proud to serve the University of Utah community. We accept HMHI-BHN, Regence, and most major insurance plans.
          </p>
          <Link
            href="/book-now"
            className="inline-block bg-[#BF9C73] hover:bg-[#A8865F] text-white px-10 py-4 rounded-lg font-['Newsreader'] text-lg transition-all duration-300 hover:shadow-lg"
          >
            Book your appointment
          </Link>
          
          <div className="mt-8 pt-8 border-t border-white/20">
            <p className="text-white/70 font-['Newsreader'] mb-2">Questions about coverage?</p>
            <p className="text-white font-['Newsreader']">
              <a href="mailto:hello@trymoonlit.com" className="hover:underline">hello@trymoonlit.com</a>
              {' · '}
              <a href="tel:+13852462522" className="hover:underline">(385) 246-2522</a>
            </p>
          </div>
        </div>
      </section>

      {/* Location Note */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <p className="text-center text-[#091747]/60 font-['Newsreader'] text-sm">
          Moonlit Psychiatry · 1336 S 1100 E, Salt Lake City, UT 84105 · Minutes from the U of U campus
        </p>
      </section>
    </div>
  )
}
```

---

## Part 2: Site-Wide SEO Updates

### Update Root Layout Metadata

```typescript
// src/app/layout.tsx — UPDATED

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Moonlit Psychiatry | MD/DO Psychiatrists in Utah',
    template: '%s | Moonlit Psychiatry'
  },
  description: 'Fast, telehealth psychiatry across Utah and Idaho. MD/DO physicians only. In-network with HMHI-BHN, Regence, SelectHealth, Medicaid, and more. Evening & weekend appointments available.',
  keywords: [
    'psychiatrist utah',
    'psychiatrist salt lake city',
    'telehealth psychiatry utah',
    'HMHI-BHN psychiatrist',
    'psychiatrist regence utah',
    'university of utah employee psychiatrist',
    'online psychiatrist utah',
    'psychiatrist accepting new patients utah'
  ],
  authors: [{ name: 'Moonlit Psychiatry' }],
  creator: 'Moonlit Psychiatry',
  publisher: 'Moonlit Psychiatry',
  openGraph: {
    title: 'Moonlit Psychiatry | MD/DO Psychiatrists in Utah',
    description: 'Fast, telehealth psychiatry across Utah and Idaho. MD/DO physicians only. In-network with major insurance plans.',
    url: 'https://booking.trymoonlit.com',
    siteName: 'Moonlit Psychiatry',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Moonlit Psychiatry',
    description: 'Fast, telehealth psychiatry. MD/DO physicians only.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add these once you have them
    // google: 'your-google-verification-code',
  },
}
```

### Add Structured Data (JSON-LD)

Create a new component for structured data:

```typescript
// src/components/seo/StructuredData.tsx

export function LocalBusinessStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": "https://booking.trymoonlit.com/#organization",
    "name": "Moonlit Psychiatry",
    "description": "Telehealth psychiatry practice serving Utah and Idaho. MD/DO physicians only. In-network with HMHI-BHN, Regence, SelectHealth, and Medicaid.",
    "url": "https://booking.trymoonlit.com",
    "telephone": "+1-385-246-2522",
    "email": "hello@trymoonlit.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "1336 S 1100 E",
      "addressLocality": "Salt Lake City",
      "addressRegion": "UT",
      "postalCode": "84105",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 40.7488,
      "longitude": -111.8579
    },
    "areaServed": [
      {
        "@type": "State",
        "name": "Utah"
      },
      {
        "@type": "State", 
        "name": "Idaho"
      }
    ],
    "medicalSpecialty": "Psychiatry",
    "availableService": [
      {
        "@type": "MedicalProcedure",
        "name": "Psychiatric Evaluation",
        "procedureType": "https://schema.org/DiagnosticProcedure"
      },
      {
        "@type": "MedicalProcedure", 
        "name": "Medication Management",
        "procedureType": "https://schema.org/TherapeuticProcedure"
      }
    ],
    "isAcceptingNewPatients": true,
    "paymentAccepted": [
      "Cash",
      "Credit Card",
      "Insurance"
    ],
    "insuranceAccepted": [
      "HMHI-BHN",
      "Regence Blue Cross Blue Shield",
      "University of Utah Health Plans",
      "SelectHealth",
      "Medicaid",
      "DMBA"
    ],
    "openingHours": "Mo-Su",
    "priceRange": "$$"
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

Add to root layout:

```typescript
// In src/app/layout.tsx, add to the <head>:

import { LocalBusinessStructuredData } from '@/components/seo/StructuredData'

// In the return:
<html lang="en">
  <head>
    <LocalBusinessStructuredData />
  </head>
  <body>
    {/* ... */}
  </body>
</html>
```

---

## Part 3: Homepage Content Updates

### Add U of U Mention to Homepage

Update `src/app/page.tsx` to include a mention of U of U coverage. Add this section after the testimonials:

```tsx
{/* U of U Employee Callout — ADD THIS SECTION */}
<section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
  <div className="bg-[#091747] rounded-2xl p-8 sm:p-10">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
      <div className="text-white">
        <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light mb-3">
          Work at the University of Utah?
        </h2>
        <p className="text-white/80 font-['Newsreader'] text-lg max-w-xl">
          We're in-network with HMHI-BHN — your behavioral health plan. No surprise bills.
        </p>
      </div>
      <Link
        href="/university-of-utah-employees"
        className="inline-flex items-center justify-center bg-[#BF9C73] hover:bg-[#A8865F] text-white px-8 py-4 rounded-lg font-['Newsreader'] text-lg transition-all duration-300 hover:shadow-lg whitespace-nowrap"
      >
        Learn more
        <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  </div>
</section>
```

### Update "Ways to Pay" Description

In the "Multiple ways to pay" section on the homepage, update the description:

```tsx
{/* Current: */}
<p className="text-base text-[#091747]/70 font-['Newsreader'] mb-6 max-w-2xl mx-auto">
  We accept most major insurance plans, cash payments, and Medicaid plans to make your care accessible.
</p>

{/* Updated: */}
<p className="text-base text-[#091747]/70 font-['Newsreader'] mb-6 max-w-2xl mx-auto">
  We accept most major insurance plans including HMHI-BHN, Regence, SelectHealth, Medicaid, and more.
</p>
```

---

## Technical Implementation Details

### File Creation Order

1. **Create structured data component first:**
   ```
   src/components/seo/StructuredData.tsx
   ```

2. **Create landing page files:**
   ```
   src/app/university-of-utah-employees/layout.tsx
   src/app/university-of-utah-employees/page.tsx
   ```

3. **Update existing files:**
   ```
   src/app/layout.tsx (metadata + structured data)
   src/app/page.tsx (U of U callout section)
   ```

### Deployment Considerations

- These are all static/SSG pages — no new API routes needed
- No database changes required
- No new dependencies required
- Should work with existing Vercel deployment

### Pre-Deployment Checklist

- [ ] Verify all internal links work (`/book-now`, `/ways-to-pay`)
- [ ] Check mobile responsiveness
- [ ] Validate structured data at https://validator.schema.org/
- [ ] Test Open Graph preview at https://www.opengraph.xyz/
- [ ] Ensure page loads without JavaScript (for SEO crawlers)

---

## Testing & Verification Checklist

### Functional Testing

- [ ] Landing page loads at `/university-of-utah-employees`
- [ ] All CTAs ("Book now", "Check your coverage") navigate correctly
- [ ] External links open in new tabs (benefits.utah.edu)
- [ ] Phone/email links work on mobile
- [ ] Page is responsive on mobile, tablet, desktop

### SEO Verification

After deployment:

1. **Google Search Console**
   - Submit new URL for indexing
   - Check for crawl errors
   - Monitor search performance

2. **Rich Results Test**
   - URL: https://search.google.com/test/rich-results
   - Paste your landing page URL
   - Verify structured data is detected

3. **Mobile-Friendly Test**
   - URL: https://search.google.com/test/mobile-friendly
   - Ensure page passes

4. **PageSpeed Insights**
   - URL: https://pagespeed.web.dev/
   - Target: 90+ on mobile

### Manual Search Testing (2-4 weeks post-launch)

Search these terms on Google and note Moonlit's position:

- [ ] `psychiatrist university of utah`
- [ ] `psychiatrist HMHI-BHN`
- [ ] `psychiatrist regence utah`
- [ ] `psychiatrist salt lake city accepting new patients`
- [ ] `university of utah employee mental health`

---

## Measurement & Iteration

### Key Metrics to Track

| Metric | Tool | Target |
|--------|------|--------|
| Organic traffic to `/university-of-utah-employees` | Google Analytics / Search Console | 50+ visits/month within 3 months |
| Search impressions for U of U keywords | Search Console | Increasing trend |
| Click-through rate from search | Search Console | >3% for branded terms |
| Conversions (bookings) attributed to page | Track via UTM or referrer | 2-5 bookings/month |
| HMHI-BHN payer mix | Internal data | Shift toward 40% target |

### Iteration Opportunities

Based on Search Console data, consider:

1. **Additional landing pages** for high-volume keywords:
   - `/psychiatrist-regence-utah`
   - `/telehealth-psychiatry-salt-lake-city`

2. **FAQ schema** if "People also ask" shows common questions

3. **Blog content** targeting long-tail keywords:
   - "Does Regence cover psychiatry in Utah?"
   - "How to find an HMHI-BHN provider"

4. **Local SEO** if in-person visits increase:
   - Google Business Profile optimization
   - Local citations (Yelp, Healthgrades)

---

## Appendix: Quick Reference

### Key URLs

| Purpose | URL |
|---------|-----|
| New landing page | `https://booking.trymoonlit.com/university-of-utah-employees` |
| Book now | `https://booking.trymoonlit.com/book-now` |
| Ways to pay | `https://booking.trymoonlit.com/ways-to-pay` |
| U of U Benefits | `https://benefits.utah.edu` |
| HMHI-BHN provider search | `https://healthcare.utah.edu/hmhi/` |

### Contact for HMHI-BHN Questions

- HMHI-BHN team email: HMHIBHN@hsc.utah.edu
- HMHI-BHN phone: (801) 213-1200

### Files Changed Summary

| File | Action |
|------|--------|
| `src/components/seo/StructuredData.tsx` | CREATE |
| `src/app/university-of-utah-employees/layout.tsx` | CREATE |
| `src/app/university-of-utah-employees/page.tsx` | CREATE |
| `src/app/layout.tsx` | MODIFY (metadata + structured data) |
| `src/app/page.tsx` | MODIFY (add U of U callout) |

---

*Document created December 2024 for Moonlit Psychiatry SEO implementation.*