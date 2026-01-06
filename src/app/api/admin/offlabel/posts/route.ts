import { NextRequest, NextResponse } from 'next/server'
import { getAdminPosts, createPost } from '@/lib/offlabel/queries'
import type { CreatePostInput } from '@/lib/offlabel/types'

export async function GET() {
  try {
    const posts = await getAdminPosts()
    return NextResponse.json({ posts })
  } catch (error: any) {
    console.error('[GET /api/admin/offlabel/posts]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreatePostInput

    // Validate required fields
    if (!body.title || !body.slug || !body.excerpt || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: title, slug, excerpt, content' },
        { status: 400 }
      )
    }

    const post = await createPost(body)
    return NextResponse.json({ post }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/admin/offlabel/posts]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    )
  }
}
