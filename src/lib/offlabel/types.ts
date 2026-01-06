// Off-Label Publication Types

export type PostSeries = 'off-label' | 'clinical-wisdom' | 'literature-renaissance'
export type PostStatus = 'draft' | 'published' | 'archived'

export interface OffLabelAuthor {
  id: string
  name: string
  credentials: string
  slug: string
  bio: string | null
  image_url: string | null
  avatar_url: string | null
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OffLabelPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  key_takeaway: string | null
  author_id: string | null
  series: PostSeries | null
  topics: string[]
  status: PostStatus
  published_at: string | null
  audio_url: string | null
  audio_duration_seconds: number | null
  view_count: number
  created_at: string
  updated_at: string
}

export interface OffLabelReference {
  id: string
  post_id: string
  citation_key: string
  authors: string
  title: string
  journal: string | null
  year: number
  doi: string | null
  pmid: string | null
  url: string | null
  created_at: string
}

// Extended types for queries with joins
export interface OffLabelPostWithAuthor extends OffLabelPost {
  author: OffLabelAuthor | null
}

export interface OffLabelPostWithAuthorAndRefs extends OffLabelPostWithAuthor {
  references: OffLabelReference[]
}

export interface OffLabelAuthorWithPosts extends OffLabelAuthor {
  posts: OffLabelPost[]
}

// Input types for create/update operations
export interface CreatePostInput {
  title: string
  slug: string
  excerpt: string
  content: string
  key_takeaway?: string | null
  author_id?: string | null
  series?: PostSeries | null
  topics?: string[]
  status?: PostStatus
  published_at?: string | null
}

export interface UpdatePostInput {
  title?: string
  slug?: string
  excerpt?: string
  content?: string
  key_takeaway?: string | null
  author_id?: string | null
  series?: PostSeries | null
  topics?: string[]
  status?: PostStatus
  published_at?: string | null
}

// Query options
export interface GetPostsOptions {
  status?: PostStatus
  series?: PostSeries
  authorId?: string
  limit?: number
  offset?: number
}

// Series display configuration
export const seriesConfig: Record<PostSeries, { label: string; color: string }> = {
  'off-label': {
    label: 'Off-Label',
    color: 'bg-blue-100 text-blue-800',
  },
  'clinical-wisdom': {
    label: 'Clinical Wisdom',
    color: 'bg-green-100 text-green-800',
  },
  'literature-renaissance': {
    label: 'Literature Renaissance',
    color: 'bg-purple-100 text-purple-800',
  },
}

// =============================================================================
// DRAFT & CONVERSATION TYPES
// =============================================================================

export type DraftStatus = 'drafting' | 'ready' | 'published' | 'abandoned'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface OffLabelDraft {
  id: string
  title: string | null
  slug: string | null
  excerpt: string | null
  content: string | null
  key_takeaway: string | null
  author_id: string | null
  series: PostSeries | null
  topics: string[]
  conversation: ConversationMessage[]
  status: DraftStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OffLabelDraftReference {
  id: string
  draft_id: string
  citation_key: string
  authors: string
  title: string
  journal: string | null
  year: number
  doi: string | null
  pmid: string | null
  url: string | null
  created_at: string
}

export interface OffLabelDraftWithRefs extends OffLabelDraft {
  references: OffLabelDraftReference[]
}

// Claude API generation response
export interface GeneratedArticle {
  title: string
  slug: string
  excerpt: string
  key_takeaway: string
  content: string
  series: PostSeries | null
  topics: string[]
  references: Omit<OffLabelDraftReference, 'id' | 'draft_id' | 'created_at'>[]
}

export interface ChatRequest {
  draft_id?: string
  message: string
}

export interface ChatResponse {
  draft_id: string
  message: string
  article: GeneratedArticle | null
  conversation: ConversationMessage[]
}
