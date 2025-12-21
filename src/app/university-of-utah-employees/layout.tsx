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

// FAQ Schema for rich results
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is HMHI-BHN?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "HMHI-BHN stands for Huntsman Mental Health Institute Behavioral Health Network. It is the insurance network that manages mental health benefits for University of Utah employees, even though your insurance card may say Regence or UUHP."
      }
    },
    {
      "@type": "Question",
      "name": "Does Moonlit accept HMHI-BHN insurance?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Moonlit Psychiatry is fully credentialed and in-network with HMHI-BHN. When you see us, your visit is covered at your in-network rate."
      }
    },
    {
      "@type": "Question",
      "name": "I have Regence through U of U. Can I see Moonlit?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. If you're a U of U employee with Regence, your mental health benefits are actually managed by HMHI-BHN—and Moonlit is in-network with HMHI-BHN. You can book an appointment with us and be covered at your in-network rate."
      }
    },
    {
      "@type": "Question",
      "name": "Why do I get surprise bills from other psychiatrists?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Many psychiatry practices in Utah accept Regence for medical care but are not credentialed with HMHI-BHN for behavioral health. Since U of U employee mental health benefits are carved out to HMHI-BHN, seeing a provider who isn't in the HMHI-BHN network results in out-of-network charges."
      }
    },
    {
      "@type": "Question",
      "name": "How quickly can I get an appointment?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Most patients are seen within days, not weeks or months. We offer evening and weekend appointments to fit your schedule."
      }
    }
  ]
}

// Breadcrumb Schema for navigation
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://booking.trymoonlit.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "University of Utah Employees",
      "item": "https://booking.trymoonlit.com/university-of-utah-employees"
    }
  ]
}

export default function UniversityOfUtahLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  )
}
