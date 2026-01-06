import { NextRequest, NextResponse } from 'next/server'
import { unpublishPost } from '@/lib/offlabel/queries'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const post = await unpublishPost(id)
    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('[POST /api/admin/offlabel/posts/[id]/unpublish]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to unpublish post' },
      { status: 500 }
    )
  }
}
