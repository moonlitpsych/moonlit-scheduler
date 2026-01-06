import Link from 'next/link'
import { AuthorByline } from './AuthorByline'
import type { PostSeries } from '@/lib/offlabel/types'
import { seriesConfig } from '@/lib/offlabel/types'

interface ArticleCardProps {
  title: string
  slug: string
  excerpt: string
  author: {
    name: string
    credentials: string
    slug: string
  } | null
  publishedAt: string | null
  series: PostSeries | null
}

export function ArticleCard({
  title,
  slug,
  excerpt,
  author,
  publishedAt,
  series,
}: ArticleCardProps) {
  return (
    <article className="group">
      <Link
        href={`/offlabel/${slug}`}
        className="block bg-white rounded-xl border-2 border-stone-200 p-6 transition-all duration-300 hover:shadow-lg hover:border-[#BF9C73]/50 hover:-translate-y-1"
      >
        {/* Series Badge */}
        {series && (
          <div className="mb-3">
            <span
              className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${seriesConfig[series].color}`}
            >
              {seriesConfig[series].label}
            </span>
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl font-bold font-['Newsreader'] text-[#091747] mb-2 group-hover:text-[#BF9C73] transition-colors">
          {title}
        </h2>

        {/* Excerpt */}
        <p className="text-[#091747]/70 font-['Newsreader'] text-base mb-4 line-clamp-3">
          {excerpt}
        </p>

        {/* Author Byline */}
        {author && (
          <AuthorByline
            name={author.name}
            credentials={author.credentials}
            slug={author.slug}
            publishedAt={publishedAt}
            showLink={false}
          />
        )}
      </Link>
    </article>
  )
}
