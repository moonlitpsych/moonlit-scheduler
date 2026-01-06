import { NextRequest, NextResponse } from 'next/server'
import { publishPost } from '@/lib/offlabel/queries'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const post = await publishPost(id)
    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('[POST /api/admin/offlabel/posts/[id]/publish]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to publish post' },
      { status: 500 }
    )
  }
}
