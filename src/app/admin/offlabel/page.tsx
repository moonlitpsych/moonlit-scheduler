'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Edit, Trash2, Eye, EyeOff, ExternalLink, Sparkles } from 'lucide-react'
import type { OffLabelPostWithAuthor, PostStatus } from '@/lib/offlabel/types'
import { seriesConfig } from '@/lib/offlabel/types'

export default function OffLabelAdminPage() {
  const [posts, setPosts] = useState<OffLabelPostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/admin/offlabel/posts')
      if (response.ok) {
        const data = await response.json()
        setPosts(data.posts || [])
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (id: string) => {
    setActionLoading(id)
    try {
      const response = await fetch(`/api/admin/offlabel/posts/${id}/publish`, {
        method: 'POST',
      })
      if (response.ok) {
        await fetchPosts()
      }
    } catch (error) {
      console.error('Failed to publish:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnpublish = async (id: string) => {
    setActionLoading(id)
    try {
      const response = await fetch(`/api/admin/offlabel/posts/${id}/unpublish`, {
        method: 'POST',
      })
      if (response.ok) {
        await fetchPosts()
      }
    } catch (error) {
      console.error('Failed to unpublish:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return
    }

    setActionLoading(id)
    try {
      const response = await fetch(`/api/admin/offlabel/posts/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await fetchPosts()
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: PostStatus) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-stone-100 text-stone-800',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73]"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">Off-Label CMS</h1>
          <p className="text-[#091747]/60 mt-1">Manage your publication articles</p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/offlabel/write-with-claude"
            className="flex items-center space-x-2 bg-gradient-to-r from-[#BF9C73] to-[#A8865F] hover:from-[#A8865F] hover:to-[#8B7355] text-white px-4 py-2 rounded-lg transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>Write with Claude</span>
          </Link>
          <Link
            href="/admin/offlabel/write"
            className="flex items-center space-x-2 border-2 border-[#BF9C73] text-[#BF9C73] hover:bg-[#BF9C73]/10 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Manual Write</span>
          </Link>
        </div>
      </div>

      {/* Posts Table */}
      {posts.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                  Title
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                  Series
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                  Author
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                  Published
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                  Views
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-[#091747]/60 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-[#091747]">{post.title}</div>
                      <div className="text-sm text-[#091747]/50">/offlabel/{post.slug}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(post.status)}</td>
                  <td className="px-6 py-4">
                    {post.series ? (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${seriesConfig[post.series].color}`}
                      >
                        {seriesConfig[post.series].label}
                      </span>
                    ) : (
                      <span className="text-[#091747]/40">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[#091747]/70">
                    {post.author ? `${post.author.name}, ${post.author.credentials}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-[#091747]/70">{formatDate(post.published_at)}</td>
                  <td className="px-6 py-4 text-[#091747]/70">{post.view_count || 0}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      {post.status === 'published' && (
                        <a
                          href={`/offlabel/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-[#091747]/50 hover:text-[#BF9C73] transition-colors"
                          title="View live"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Link
                        href={`/admin/offlabel/edit/${post.id}`}
                        className="p-2 text-[#091747]/50 hover:text-[#BF9C73] transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      {post.status === 'draft' ? (
                        <button
                          onClick={() => handlePublish(post.id)}
                          disabled={actionLoading === post.id}
                          className="p-2 text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                          title="Publish"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : post.status === 'published' ? (
                        <button
                          onClick={() => handleUnpublish(post.id)}
                          disabled={actionLoading === post.id}
                          className="p-2 text-yellow-600 hover:text-yellow-800 transition-colors disabled:opacity-50"
                          title="Unpublish"
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleDelete(post.id, post.title)}
                        disabled={actionLoading === post.id}
                        className="p-2 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center">
          <p className="text-[#091747]/60 mb-4">No articles yet. Create your first post!</p>
          <Link
            href="/admin/offlabel/write"
            className="inline-flex items-center space-x-2 bg-[#BF9C73] hover:bg-[#A8865F] text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Post</span>
          </Link>
        </div>
      )}
    </div>
  )
}
