import { NextResponse } from 'next/server'
import { getAllAuthors } from '@/lib/offlabel/queries'

export async function GET() {
  try {
    const authors = await getAllAuthors()
    return NextResponse.json({ authors })
  } catch (error: any) {
    console.error('[GET /api/admin/offlabel/authors]', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch authors' },
      { status: 500 }
    )
  }
}
