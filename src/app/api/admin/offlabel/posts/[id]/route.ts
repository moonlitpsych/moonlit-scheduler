import { NextRequest, NextResponse } from 'next/server'
import { getPostById, updatePost, deletePost } from '@/lib/offlabel/queries'
import type { UpdatePostInput } from '@/lib/offlabel/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const post = await getPostById(id)

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('[GET /api/admin/offlabel/posts/[id]]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch post' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json() as UpdatePostInput

    const post = await updatePost(id, body)
    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('[PUT /api/admin/offlabel/posts/[id]]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to update post' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    await deletePost(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/offlabel/posts/[id]]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to delete post' },
      { status: 500 }
    )
  }
}
