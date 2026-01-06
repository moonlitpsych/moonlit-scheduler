interface ArticleStructuredDataProps {
  title: string
  description: string
  url: string
  publishedAt: string
  updatedAt: string
  author: {
    name: string
    credentials: string
    slug: string
  }
  keyTakeaway?: string | null
}

export function ArticleStructuredData({
  title,
  description,
  url,
  publishedAt,
  updatedAt,
  author,
  keyTakeaway,
}: ArticleStructuredDataProps) {
  const baseUrl = 'https://booking.trymoonlit.com'

  // Schema.org MedicalWebPage structured data
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline: title,
    description: description,
    url: url,
    datePublished: publishedAt,
    dateModified: updatedAt,
    author: {
      '@type': 'Person',
      name: author.name,
      jobTitle: 'Psychiatrist',
      credential: author.credentials,
      url: `${baseUrl}/offlabel/author/${author.slug}`,
      worksFor: {
        '@type': 'MedicalBusiness',
        name: 'Moonlit Psychiatry',
        url: baseUrl,
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'Moonlit Psychiatry',
      url: baseUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.key-takeaway', 'article h1', 'article h2'],
    },
    ...(keyTakeaway && {
      abstract: keyTakeaway,
    }),
  }

  // Breadcrumb structured data
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Off-Label',
        item: `${baseUrl}/offlabel`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title,
        item: url,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  )
}
