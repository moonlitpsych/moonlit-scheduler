'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Eye, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { RichTextEditor } from '@/components/offlabel/RichTextEditor'
import { ArticleContent } from '@/components/offlabel/ArticleContent'
import { slugify } from '@/lib/offlabel/slugify'
import type { OffLabelAuthor, PostSeries, CreatePostInput } from '@/lib/offlabel/types'
import { seriesConfig } from '@/lib/offlabel/types'

export default function WritePostPage() {
  const router = useRouter()
  const [authors, setAuthors] = useState<OffLabelAuthor[]>([])
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [excerpt, setExcerpt] = useState('')
  const [keyTakeaway, setKeyTakeaway] = useState('')
  const [content, setContent] = useState('')
  const [authorId, setAuthorId] = useState('')
  const [series, setSeries] = useState<PostSeries | ''>('')
  const [topics, setTopics] = useState('')

  useEffect(() => {
    fetchAuthors()
  }, [])

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      setSlug(slugify(title))
    }
  }, [title, slugManuallyEdited])

  const fetchAuthors = async () => {
    try {
      const response = await fetch('/api/admin/offlabel/authors')
      if (response.ok) {
        const data = await response.json()
        setAuthors(data.authors || [])
        // Default to first author if available
        if (data.authors?.length > 0) {
          setAuthorId(data.authors[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch authors:', error)
    }
  }

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true)
    setSlug(slugify(value))
  }

  const handleSave = async (publish: boolean = false) => {
    if (!title || !slug || !excerpt || !content) {
      alert('Please fill in all required fields: title, slug, excerpt, and content.')
      return
    }

    setLoading(true)

    try {
      const postData: CreatePostInput = {
        title,
        subtitle: subtitle || null,
        slug,
        excerpt,
        content,
        key_takeaway: keyTakeaway || null,
        author_id: authorId || null,
        series: (series as PostSeries) || null,
        topics: topics ? topics.split(',').map((t) => t.trim()).filter(Boolean) : [],
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      }

      const response = await fetch('/api/admin/offlabel/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      })

      if (response.ok) {
        router.push('/admin/offlabel')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save post')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FEF8F1]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center space-x-4">
            <Link
              href="/admin/offlabel"
              className="p-2 text-[#091747]/50 hover:text-[#091747] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-xl font-bold text-[#091747] font-['Newsreader']">New Post</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center space-x-2 px-4 py-2 text-[#091747]/70 hover:text-[#091747] border border-stone-200 rounded-lg transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>{showPreview ? 'Edit' : 'Preview'}</span>
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-[#091747] bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Draft</span>
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-[#BF9C73] hover:bg-[#A8865F] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Publish</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {showPreview ? (
          /* Preview Mode */
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8">
            <h1 className="text-4xl font-bold font-['Newsreader'] text-[#091747] mb-2">{title || 'Untitled'}</h1>
            {subtitle && (
              <p className="text-xl text-[#091747]/70 font-['Newsreader'] italic mb-6">
                {subtitle}
              </p>
            )}
            {keyTakeaway && (
              <div className="bg-[#FEF8F1] border-l-4 border-[#BF9C73] p-6 mb-8 rounded-r-lg">
                <p className="text-sm font-medium text-[#BF9C73] uppercase tracking-wide mb-2">
                  Key Takeaway
                </p>
                <p className="text-lg text-[#091747] font-['Newsreader']">{keyTakeaway}</p>
              </div>
            )}
            <ArticleContent content={content || '<p>Start writing your article...</p>'} />
          </div>
        ) : (
          /* Edit Mode */
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[#091747] mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The TB Drug That Invented Antidepressants"
                className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73] text-lg font-['Newsreader']"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-sm font-medium text-[#091747] mb-2">
                Subtitle
                <span className="text-[#091747]/50 font-normal ml-2">(hook or punchline)</span>
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="The accidental discovery that changed everything"
                className="w-full px-4 py-2 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73] font-['Newsreader'] text-[#091747]/80 italic"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-[#091747] mb-2">
                URL Slug <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center">
                <span className="text-[#091747]/50 mr-2">/offlabel/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="the-tb-drug-that-invented-antidepressants"
                  className="flex-1 px-4 py-2 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                />
              </div>
            </div>

            {/* Excerpt */}
            <div>
              <label className="block text-sm font-medium text-[#091747] mb-2">
                Excerpt <span className="text-red-500">*</span>
                <span className="text-[#091747]/50 font-normal ml-2">
                  ({excerpt.length}/160 characters)
                </span>
              </label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A brief description for search results and social sharing..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73] resize-none"
              />
            </div>

            {/* Key Takeaway */}
            <div>
              <label className="block text-sm font-medium text-[#091747] mb-2">
                Key Takeaway
                <span className="text-[#091747]/50 font-normal ml-2">(shown at top of article)</span>
              </label>
              <textarea
                value={keyTakeaway}
                onChange={(e) => setKeyTakeaway(e.target.value)}
                placeholder="If you've been struggling with depression and nothing seems to work, there's now high-quality evidence for a treatment that works through a completely different mechanism."
                rows={2}
                className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73] resize-none"
              />
            </div>

            {/* Metadata Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Author */}
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">Author</label>
                <select
                  value={authorId}
                  onChange={(e) => setAuthorId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                >
                  <option value="">Select author...</option>
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {author.name}, {author.credentials}
                    </option>
                  ))}
                </select>
              </div>

              {/* Series */}
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">Series</label>
                <select
                  value={series}
                  onChange={(e) => setSeries(e.target.value as PostSeries | '')}
                  className="w-full px-4 py-2 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                >
                  <option value="">Select series...</option>
                  {(Object.entries(seriesConfig) as [PostSeries, { label: string }][]).map(
                    ([key, config]) => (
                      <option key={key} value={key}>
                        {config.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Topics */}
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-2">
                  Topics
                  <span className="text-[#091747]/50 font-normal ml-2">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="depression, antidepressants, history"
                  className="w-full px-4 py-2 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73]"
                />
              </div>
            </div>

            {/* Content Editor */}
            <div>
              <label className="block text-sm font-medium text-[#091747] mb-2">
                Content <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Start writing your article..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
