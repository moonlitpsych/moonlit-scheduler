import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPost, incrementViewCount } from '@/lib/offlabel/queries'
import { AuthorByline } from '@/components/offlabel/AuthorByline'
import { ArticleContent } from '@/components/offlabel/ArticleContent'
import { ArticleStructuredData } from '@/components/offlabel/SEO/ArticleStructuredData'
import { seriesConfig } from '@/lib/offlabel/types'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    return {
      title: 'Article Not Found',
    }
  }

  const baseUrl = 'https://booking.trymoonlit.com'

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: post.author ? [post.author.name] : undefined,
      url: `${baseUrl}/offlabel/${post.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    notFound()
  }

  // Increment view count (fire and forget)
  incrementViewCount(slug).catch(console.error)

  const baseUrl = 'https://booking.trymoonlit.com'

  return (
    <>
      {/* Structured Data */}
      {post.author && (
        <ArticleStructuredData
          title={post.title}
          description={post.excerpt}
          url={`${baseUrl}/offlabel/${post.slug}`}
          publishedAt={post.published_at || post.created_at}
          updatedAt={post.updated_at}
          author={{
            name: post.author.name,
            credentials: post.author.credentials,
            slug: post.author.slug,
          }}
          keyTakeaway={post.key_takeaway}
          references={post.references?.map((ref) => ({
            authors: ref.authors,
            title: ref.title,
            journal: ref.journal,
            year: ref.year,
            doi: ref.doi,
            pmid: ref.pmid,
            url: ref.url,
          }))}
        />
      )}

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Series Badge */}
        {post.series && (
          <div className="mb-6">
            <Link
              href={`/offlabel?series=${post.series}`}
              className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${seriesConfig[post.series].color} hover:opacity-80 transition-opacity`}
            >
              {seriesConfig[post.series].label}
            </Link>
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-bold font-['Newsreader'] text-[#091747] mb-3 leading-tight">
          {post.title}
        </h1>

        {/* Subtitle */}
        {post.subtitle && (
          <p className="text-xl sm:text-2xl text-[#091747]/70 font-['Newsreader'] italic mb-6 leading-relaxed">
            {post.subtitle}
          </p>
        )}

        {/* Author Byline */}
        {post.author && (
          <div className="mb-8">
            <AuthorByline
              name={post.author.name}
              credentials={post.author.credentials}
              slug={post.author.slug}
              avatarUrl={post.author.avatar_url}
              publishedAt={post.published_at}
              showLink={true}
            />
          </div>
        )}

        {/* Key Takeaway */}
        {post.key_takeaway && (
          <div className="key-takeaway bg-[#FEF8F1] border-l-4 border-[#BF9C73] p-6 mb-10 rounded-r-lg">
            <p className="text-sm font-medium text-[#BF9C73] uppercase tracking-wide mb-2">
              Key Takeaway
            </p>
            <p className="text-lg text-[#091747] font-['Newsreader']">
              {post.key_takeaway}
            </p>
          </div>
        )}

        {/* Article Content */}
        <ArticleContent content={post.content} />

        {/* References Section */}
        {post.references && post.references.length > 0 && (
          <section className="mt-12 pt-8 border-t border-stone-200">
            <h2 className="text-2xl font-semibold font-['Newsreader'] text-[#091747] mb-6">
              References
            </h2>
            <ol className="list-decimal pl-6 space-y-4">
              {post.references.map((ref) => (
                <li key={ref.id} className="text-[#091747]/80 font-['Newsreader']">
                  <span className="font-medium">{ref.authors}</span>.{' '}
                  {ref.title}.{' '}
                  {ref.journal && <em>{ref.journal}</em>}
                  {ref.journal && '. '}
                  {ref.year}.
                  {ref.doi && (
                    <>
                      {' '}
                      <a
                        href={`https://doi.org/${ref.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#BF9C73] hover:underline"
                      >
                        doi:{ref.doi}
                      </a>
                    </>
                  )}
                  {ref.pmid && (
                    <>
                      {' '}
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#BF9C73] hover:underline"
                      >
                        PMID:{ref.pmid}
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Topics */}
        {post.topics && post.topics.length > 0 && (
          <div className="mt-8 pt-6 border-t border-stone-200">
            <div className="flex flex-wrap gap-2">
              {post.topics.map((topic) => (
                <span
                  key={topic}
                  className="px-3 py-1 bg-stone-100 text-[#091747]/70 text-sm rounded-full"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>
    </>
  )
}
