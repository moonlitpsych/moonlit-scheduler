import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAdminClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ConversationMessage, GeneratedArticle, PostSeries } from '@/lib/offlabel/types'

// Read the style guide at build time
function getStyleGuide(): string {
  try {
    const stylePath = join(process.cwd(), 'src/lib/offlabel/WRITING_STYLE_GUIDE.md')
    return readFileSync(stylePath, 'utf-8')
  } catch (error) {
    console.error('Failed to read style guide:', error)
    return ''
  }
}

// Get example articles from database
async function getStyleExamples(): Promise<string> {
  const supabase = getAdminClient()

  const { data: examples } = await supabase
    .from('offlabel_style_examples')
    .select(`
      post:offlabel_posts(title, excerpt, key_takeaway, content)
    `)
    .eq('is_active', true)
    .limit(3)

  if (!examples || examples.length === 0) {
    return ''
  }

  let exampleText = '\n\n## Example Articles (Write in this style)\n\n'

  for (const example of examples) {
    const post = example.post as any
    if (post) {
      exampleText += `### ${post.title}\n\n`
      exampleText += `**Key Takeaway:** ${post.key_takeaway}\n\n`
      exampleText += `**Excerpt:** ${post.excerpt}\n\n`
      exampleText += `**Content Preview:**\n${post.content?.substring(0, 1500)}...\n\n---\n\n`
    }
  }

  return exampleText
}

// Build the system prompt
async function buildSystemPrompt(): Promise<string> {
  const styleGuide = getStyleGuide()
  const examples = await getStyleExamples()

  return `You are a skilled medical writer helping create articles for Off-Label, a patient-facing psychiatric publication by Moonlit Psychiatry.

${styleGuide}
${examples}

## Your Role

You are having a conversation with the author (a psychiatrist) to collaboratively create an article. Your job is to:

1. Understand what they want to write about
2. Generate drafts based on their input
3. Refine based on their feedback
4. Output structured article data when the draft is ready

## CRITICAL: Response Format

You MUST include a JSON code block in EVERY response. No exceptions. This is how the article data gets to the editor.

Structure your response like this:

1. First, your conversational text (questions, explanations, suggestions)
2. Then, ALWAYS end with a JSON code block containing the current draft

Example response structure:

Great topic! Here's what I'm thinking... [your conversational text here]

\`\`\`json
{
  "title": "Article title here",
  "slug": "article-slug-here",
  "excerpt": "150-160 character excerpt for SEO",
  "key_takeaway": "One specific, citable sentence with numbers/study names",
  "content": "<p>Full HTML article content goes here. Use semantic HTML: p, h2, h3, strong, em, blockquote, ul, ol, li tags.</p>",
  "series": "literature-renaissance",
  "topics": ["depression", "pramipexole", "anhedonia"],
  "references": [
    {
      "citation_key": "hori2025",
      "authors": "Hori H, et al.",
      "title": "Study title",
      "journal": "Lancet Psychiatry",
      "year": 2025,
      "doi": "10.1016/example",
      "pmid": null
    }
  ],
  "ready": false
}
\`\`\`

RULES:
- EVERY response MUST end with a \`\`\`json code block
- Set "ready": true when the author says they're happy with the draft
- CRITICAL: The "content" field must ALWAYS contain a full article draft (at least 500 words of HTML). Never leave it empty. Generate your best attempt even on the first message.
- Even if you have questions, still provide a complete draft in the content field - you can refine it based on their answers
- series must be one of: "off-label", "clinical-wisdom", "literature-renaissance", or null
- NEVER skip the JSON block, even if discussing changes or asking questions

## Important Guidelines

1. ALWAYS generate a complete article draft in the content field - never leave it empty
2. Generate clean, semantic HTML for content (p, h2, h3, strong, em, blockquote, ul, ol, li)
3. Make key_takeaway specific and citable (include effect sizes, study names, years)
4. Extract references as structured data, not embedded in content
5. Use question-style H2 headers that match how patients ask questions
6. Include "The Landing" - the personally applicable takeaway

You can ask clarifying questions in your conversational text while still providing a complete draft. The author can refine the draft based on the conversation.`
}

// Parse the article JSON from Claude's response
function parseArticleFromResponse(response: string): GeneratedArticle | null {
  try {
    // Try multiple JSON block patterns (case-insensitive, optional newlines)
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/i,  // ```json ... ```
      /```JSON\s*([\s\S]*?)\s*```/,   // ```JSON ... ```
      /```\s*({\s*"[\s\S]*?})\s*```/, // ``` { ... } ``` (no language tag)
    ]

    let jsonContent: string | null = null

    for (const pattern of patterns) {
      const match = response.match(pattern)
      if (match && match[1]) {
        jsonContent = match[1].trim()
        console.log('[parseArticleFromResponse] Found JSON with pattern:', pattern.toString().substring(0, 30))
        break
      }
    }

    if (!jsonContent) {
      console.log('[parseArticleFromResponse] No JSON block found in response')
      console.log('[parseArticleFromResponse] Response preview:', response.substring(0, 300))
      return null
    }

    const parsed = JSON.parse(jsonContent)

    // Validate required fields exist (even if null)
    if (!('title' in parsed)) return null

    return {
      title: parsed.title || '',
      slug: parsed.slug || '',
      excerpt: parsed.excerpt || '',
      key_takeaway: parsed.key_takeaway || '',
      content: parsed.content || '',
      series: parsed.series || null,
      topics: parsed.topics || [],
      references: parsed.references || [],
    }
  } catch (error) {
    console.error('Failed to parse article JSON:', error)
    return null
  }
}

// Extract conversational message (without JSON block)
function extractConversationalMessage(response: string): string {
  return response.replace(/```json\n[\s\S]*?\n```/g, '').trim()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { draft_id, message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      )
    }

    const supabase = getAdminClient()
    const anthropic = new Anthropic({ apiKey })

    // Get or create draft
    let draft: any
    let conversation: ConversationMessage[] = []

    if (draft_id) {
      // Existing draft - load conversation
      const { data, error } = await supabase
        .from('offlabel_article_drafts')
        .select('*')
        .eq('id', draft_id)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: 'Draft not found' },
          { status: 404 }
        )
      }

      draft = data
      conversation = (data.conversation as ConversationMessage[]) || []
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from('offlabel_article_drafts')
        .insert([{ conversation: [], status: 'drafting' }])
        .select()
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: 'Failed to create draft' },
          { status: 500 }
        )
      }

      draft = data
    }

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }
    conversation.push(userMessage)

    // Build messages for Claude
    const systemPrompt = await buildSystemPrompt()
    const claudeMessages = conversation.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: claudeMessages,
    })

    // Extract response text
    const assistantContent = response.content[0]
    if (assistantContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Unexpected response format from Claude' },
        { status: 500 }
      )
    }

    const assistantText = assistantContent.text
    console.log('[Claude Response Raw]', assistantText.substring(0, 500))
    console.log('[Claude Response - Looking for JSON]', assistantText.includes('```json'))

    const conversationalMessage = extractConversationalMessage(assistantText)
    const article = parseArticleFromResponse(assistantText)

    console.log('[Parsed Article]', article ? 'Found' : 'Not found', article?.title || 'no title')
    console.log('[Parsed Article Content Length]', article?.content?.length || 0)
    console.log('[Parsed Article References]', article?.references?.length || 0)

    // Add assistant message to conversation
    const assistantMessage: ConversationMessage = {
      role: 'assistant',
      content: assistantText,
      timestamp: new Date().toISOString(),
    }
    conversation.push(assistantMessage)

    // Update draft with new conversation and article data
    const updateData: any = {
      conversation,
      updated_at: new Date().toISOString(),
    }

    if (article) {
      updateData.title = article.title || draft.title
      updateData.slug = article.slug || draft.slug
      updateData.excerpt = article.excerpt || draft.excerpt
      updateData.content = article.content || draft.content
      updateData.key_takeaway = article.key_takeaway || draft.key_takeaway
      updateData.series = article.series || draft.series
      updateData.topics = article.topics?.length > 0 ? article.topics : draft.topics
    }

    const { error: updateError } = await supabase
      .from('offlabel_article_drafts')
      .update(updateData)
      .eq('id', draft.id)

    if (updateError) {
      console.error('Failed to update draft:', updateError)
    }

    // If article has references, update them too
    if (article?.references && article.references.length > 0) {
      // Delete existing draft references
      await supabase
        .from('offlabel_draft_references')
        .delete()
        .eq('draft_id', draft.id)

      // Insert new references
      const refsToInsert = article.references.map((ref) => ({
        draft_id: draft.id,
        citation_key: ref.citation_key,
        authors: ref.authors,
        title: ref.title,
        journal: ref.journal,
        year: ref.year,
        doi: ref.doi,
        pmid: ref.pmid,
        url: ref.url,
      }))

      await supabase
        .from('offlabel_draft_references')
        .insert(refsToInsert)
    }

    return NextResponse.json({
      draft_id: draft.id,
      message: conversationalMessage,
      article,
      conversation: conversation.map((msg) => ({
        role: msg.role,
        content: msg.role === 'assistant'
          ? extractConversationalMessage(msg.content)
          : msg.content,
        timestamp: msg.timestamp,
      })),
    })

  } catch (error: any) {
    console.error('[POST /api/admin/offlabel/chat]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve draft and conversation
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const draftId = searchParams.get('draft_id')

    if (!draftId) {
      return NextResponse.json(
        { error: 'draft_id is required' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    const { data: draft, error: draftError } = await supabase
      .from('offlabel_article_drafts')
      .select('*')
      .eq('id', draftId)
      .single()

    if (draftError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    const { data: references } = await supabase
      .from('offlabel_draft_references')
      .select('*')
      .eq('draft_id', draftId)
      .order('citation_key')

    // Clean up conversation messages for display
    const conversation = ((draft.conversation as ConversationMessage[]) || []).map((msg) => ({
      role: msg.role,
      content: msg.role === 'assistant'
        ? extractConversationalMessage(msg.content)
        : msg.content,
      timestamp: msg.timestamp,
    }))

    return NextResponse.json({
      draft: {
        ...draft,
        conversation,
        references: references || [],
      },
    })

  } catch (error: any) {
    console.error('[GET /api/admin/offlabel/chat]', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch draft' },
      { status: 500 }
    )
  }
}
