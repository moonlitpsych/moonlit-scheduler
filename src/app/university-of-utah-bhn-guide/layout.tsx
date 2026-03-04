import type { ReactNode } from 'react'

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://trymoonlit.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Ways to Pay',
      item: 'https://trymoonlit.com/ways-to-pay',
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'University of Utah Behavioral Health Coverage Guide',
      item: 'https://trymoonlit.com/university-of-utah-bhn-guide',
    },
  ],
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  )
}
