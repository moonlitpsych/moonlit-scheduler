# Off-Label Publication Implementation Plan

**For: Claude Code**
**Project: Moonlit Psychiatry - Off-Label Publication**
**Date: January 5, 2026**

---

## Executive Summary

Build a patient-facing publication called "Off-Label" at `/offlabel` within the existing Next.js application. This includes:
1. Public-facing article pages optimized for SEO and LLM citation
2. Admin CMS for writing and managing articles
3. Database schema for posts, authors, and references
4. Custom layout separate from the main site

The publication serves two strategic purposes:
- **Short-term**: Attract HMHI-BHN patients (University of Utah employees)
- **Long-term**: Become a multi-author psychiatric publication ("Carlat for patients")

---

## Table of Contents

1. [Codebase Context](#codebase-context)
2. [Database Schema](#database-schema)
3. [File Structure](#file-structure)
4. [Public Pages](#public-pages)
5. [Admin CMS](#admin-cms)
6. [Components](#components)
7. [SEO & Structured Data](#seo--structured-data)
8. [Styling Guidelines](#styling-guidelines)
9. [Implementation Order](#implementation-order)
10. [Testing Checklist](#testing-checklist)

---

## Codebase Context

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **React**: 19.1.0
- **Styling**: Tailwind CSS 3.4.17
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with `@supabase/auth-helpers-nextjs`
- **Icons**: lucide-react 0.534.0
- **Validation**: Zod 4.1.12

### Design System

```typescript
// Colors
const colors = {
  primary: '#BF9C73',      // Warm brown/gold - buttons, accents
  primaryHover: '#A8865F', // Darker primary for hover states
  background: '#FEF8F1',   // Warm off-white
  text: '#091747',         // Dark navy for text
  textMuted: '#091747/70', // 70% opacity for secondary text
  white: '#FFFFFF',
}

// Typography
const fonts = {
  heading: "font-['Newsreader']",  // Serif for headings
  body: "font-sans",               // Inter (default) for body
}
```

### Existing Patterns

**ConditionalLayout** (`src/components/layout/ConditionalLayout.tsx`):
- Routes starting with `/partner-dashboard` or `/partner-auth` skip the main Header/Footer
- Off-Label should be added to this exclusion list to have its own layout

**Admin Layout** (`src/app/admin/layout.tsx`):
- Sidebar-based navigation
- Auth guard using `routeGuardManager.canAccessAdminRoute()`
- Pattern to follow for Off-Label admin

**Supabase Server Client** (`src/lib/supabase/server.ts`):
- `getAdminClient()` - Service role client for server operations
- `createServerClient()` - Alias for compatibility

---

## Database Schema

Create migration file: `supabase/migrations/20260105000000_offlabel_tables.sql`

```sql
-- Off-Label Publication Tables
-- Run with: npx supabase db push (or apply via Supabase dashboard)

-- Authors table
CREATE TABLE IF NOT EXISTS offlabel_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credentials TEXT NOT NULL,  -- e.g., 'MD', 'MD, PhD'
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  image_url TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS offlabel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL,              -- For meta description, ~160 chars
  content TEXT NOT NULL,              -- HTML content
  key_takeaway TEXT,                  -- Single sentence for featured snippets
  author_id UUID REFERENCES offlabel_authors(id) ON DELETE SET NULL,
  
  -- Categorization
  series TEXT CHECK (series IN ('off-label', 'clinical-wisdom', 'literature-renaissance')),
  topics TEXT[] DEFAULT '{}',         -- Array of topic tags
  
  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  
  -- Audio (future feature)
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  
  -- Metadata
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- References table (for academic citations)
CREATE TABLE IF NOT EXISTS offlabel_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES offlabel_posts(id) ON DELETE CASCADE,
  citation_key TEXT NOT NULL,         -- e.g., 'hori2025'
  authors TEXT NOT NULL,
  title TEXT NOT NULL,
  journal TEXT,
  year INTEGER NOT NULL,
  doi TEXT,
  pmid TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_slug ON offlabel_posts(slug);
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_status ON offlabel_posts(status);
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_published_at ON offlabel_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_author ON offlabel_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_offlabel_authors_slug ON offlabel_authors(slug);
CREATE INDEX IF NOT EXISTS idx_offlabel_references_post ON offlabel_references(post_id);

-- Row Level Security
ALTER TABLE offlabel_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE offlabel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE offlabel_references ENABLE ROW LEVEL SECURITY;

-- Public read access for published content
CREATE POLICY "Public can read active authors"
  ON offlabel_authors FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can read published posts"
  ON offlabel_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Public can read references for published posts"
  ON offlabel_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM offlabel_posts 
      WHERE offlabel_posts.id = offlabel_references.post_id 
      AND offlabel_posts.status = 'published'
    )
  );

-- Service role has full access (for admin operations)
CREATE POLICY "Service role full access to authors"
  ON offlabel_authors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to posts"
  ON offlabel_posts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to references"
  ON offlabel_references FOR ALL
  USING (auth.role() = 'service_role');

-- Seed initial author (Rufus)
INSERT INTO offlabel_authors (name, credentials, slug, bio, email)
VALUES (
  'Rufus Sweeney',
  'MD',
  'rufus-sweeney',
  'Rufus Sweeney is a psychiatrist at Moonlit Psychiatry in Salt Lake City, Utah. He writes about treatments that work—even when they weren''t supposed to.',
  'rufus@trymoonlit.com'
) ON CONFLICT (slug) DO NOTHING;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_offlabel_authors_updated_at
  BEFORE UPDATE ON offlabel_authors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offlabel_posts_updated_at
  BEFORE UPDATE ON offlabel_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## File Structure

Create the following file structure:

```
src/
├── app/
│   ├── offlabel/                          # Public publication routes
│   │   ├── layout.tsx                     # Publication-specific layout
│   │   ├── page.tsx                       # Homepage (article list)
│   │   ├── [slug]/
│   │   │   └── page.tsx                   # Individual article
│   │   └── author/
│   │       └── [slug]/
│   │           └── page.tsx               # Author profile
│   │
│   └── admin/
│       └── offlabel/                      # Admin CMS routes
│           ├── page.tsx                   # Dashboard (post list)
│           ├── write/
│           │   └── page.tsx               # New post editor
│           └── edit/
│               └── [id]/
│                   └── page.tsx           # Edit existing post
│
├── components/
│   └── offlabel/                          # Off-Label specific components
│       ├── ArticleCard.tsx                # Card for article list
│       ├── ArticleContent.tsx             # Renders article HTML safely
│       ├── ArticleHeader.tsx              # Title, author, date
│       ├── AuthorByline.tsx               # Author name + credentials
│       ├── RichTextEditor.tsx             # TipTap-based editor
│       ├── PublicationHeader.tsx          # Off-Label site header
│       ├── PublicationFooter.tsx          # Off-Label site footer
│       └── SEO/
│           └── ArticleStructuredData.tsx  # Schema.org for articles
│
├── lib/
│   └── offlabel/
│       ├── types.ts                       # TypeScript types
│       ├── queries.ts                     # Supabase query helpers
│       └── slugify.ts                     # URL slug generation
│
└── types/
    └── offlabel.ts                        # Database types (or add to database.ts)
```

---

## Public Pages

### 1. Publication Layout (`src/app/offlabel/layout.tsx`)

```typescript
// Key requirements:
// - Custom header with "Off-Label" branding
// - Link back to main Moonlit site
// - Distinct visual identity (still on-brand but publication-focused)
// - NO main site header/footer

import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Off-Label | Moonlit Psychiatry',
    template: '%s | Off-Label'
  },
  description: 'Stories of psychiatric treatments discovered by accident, rediscovered from history, or used in ways their inventors never imagined.',
}

export default function OffLabelLayout({ children }) {
  return (
    <div className="min-h-screen bg-white">
      <PublicationHeader />
      <main className="flex-grow">
        {children}
      </main>
      <PublicationFooter />
    </div>
  )
}
```

**Update ConditionalLayout** (`src/components/layout/ConditionalLayout.tsx`):

```typescript
// Add '/offlabel' to the exclusion list
const isPartnerRoute = pathname?.startsWith('/partner-dashboard') || 
                       pathname?.startsWith('/partner-auth')
const isOffLabelRoute = pathname?.startsWith('/offlabel')

if (isPartnerRoute || isOffLabelRoute) {
  return <>{children}</>
}
```

### 2. Homepage (`src/app/offlabel/page.tsx`)

```typescript
// Requirements:
// - List of published articles, newest first
// - Filter by series (off-label, clinical-wisdom, literature-renaissance)
// - Each article shows: title, excerpt, author, date, series badge
// - Responsive grid layout
// - Server-side rendered for SEO

// Data fetching:
// SELECT * FROM offlabel_posts 
// WHERE status = 'published' 
// ORDER BY published_at DESC
// JOIN offlabel_authors ON author_id

// URL: /offlabel
// Optional query param: ?series=off-label
```

### 3. Article Page (`src/app/offlabel/[slug]/page.tsx`)

```typescript
// Requirements:
// - Full article content
// - Author byline with credentials and link to author page
// - Published date
// - Key takeaway highlighted at top
// - References section at bottom
// - Schema.org MedicalWebPage structured data
// - OpenGraph meta tags for social sharing
// - Soft CTA footer linking to Moonlit practice

// Data fetching:
// SELECT * FROM offlabel_posts WHERE slug = $1 AND status = 'published'
// JOIN offlabel_authors
// SELECT * FROM offlabel_references WHERE post_id = $1

// SEO meta tags (generateMetadata):
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPost(params.slug)
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.published_at,
      authors: [post.author.name],
    }
  }
}
```

### 4. Author Page (`src/app/offlabel/author/[slug]/page.tsx`)

```typescript
// Requirements:
// - Author photo, name, credentials, bio
// - List of all articles by this author
// - Link to book appointment (soft CTA)

// Data fetching:
// SELECT * FROM offlabel_authors WHERE slug = $1 AND is_active = true
// SELECT * FROM offlabel_posts WHERE author_id = $1 AND status = 'published'
```

---

## Admin CMS

### 1. Dashboard (`src/app/admin/offlabel/page.tsx`)

```typescript
// Requirements:
// - Table of all posts (drafts, published, archived)
// - Columns: Title, Status, Author, Published Date, Actions
// - Actions: Edit, Publish/Unpublish, Delete
// - "New Post" button
// - Uses same admin layout as other admin pages

// Add navigation link to admin sidebar (src/app/admin/layout.tsx):
// Under "Operations" section:
<Link href="/admin/offlabel" className={getNavLinkClasses('/admin/offlabel')}>
  <FileText className="h-4 w-4" />
  <span>Off-Label</span>
  <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-green-600 text-white rounded-full">New</span>
</Link>
```

### 2. Write Page (`src/app/admin/offlabel/write/page.tsx`)

```typescript
// Requirements:
// - Title input
// - Slug input (auto-generated from title, editable)
// - Excerpt textarea (with character count, target 150-160)
// - Key Takeaway input
// - Series dropdown (off-label, clinical-wisdom, literature-renaissance)
// - Topics input (comma-separated or tag-style)
// - Rich text editor for content (TipTap)
// - Author selector (dropdown of active authors)
// - Preview toggle
// - Save Draft / Publish buttons

// Rich text editor toolbar:
// - Bold, Italic, Strikethrough
// - H2, H3 (H1 is reserved for title)
// - Bullet list, Numbered list
// - Link
// - Blockquote
// - Code block
// - Horizontal rule
```

### 3. Edit Page (`src/app/admin/offlabel/edit/[id]/page.tsx`)

```typescript
// Same as Write page but:
// - Pre-populated with existing data
// - Shows current status
// - Option to unpublish if published
// - Delete confirmation modal
```

### 4. Rich Text Editor Component (`src/components/offlabel/RichTextEditor.tsx`)

```typescript
// Use TipTap editor: npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
// Extensions needed:
// - StarterKit (basic formatting)
// - Link
// - Placeholder

// Editor should:
// - Output clean HTML
// - Support paste from Google Docs/Word (strip unwanted formatting)
// - Have toolbar matching design system colors
// - Show word/character count

// Example implementation reference:
// https://tiptap.dev/docs/editor/getting-started/install/nextjs
```

---

## Components

### ArticleCard (`src/components/offlabel/ArticleCard.tsx`)

```typescript
interface ArticleCardProps {
  title: string
  slug: string
  excerpt: string
  author: {
    name: string
    credentials: string
    slug: string
  }
  publishedAt: string
  series?: string
}

// Visual design:
// - Card with subtle border or shadow
// - Title in Newsreader font
// - Excerpt in Inter
// - Author byline with credentials
// - Series badge (colored pill)
// - Hover state with slight lift
```

### AuthorByline (`src/components/offlabel/AuthorByline.tsx`)

```typescript
interface AuthorBylineProps {
  name: string
  credentials: string
  slug: string
  publishedAt?: string
  showLink?: boolean
}

// Format: "By Rufus Sweeney, MD · January 5, 2026"
// Name is optionally a link to author page
```

### PublicationHeader (`src/components/offlabel/PublicationHeader.tsx`)

```typescript
// Design:
// - "Off-Label" logo/wordmark (can be styled text initially)
// - Tagline: "A Moonlit Psychiatry Publication"
// - Navigation: Home, About (optional), Subscribe (future)
// - Link back to main site
// - Clean, editorial feel (think: The Atlantic, New Yorker)

// Colors:
// - White or very light background
// - Dark text (#091747)
// - Primary accent sparingly (#BF9C73)
```

### PublicationFooter (`src/components/offlabel/PublicationFooter.tsx`)

```typescript
// Design:
// - Soft CTA: "Rufus Sweeney practices at Moonlit Psychiatry in Salt Lake City. 
//            If you're in Utah and looking for a psychiatrist, we're accepting new patients."
// - Link to trymoonlit.com
// - Copyright notice
// - Simple, not cluttered
```

---

## SEO & Structured Data

### Article Structured Data (`src/components/offlabel/SEO/ArticleStructuredData.tsx`)

```typescript
// Schema.org MedicalWebPage markup
// Reference: https://schema.org/MedicalWebPage

interface ArticleStructuredDataProps {
  title: string
  description: string
  url: string
  publishedAt: string
  updatedAt: string
  author: {
    name: string
    credentials: string
    url: string
  }
  keyTakeaway?: string
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  "headline": title,
  "description": description,
  "url": url,
  "datePublished": publishedAt,
  "dateModified": updatedAt,
  "author": {
    "@type": "Person",
    "name": author.name,
    "jobTitle": "Psychiatrist",
    "credential": author.credentials,
    "url": author.url,
    "worksFor": {
      "@type": "MedicalBusiness",
      "name": "Moonlit Psychiatry",
      "url": "https://booking.trymoonlit.com"
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "Moonlit Psychiatry",
    "url": "https://booking.trymoonlit.com"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": url
  },
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [".key-takeaway", "article h1", "article h2"]
  }
}

// Render as:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
/>
```

### Breadcrumb Structured Data

```typescript
// For article pages
const breadcrumbData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Off-Label",
      "item": "https://booking.trymoonlit.com/offlabel"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": articleTitle,
      "item": articleUrl
    }
  ]
}
```

---

## Styling Guidelines

### Typography Scale

```css
/* Article page typography */
.article-content h1 { @apply text-4xl font-['Newsreader'] font-bold mb-6 text-[#091747]; }
.article-content h2 { @apply text-2xl font-['Newsreader'] font-semibold mt-10 mb-4 text-[#091747]; }
.article-content h3 { @apply text-xl font-['Newsreader'] font-semibold mt-8 mb-3 text-[#091747]; }
.article-content p { @apply text-lg leading-relaxed mb-6 text-[#091747]/90; }
.article-content ul { @apply list-disc pl-6 mb-6 space-y-2; }
.article-content ol { @apply list-decimal pl-6 mb-6 space-y-2; }
.article-content blockquote { @apply border-l-4 border-[#BF9C73] pl-6 italic my-6 text-[#091747]/80; }
.article-content a { @apply text-[#BF9C73] hover:underline; }
```

### Key Takeaway Box

```typescript
// Visually distinct box at the start of articles
<div className="bg-[#FEF8F1] border-l-4 border-[#BF9C73] p-6 mb-8 rounded-r-lg">
  <p className="text-sm font-medium text-[#BF9C73] uppercase tracking-wide mb-2">
    Key Takeaway
  </p>
  <p className="text-lg text-[#091747] font-['Newsreader']">
    {keyTakeaway}
  </p>
</div>
```

### Series Badge

```typescript
// Color coding by series
const seriesColors = {
  'off-label': 'bg-blue-100 text-blue-800',
  'clinical-wisdom': 'bg-green-100 text-green-800',
  'literature-renaissance': 'bg-purple-100 text-purple-800',
}

<span className={`px-2 py-1 text-xs font-medium rounded-full ${seriesColors[series]}`}>
  {seriesDisplayName}
</span>
```

---

## Implementation Order

### Phase 1: Foundation (Do First)

1. **Run database migration**
   - Create the SQL file in `supabase/migrations/`
   - Apply via Supabase dashboard or CLI

2. **Create TypeScript types** (`src/lib/offlabel/types.ts`)
   - Post, Author, Reference interfaces
   - Match database schema exactly

3. **Create query helpers** (`src/lib/offlabel/queries.ts`)
   - `getPosts()` - list published posts
   - `getPost(slug)` - single post with author
   - `getAuthor(slug)` - author with their posts
   - `createPost()`, `updatePost()`, `deletePost()` - admin operations

### Phase 2: Public Pages

4. **Update ConditionalLayout** to exclude `/offlabel` routes

5. **Create PublicationHeader and PublicationFooter components**

6. **Create Off-Label layout** (`src/app/offlabel/layout.tsx`)

7. **Create homepage** (`src/app/offlabel/page.tsx`)
   - Start with simple list, add filters later

8. **Create article page** (`src/app/offlabel/[slug]/page.tsx`)
   - Include structured data
   - Include generateMetadata for SEO

9. **Create author page** (`src/app/offlabel/author/[slug]/page.tsx`)

### Phase 3: Admin CMS

10. **Add Off-Label link to admin sidebar** (`src/app/admin/layout.tsx`)

11. **Install TipTap**: `npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder`

12. **Create RichTextEditor component**

13. **Create admin dashboard** (`src/app/admin/offlabel/page.tsx`)

14. **Create write page** (`src/app/admin/offlabel/write/page.tsx`)

15. **Create edit page** (`src/app/admin/offlabel/edit/[id]/page.tsx`)

### Phase 4: Polish

16. **Test end-to-end flow**: Create draft → Preview → Publish → View public

17. **Add view count tracking** (increment on article page load)

18. **Test SEO**: Check structured data with Google's Rich Results Test

---

## Testing Checklist

### Database
- [ ] Migration applied successfully
- [ ] Rufus author record seeded
- [ ] RLS policies working (public can read published, service role can write)

### Public Pages
- [ ] Homepage loads and shows published articles
- [ ] Article page renders content correctly
- [ ] Author page shows bio and article list
- [ ] Navigation between pages works
- [ ] Mobile responsive
- [ ] No main site header/footer appears

### Admin CMS
- [ ] Dashboard lists all posts
- [ ] Can create new draft
- [ ] Can edit existing post
- [ ] Can publish/unpublish
- [ ] Can delete (with confirmation)
- [ ] Rich text editor works
- [ ] Preview mode works
- [ ] Slug auto-generates from title

### SEO
- [ ] Meta titles and descriptions correct
- [ ] OpenGraph tags present
- [ ] Schema.org structured data valid (test with https://validator.schema.org/)
- [ ] Sitemap includes Off-Label pages (if sitemap exists)

---

## API Routes (Optional)

If you prefer API routes over server actions:

```
src/app/api/offlabel/
├── posts/
│   ├── route.ts           # GET (list), POST (create)
│   └── [id]/
│       └── route.ts       # GET, PUT, DELETE single post
├── authors/
│   └── route.ts           # GET list of authors
└── publish/
    └── [id]/
        └── route.ts       # POST to publish, DELETE to unpublish
```

---

## Future Enhancements (Not for v1)

### Author Management (Priority)
- **Author profile editor**: Admin UI for staff writers to add/edit their profile picture, bio, and credentials
- **Author onboarding flow**: Self-service signup for new Moonlit staff writers
- **Avatar upload**: Direct image upload to Supabase storage (currently uses static paths)

### Content Features
- Email newsletter integration (Buttondown or ConvertKit)
- Audio generation (text-to-speech)
- Related articles suggestions
- Reading time estimate
- Social share buttons
- Comments (probably not - keep it simple)
- RSS feed
- Search functionality

### Voice Learning (Layer 3)
- Edit tracking to capture how authors refine Claude's drafts
- Automatic pattern extraction from edits to improve future drafts
- Per-author style memory

---

## Editorial Direction

### Content Philosophy (from Content Strategy Reference)

Every Off-Label article should have **three essential elements**:

1. **Narrative/Story**: Not just information—a character, conflict, stakes, resolution. Who discovered this? What did they get wrong? What was at stake?

2. **Counterintuitive Insight**: Something surprising that the viewer couldn't have guessed. The "wait, really?" moment.

3. **The Landing**: A personally applicable takeaway. The story must connect back to the reader's own situation, treatment, body, or decisions.

### Series Definitions

| Series | Description | Example Titles |
|--------|-------------|----------------|
| **Off-Label** | Drug origin stories, accidental discoveries, treatments used for unintended purposes | "The TB drug that invented antidepressants" |
| **Clinical Wisdom** | "What I tell patients who..." - practical advice from clinical experience | "What I tell patients who are scared of SSRIs" |
| **Literature Renaissance** | Recent studies validating lesser-known treatments | "Pramipexole: the Parkinson's drug that treats anhedonia" |

### Target Audience Reminder

This audience is **highly educated and intellectually curious**:
- PhD students, postdocs, residents, professors at University of Utah
- They want the "level deeper" that Google can't provide
- Think: people who watch Veritasium, listen to Radiolab, read Atul Gawande
- **Do not** oversimplify or use pop psychology tropes

### Voice and Tone

- Respect the audience's intelligence
- Embrace nuance and complexity
- Acknowledge uncertainty where it exists
- Be warm but substantive
- End with personal applicability ("The Landing")

### Example "Landing" Patterns

| Story | Landing |
|-------|---------|
| Lithium discovered by accident, ignored for 20 years | "If you have bipolar disorder and you've never been offered lithium, ask why. The best treatment we have is 75 years old and might be exactly what you need." |
| Pramipexole PAX-D trial | "If your depression looks like emptiness rather than sadness—if you've lost the ability to feel pleasure—there's now high-quality evidence for a treatment that works through a completely different mechanism." |

---

## Questions for Rufus

Before starting implementation, confirm:

1. **Domain routing**: Is `booking.trymoonlit.com/offlabel` the intended URL, or do you want `offlabel.trymoonlit.com`? (The former is simpler to implement)

2. **First article**: Do you have a draft ready, or should we seed with placeholder content?

3. **Author photo**: Do you have a headshot to use for the author profile?

4. **Analytics**: Do you want view tracking from day one?

---

*Implementation plan created January 5, 2026*
*Ready for Claude Code execution*
