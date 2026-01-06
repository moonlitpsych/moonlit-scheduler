import 'server-only'
import { getAdminClient } from '@/lib/supabase/server'
import type {
  OffLabelAuthor,
  OffLabelPost,
  OffLabelPostWithAuthor,
  OffLabelPostWithAuthorAndRefs,
  OffLabelAuthorWithPosts,
  OffLabelReference,
  CreatePostInput,
  UpdatePostInput,
  GetPostsOptions,
} from './types'

// =============================================================================
// PUBLIC QUERIES (for public pages)
// =============================================================================

/**
 * Get published posts with author info
 */
export async function getPosts(options: GetPostsOptions = {}): Promise<OffLabelPostWithAuthor[]> {
  const supabase = getAdminClient()
  const { status = 'published', series, authorId, limit = 50, offset = 0 } = options

  let query = supabase
    .from('offlabel_posts')
    .select(`
      *,
      author:offlabel_authors(*)
    `)
    .eq('status', status)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)

  if (series) {
    query = query.eq('series', series)
  }

  if (authorId) {
    query = query.eq('author_id', authorId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getPosts] Error:', error.message)
    throw new Error(`Failed to fetch posts: ${error.message}`)
  }

  return (data || []) as OffLabelPostWithAuthor[]
}

/**
 * Get a single post by slug with author and references
 */
export async function getPost(slug: string): Promise<OffLabelPostWithAuthorAndRefs | null> {
  const supabase = getAdminClient()

  // Get post with author
  const { data: post, error: postError } = await supabase
    .from('offlabel_posts')
    .select(`
      *,
      author:offlabel_authors(*)
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (postError) {
    if (postError.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('[getPost] Error:', postError.message)
    throw new Error(`Failed to fetch post: ${postError.message}`)
  }

  if (!post) return null

  // Get references for this post
  const { data: references, error: refsError } = await supabase
    .from('offlabel_references')
    .select('*')
    .eq('post_id', post.id)
    .order('citation_key', { ascending: true })

  if (refsError) {
    console.error('[getPost] Error fetching references:', refsError.message)
  }

  return {
    ...post,
    references: (references || []) as OffLabelReference[],
  } as OffLabelPostWithAuthorAndRefs
}

/**
 * Get an author by slug with their published posts
 */
export async function getAuthor(slug: string): Promise<OffLabelAuthorWithPosts | null> {
  const supabase = getAdminClient()

  const { data: author, error: authorError } = await supabase
    .from('offlabel_authors')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (authorError) {
    if (authorError.code === 'PGRST116') {
      return null
    }
    console.error('[getAuthor] Error:', authorError.message)
    throw new Error(`Failed to fetch author: ${authorError.message}`)
  }

  if (!author) return null

  // Get their published posts
  const { data: posts, error: postsError } = await supabase
    .from('offlabel_posts')
    .select('*')
    .eq('author_id', author.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (postsError) {
    console.error('[getAuthor] Error fetching posts:', postsError.message)
  }

  return {
    ...author,
    posts: (posts || []) as OffLabelPost[],
  } as OffLabelAuthorWithPosts
}

/**
 * Increment view count for a post
 */
export async function incrementViewCount(slug: string): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase.rpc('increment_offlabel_view_count', { post_slug: slug })

  // If the RPC doesn't exist, fall back to manual increment
  if (error) {
    const { data: post } = await supabase
      .from('offlabel_posts')
      .select('id, view_count')
      .eq('slug', slug)
      .single()

    if (post) {
      await supabase
        .from('offlabel_posts')
        .update({ view_count: (post.view_count || 0) + 1 })
        .eq('id', post.id)
    }
  }
}

// =============================================================================
// ADMIN QUERIES (for CMS)
// =============================================================================

/**
 * Get all posts for admin (all statuses)
 */
export async function getAdminPosts(): Promise<OffLabelPostWithAuthor[]> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('offlabel_posts')
    .select(`
      *,
      author:offlabel_authors(*)
    `)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[getAdminPosts] Error:', error.message)
    throw new Error(`Failed to fetch posts: ${error.message}`)
  }

  return (data || []) as OffLabelPostWithAuthor[]
}

/**
 * Get a single post by ID for editing (any status)
 */
export async function getPostById(id: string): Promise<OffLabelPostWithAuthorAndRefs | null> {
  const supabase = getAdminClient()

  const { data: post, error: postError } = await supabase
    .from('offlabel_posts')
    .select(`
      *,
      author:offlabel_authors(*)
    `)
    .eq('id', id)
    .single()

  if (postError) {
    if (postError.code === 'PGRST116') {
      return null
    }
    console.error('[getPostById] Error:', postError.message)
    throw new Error(`Failed to fetch post: ${postError.message}`)
  }

  if (!post) return null

  const { data: references } = await supabase
    .from('offlabel_references')
    .select('*')
    .eq('post_id', post.id)
    .order('citation_key', { ascending: true })

  return {
    ...post,
    references: (references || []) as OffLabelReference[],
  } as OffLabelPostWithAuthorAndRefs
}

/**
 * Get all active authors for dropdown
 */
export async function getAllAuthors(): Promise<OffLabelAuthor[]> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('offlabel_authors')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('[getAllAuthors] Error:', error.message)
    throw new Error(`Failed to fetch authors: ${error.message}`)
  }

  return (data || []) as OffLabelAuthor[]
}

/**
 * Create a new post
 */
export async function createPost(input: CreatePostInput): Promise<OffLabelPost> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('offlabel_posts')
    .insert([{
      title: input.title,
      subtitle: input.subtitle || null,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      key_takeaway: input.key_takeaway || null,
      author_id: input.author_id || null,
      series: input.series || null,
      topics: input.topics || [],
      status: input.status || 'draft',
      published_at: input.published_at || null,
    }])
    .select()
    .single()

  if (error) {
    console.error('[createPost] Error:', error.message)
    throw new Error(`Failed to create post: ${error.message}`)
  }

  return data as OffLabelPost
}

/**
 * Update an existing post
 */
export async function updatePost(id: string, input: UpdatePostInput): Promise<OffLabelPost> {
  const supabase = getAdminClient()

  const updateData: Record<string, unknown> = {}

  if (input.title !== undefined) updateData.title = input.title
  if (input.subtitle !== undefined) updateData.subtitle = input.subtitle
  if (input.slug !== undefined) updateData.slug = input.slug
  if (input.excerpt !== undefined) updateData.excerpt = input.excerpt
  if (input.content !== undefined) updateData.content = input.content
  if (input.key_takeaway !== undefined) updateData.key_takeaway = input.key_takeaway
  if (input.author_id !== undefined) updateData.author_id = input.author_id
  if (input.series !== undefined) updateData.series = input.series
  if (input.topics !== undefined) updateData.topics = input.topics
  if (input.status !== undefined) updateData.status = input.status
  if (input.published_at !== undefined) updateData.published_at = input.published_at

  const { data, error } = await supabase
    .from('offlabel_posts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[updatePost] Error:', error.message)
    throw new Error(`Failed to update post: ${error.message}`)
  }

  return data as OffLabelPost
}

/**
 * Delete a post
 */
export async function deletePost(id: string): Promise<void> {
  const supabase = getAdminClient()

  const { error } = await supabase
    .from('offlabel_posts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deletePost] Error:', error.message)
    throw new Error(`Failed to delete post: ${error.message}`)
  }
}

/**
 * Publish a post (set status to published and published_at to now if not set)
 */
export async function publishPost(id: string): Promise<OffLabelPost> {
  const supabase = getAdminClient()

  // Get current post to check if published_at is already set
  const { data: current } = await supabase
    .from('offlabel_posts')
    .select('published_at')
    .eq('id', id)
    .single()

  const updateData: Record<string, unknown> = {
    status: 'published',
  }

  // Only set published_at if not already set
  if (!current?.published_at) {
    updateData.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('offlabel_posts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[publishPost] Error:', error.message)
    throw new Error(`Failed to publish post: ${error.message}`)
  }

  return data as OffLabelPost
}

/**
 * Unpublish a post (set status to draft)
 */
export async function unpublishPost(id: string): Promise<OffLabelPost> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('offlabel_posts')
    .update({ status: 'draft' })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[unpublishPost] Error:', error.message)
    throw new Error(`Failed to unpublish post: ${error.message}`)
  }

  return data as OffLabelPost
}

/**
 * Check if a slug is available
 */
export async function isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  const supabase = getAdminClient()

  let query = supabase
    .from('offlabel_posts')
    .select('id')
    .eq('slug', slug)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[isSlugAvailable] Error:', error.message)
    return false
  }

  return !data || data.length === 0
}
