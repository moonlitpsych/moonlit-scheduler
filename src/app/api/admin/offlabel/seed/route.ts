import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/server'

/**
 * Seeds a placeholder article for testing the Off-Label publication.
 * This endpoint is intentionally simple and should only be used for initial setup.
 *
 * POST /api/admin/offlabel/seed
 */
export async function POST() {
  try {
    const supabase = getAdminClient()

    // First, get the Rufus Sweeney author ID
    const { data: author, error: authorError } = await supabase
      .from('offlabel_authors')
      .select('id')
      .eq('slug', 'rufus-sweeney')
      .single()

    if (authorError || !author) {
      return NextResponse.json(
        { error: 'Author "rufus-sweeney" not found. Please ensure the migration has been run.' },
        { status: 404 }
      )
    }

    // Check if a post with this slug already exists
    const { data: existingPost } = await supabase
      .from('offlabel_posts')
      .select('id')
      .eq('slug', 'the-tb-drug-that-invented-antidepressants')
      .single()

    if (existingPost) {
      return NextResponse.json(
        { message: 'Placeholder article already exists', postId: existingPost.id },
        { status: 200 }
      )
    }

    // Create the placeholder article
    const { data: post, error: postError } = await supabase
      .from('offlabel_posts')
      .insert([{
        title: 'The TB Drug That Invented Antidepressants',
        slug: 'the-tb-drug-that-invented-antidepressants',
        excerpt: 'In 1952, patients dying of tuberculosis started dancing in the hallways. Their doctors had no idea they had just discovered a new class of psychiatric medication.',
        content: `<p>In 1952, at Sea View Hospital on Staten Island, something strange was happening in the tuberculosis ward.</p>

<p>Patients who had been bedridden for months—many of them expecting to die—were suddenly getting out of bed. They were socializing. Some were dancing in the hallways. The nurses didn't know what to make of it.</p>

<h2>The Accidental Discovery</h2>

<p>These patients were receiving a new experimental drug called iproniazid. It was meant to treat their tuberculosis, and it did help with that. But it also did something nobody expected: it made them feel <em>better</em>.</p>

<p>Not just physically better—emotionally better. The profound hopelessness that often accompanies a terminal diagnosis had lifted. Patients who had been withdrawn and despairing were now engaged with life.</p>

<h2>What the Doctors Noticed</h2>

<p>The medical staff at Sea View were puzzled. TB drugs weren't supposed to do this. Dr. Irving Selikoff and his colleagues documented what they were seeing:</p>

<blockquote>
<p>"Their appetites improved, they gained weight, and most strikingly, they exhibited a general sense of well-being that seemed out of proportion to their physical improvement."</p>
</blockquote>

<p>Word spread through the medical community. A psychiatrist named Nathan Kline wondered: if this drug could lift the spirits of dying TB patients, what might it do for patients with depression?</p>

<h2>The Birth of Antidepressants</h2>

<p>Kline's experiments confirmed what the Sea View doctors had observed. Iproniazid worked remarkably well for depression. By 1957, it was being prescribed specifically as a "psychic energizer"—one of the first antidepressants.</p>

<p>The drug was eventually withdrawn due to liver toxicity concerns, but it had opened a door. Researchers now knew that depression wasn't just "in your head"—it was a brain chemistry problem that could be treated with medication.</p>

<h2>The Landing</h2>

<p>Today, we have safer and more effective antidepressants. But they all trace their lineage back to that TB ward on Staten Island, where dancing patients taught us that depression is a treatable illness.</p>

<p>If you're struggling with depression, know this: the science of treating it started with an accident, but it's now backed by decades of research. There are options. There is hope.</p>`,
        key_takeaway: 'The first antidepressants were discovered by accident when TB patients started dancing in hospital hallways. This discovery proved that depression is a treatable brain chemistry problem, not a character flaw.',
        author_id: author.id,
        series: 'off-label',
        topics: ['depression', 'antidepressants', 'medical history', 'iproniazid', 'MAOIs'],
        status: 'published',
        published_at: new Date().toISOString(),
      }])
      .select()
      .single()

    if (postError) {
      console.error('[SEED] Failed to create post:', postError.message)
      return NextResponse.json(
        { error: postError.message || 'Failed to create post' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Placeholder article created successfully',
      post,
    }, { status: 201 })
  } catch (error: any) {
    console.error('[SEED] Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Failed to seed data' },
      { status: 500 }
    )
  }
}
