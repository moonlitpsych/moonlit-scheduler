import { getPosts } from '@/lib/offlabel/queries'
import { ArticleCard } from '@/components/offlabel/ArticleCard'
import type { PostSeries } from '@/lib/offlabel/types'
import { seriesConfig } from '@/lib/offlabel/types'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ series?: string }>
}

export default async function OffLabelHomePage({ searchParams }: PageProps) {
  const params = await searchParams
  const seriesFilter = params.series as PostSeries | undefined

  // Validate series filter
  const validSeries =
    seriesFilter && ['off-label', 'clinical-wisdom', 'literature-renaissance'].includes(seriesFilter)
      ? (seriesFilter as PostSeries)
      : undefined

  const posts = await getPosts({ series: validSeries })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl sm:text-6xl font-light font-['Newsreader'] text-[#091747] mb-6 tracking-tight">
          Off-Label
        </h1>
        <p className="text-lg sm:text-xl text-[#091747]/60 font-['Newsreader'] font-light max-w-2xl mx-auto leading-relaxed">
          Stories of psychiatric treatments discovered by accident, rediscovered from history,
          or used in ways their inventors never imagined.
        </p>
      </div>

      {/* Series Filter */}
      <div className="flex flex-wrap gap-2 justify-center mb-10">
        <Link
          href="/offlabel"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !validSeries
              ? 'bg-[#091747] text-white'
              : 'bg-stone-100 text-[#091747]/70 hover:bg-stone-200'
          }`}
        >
          All
        </Link>
        {(Object.entries(seriesConfig) as [PostSeries, { label: string; color: string }][]).map(
          ([key, config]) => (
            <Link
              key={key}
              href={`/offlabel?series=${key}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                validSeries === key
                  ? 'bg-[#091747] text-white'
                  : 'bg-stone-100 text-[#091747]/70 hover:bg-stone-200'
              }`}
            >
              {config.label}
            </Link>
          )
        )}
      </div>

      {/* Articles Grid */}
      {posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <ArticleCard
              key={post.id}
              title={post.title}
              subtitle={post.subtitle}
              slug={post.slug}
              excerpt={post.excerpt}
              author={
                post.author
                  ? {
                      name: post.author.name,
                      credentials: post.author.credentials,
                      slug: post.author.slug,
                    }
                  : null
              }
              publishedAt={post.published_at}
              series={post.series}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-[#091747]/60 font-['Newsreader'] text-lg">
            {validSeries
              ? `No articles in the ${seriesConfig[validSeries].label} series yet.`
              : 'No articles published yet. Check back soon!'}
          </p>
        </div>
      )}
    </div>
  )
}
