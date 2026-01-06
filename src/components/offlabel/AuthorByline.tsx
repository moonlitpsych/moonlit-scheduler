import Link from 'next/link'
import Image from 'next/image'

interface AuthorBylineProps {
  name: string
  credentials: string
  slug: string
  avatarUrl?: string | null
  publishedAt?: string | null
  showLink?: boolean
}

/**
 * Format a date string for display
 * Example: "2026-01-05T12:00:00Z" -> "January 5, 2026"
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function AuthorByline({
  name,
  credentials,
  slug,
  avatarUrl,
  publishedAt,
  showLink = true,
}: AuthorBylineProps) {
  const authorText = `${name}, ${credentials}`

  return (
    <div className="flex items-center text-[#091747]/70 font-['Newsreader']">
      {/* Avatar */}
      {avatarUrl && (
        <Link href={`/offlabel/author/${slug}`} className="mr-3 flex-shrink-0">
          <Image
            src={avatarUrl}
            alt={name}
            width={40}
            height={40}
            className="rounded-full object-cover w-10 h-10"
          />
        </Link>
      )}

      <div>
        <div className="flex items-center">
          <span className="text-sm">By </span>
          {showLink ? (
            <Link
              href={`/offlabel/author/${slug}`}
              className="text-sm text-[#091747] hover:text-[#BF9C73] transition-colors ml-1"
            >
              {authorText}
            </Link>
          ) : (
            <span className="text-sm text-[#091747] ml-1">{authorText}</span>
          )}
        </div>
        {publishedAt && (
          <time
            dateTime={publishedAt}
            className="text-sm text-[#091747]/60 block"
          >
            {formatDate(publishedAt)}
          </time>
        )}
      </div>
    </div>
  )
}
