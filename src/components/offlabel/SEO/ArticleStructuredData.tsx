interface Reference {
  authors: string
  title: string
  journal: string | null
  year: number
  doi: string | null
  pmid: string | null
  url: string | null
}

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
  references?: Reference[]
}

export function ArticleStructuredData({
  title,
  description,
  url,
  publishedAt,
  updatedAt,
  author,
  keyTakeaway,
  references = [],
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
    // Schema.org citation property for academic references
    ...(references.length > 0 && {
      citation: references.map((ref) => ({
        '@type': 'ScholarlyArticle',
        name: ref.title,
        author: ref.authors,
        datePublished: ref.year.toString(),
        ...(ref.journal && { isPartOf: { '@type': 'Periodical', name: ref.journal } }),
        ...(ref.doi && { identifier: { '@type': 'PropertyValue', propertyID: 'doi', value: ref.doi } }),
        ...(ref.doi && { url: `https://doi.org/${ref.doi}` }),
        ...(ref.pmid && { sameAs: `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/` }),
      })),
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
