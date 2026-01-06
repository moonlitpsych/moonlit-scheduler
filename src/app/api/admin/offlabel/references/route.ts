import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { post_id, citation_key, authors, title, journal, year, doi, pmid, url } = body

    if (!post_id || !citation_key || !authors || !title || !year) {
      return NextResponse.json(
        { error: 'Missing required fields: post_id, citation_key, authors, title, year' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('offlabel_references')
      .insert([{
        post_id,
        citation_key,
        authors,
        title,
        journal: journal || null,
        year,
        doi: doi || null,
        pmid: pmid || null,
        url: url || null,
      }])
      .select()
      .single()

    if (error) {
      console.error('[POST /api/admin/offlabel/references]', error.message)
      return NextResponse.json(
        { error: error.message || 'Failed to create reference' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reference: data }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/admin/offlabel/references]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create reference' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('post_id')

    if (!postId) {
      return NextResponse.json(
        { error: 'post_id is required' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('offlabel_references')
      .select('*')
      .eq('post_id', postId)
      .order('citation_key')

    if (error) {
      console.error('[GET /api/admin/offlabel/references]', error.message)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch references' },
        { status: 500 }
      )
    }

    return NextResponse.json({ references: data || [] })
  } catch (error: any) {
    console.error('[GET /api/admin/offlabel/references]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch references' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    const { error } = await supabase
      .from('offlabel_references')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/admin/offlabel/references]', error.message)
      return NextResponse.json(
        { error: error.message || 'Failed to delete reference' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/offlabel/references]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete reference' },
      { status: 500 }
    )
  }
}
