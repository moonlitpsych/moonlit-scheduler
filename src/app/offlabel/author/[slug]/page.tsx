import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getAuthor } from '@/lib/offlabel/queries'
import { ArticleCard } from '@/components/offlabel/ArticleCard'
import Link from 'next/link'
import Image from 'next/image'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const author = await getAuthor(slug)

  if (!author) {
    return {
      title: 'Author Not Found',
    }
  }

  return {
    title: `${author.name}, ${author.credentials}`,
    description: author.bio || `Articles by ${author.name}, ${author.credentials}`,
    openGraph: {
      title: `${author.name}, ${author.credentials}`,
      description: author.bio || `Articles by ${author.name}, ${author.credentials}`,
      type: 'profile',
    },
  }
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params
  const author = await getAuthor(slug)

  if (!author) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Author Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12">
        {/* Author Photo */}
        {author.image_url ? (
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden flex-shrink-0">
            <Image
              src={author.image_url}
              alt={author.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#2C5F6F] to-[#1A3A47] flex items-center justify-center flex-shrink-0">
            <span className="text-3xl sm:text-4xl font-bold text-white font-['Newsreader']">
              {author.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Author Info */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold font-['Newsreader'] text-[#091747] mb-1">
            {author.name}, {author.credentials}
          </h1>
          {author.bio && (
            <p className="text-lg text-[#091747]/70 font-['Newsreader'] mt-3 max-w-2xl">
              {author.bio}
            </p>
          )}
        </div>
      </div>

      {/* Soft CTA */}
      <div className="bg-[#FEF8F1] rounded-xl p-6 mb-12">
        <p className="text-[#091747]/80 font-['Newsreader'] text-lg">
          {author.name.split(' ')[0]} practices at Moonlit Psychiatry in Salt Lake City, Utah.{' '}
          <Link
            href="https://booking.trymoonlit.com"
            className="text-[#BF9C73] hover:underline"
          >
            Book an appointment
          </Link>
          .
        </p>
      </div>

      {/* Articles Section */}
      <section>
        <h2 className="text-2xl font-semibold font-['Newsreader'] text-[#091747] mb-6">
          Articles by {author.name.split(' ')[0]}
        </h2>

        {author.posts && author.posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {author.posts.map((post) => (
              <ArticleCard
                key={post.id}
                title={post.title}
                slug={post.slug}
                excerpt={post.excerpt}
                author={{
                  name: author.name,
                  credentials: author.credentials,
                  slug: author.slug,
                }}
                publishedAt={post.published_at}
                series={post.series}
              />
            ))}
          </div>
        ) : (
          <p className="text-[#091747]/60 font-['Newsreader'] text-lg">
            No articles published yet. Check back soon!
          </p>
        )}
      </section>
    </div>
  )
}
