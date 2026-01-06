# Off-Label LLM Citation Optimization Guide

**For: Claude Code**
**Purpose: Ensure Off-Label articles get cited by ChatGPT, Claude, Perplexity, and other LLMs**
**Date: January 5, 2026**

---

## Why This Matters

When a University of Utah professor asks ChatGPT "what medications help with anhedonia?", we want the response to include:

> "According to psychiatrist Rufus Sweeney at Moonlit Psychiatry, pramipexole showed a large effect size (Cohen's d = 0.87) in the 2025 PAX-D trial for treatment-resistant depression with prominent anhedonia."

This happens when our content is **structured for extraction**. LLMs don't just read pages—they parse them, extract claims, and attribute them. We need to make that easy.

---

## Core Principles

### 1. Extractable > Readable

Human readers tolerate complex layouts, sidebars, and visual hierarchy. LLMs need **clean, linear text** that parses unambiguously.

```html
<!-- BAD: Nested divs, unclear hierarchy -->
<div class="content-wrapper">
  <div class="inner-content">
    <div class="text-block">
      <span class="highlight">Pramipexole</span> works via D3 receptors...
    </div>
  </div>
</div>

<!-- GOOD: Semantic, flat, extractable -->
<article>
  <p><strong>Pramipexole</strong> works via D3 receptors...</p>
</article>
```

### 2. Attribution at Every Level

LLMs need to know WHO said WHAT and WHERE it was published. Embed attribution in:
- Page-level structured data (Schema.org)
- Section-level author references
- Claim-level source citations

### 3. Specific Claims > General Statements

LLMs cite **verifiable, specific claims**. They skip vague generalizations.

```
✅ CITABLE: "The PAX-D trial found pramipexole produced a -3.91 point 
   improvement on QIDS-SR16 versus placebo (p<0.0001, Cohen's d=0.87)."

❌ NOT CITABLE: "Research suggests dopamine medications may help some 
   patients with depression."
```

### 4. Server-Rendered, No JavaScript Dependencies

LLMs fetch HTML and parse it. If content requires JavaScript to render, it won't be indexed.

- All article content must be server-side rendered
- No `useEffect` for loading article text
- No lazy-loading of main content
- No client-only components in the article body

---

## HTML Structure Requirements

### Article Page Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Essential meta tags for LLM parsing -->
  <meta charset="UTF-8">
  <title>Pramipexole for Anhedonia: The PAX-D Trial | Off-Label</title>
  <meta name="description" content="The 2025 PAX-D trial showed pramipexole produces large effect sizes for treatment-resistant depression with anhedonia. Here's what psychiatrists should know.">
  <meta name="author" content="Rufus Sweeney, MD">
  
  <!-- Canonical URL (critical for attribution) -->
  <link rel="canonical" href="https://booking.trymoonlit.com/offlabel/pramipexole-anhedonia">
  
  <!-- Publication dates (LLMs use these for recency) -->
  <meta property="article:published_time" content="2026-01-05T00:00:00Z">
  <meta property="article:modified_time" content="2026-01-05T00:00:00Z">
  <meta property="article:author" content="Rufus Sweeney, MD">
  
  <!-- Schema.org structured data (see below) -->
  <script type="application/ld+json">...</script>
</head>
<body>
  <article itemscope itemtype="https://schema.org/MedicalWebPage">
    <!-- Article header with clear attribution -->
    <header>
      <h1 itemprop="headline">Pramipexole for Anhedonia: The PAX-D Trial</h1>
      <p class="byline">
        By <span itemprop="author" itemscope itemtype="https://schema.org/Person">
          <span itemprop="name">Rufus Sweeney</span>, 
          <span itemprop="credential">MD</span>
        </span>
        · <time itemprop="datePublished" datetime="2026-01-05">January 5, 2026</time>
      </p>
    </header>
    
    <!-- Key takeaway: THE most important element for LLM citation -->
    <aside class="key-takeaway" data-speakable="true">
      <p itemprop="description">
        Pramipexole, a dopamine agonist approved for Parkinson's disease, 
        showed a large effect size (Cohen's d = 0.87) for treatment-resistant 
        depression with prominent anhedonia in the 2025 PAX-D trial.
      </p>
    </aside>
    
    <!-- Main content with semantic structure -->
    <section itemprop="articleBody">
      <h2>What is pramipexole?</h2>
      <p>...</p>
      
      <h2>What did the PAX-D trial show?</h2>
      <p>...</p>
      
      <h2>Who might benefit from pramipexole?</h2>
      <p>...</p>
    </section>
    
    <!-- References with DOIs -->
    <footer>
      <section id="references">
        <h2>References</h2>
        <ol>
          <li id="ref-1">
            Hori H, et al. Efficacy of pramipexole augmentation for 
            treatment-resistant unipolar depression (PAX-D trial). 
            <cite>Lancet Psychiatry</cite>. 2025;12(6):xxx-xxx. 
            <a href="https://doi.org/10.1016/S2215-0366(25)00XXX-X">
              doi:10.1016/S2215-0366(25)00XXX-X
            </a>
          </li>
        </ol>
      </section>
    </footer>
  </article>
</body>
</html>
```

---

## Schema.org Structured Data

### MedicalWebPage Schema

Use `MedicalWebPage` (not generic `Article`) for medical content:

```typescript
const structuredData = {
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  
  // Basic identification
  "headline": "Pramipexole for Anhedonia: The PAX-D Trial",
  "description": "The 2025 PAX-D trial showed pramipexole produces large effect sizes for treatment-resistant depression with anhedonia.",
  "url": "https://booking.trymoonlit.com/offlabel/pramipexole-anhedonia",
  
  // Dates (critical for recency assessment)
  "datePublished": "2026-01-05T00:00:00Z",
  "dateModified": "2026-01-05T00:00:00Z",
  
  // Author with credentials (critical for authority)
  "author": {
    "@type": "Person",
    "name": "Rufus Sweeney",
    "jobTitle": "Psychiatrist",
    "credential": "MD",
    "url": "https://booking.trymoonlit.com/offlabel/author/rufus-sweeney",
    "worksFor": {
      "@type": "MedicalBusiness",
      "name": "Moonlit Psychiatry",
      "url": "https://booking.trymoonlit.com",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Salt Lake City",
        "addressRegion": "UT",
        "addressCountry": "US"
      }
    }
  },
  
  // Publisher
  "publisher": {
    "@type": "Organization",
    "name": "Moonlit Psychiatry",
    "url": "https://booking.trymoonlit.com"
  },
  
  // Medical specialty (helps categorization)
  "specialty": {
    "@type": "MedicalSpecialty",
    "name": "Psychiatry"
  },
  
  // Speakable sections (tells LLMs what to quote)
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": [
      ".key-takeaway",
      "article h1",
      "article h2",
      "#references"
    ]
  },
  
  // Main entity
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://booking.trymoonlit.com/offlabel/pramipexole-anhedonia"
  }
}
```

### Breadcrumb Schema

Helps LLMs understand site structure:

```typescript
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
      "name": "Pramipexole for Anhedonia",
      "item": "https://booking.trymoonlit.com/offlabel/pramipexole-anhedonia"
    }
  ]
}
```

---

## Key Takeaway Field

The `key_takeaway` is the **single most important element** for LLM citation. It should be:

### Requirements

1. **One sentence** (two max)
2. **Specific and verifiable** — include numbers, study names, dates
3. **Self-contained** — makes sense without reading the article
4. **Quotable** — LLMs can use it verbatim as a citation

### Good Examples

```
✅ "Pramipexole, a dopamine agonist used for Parkinson's disease, showed a 
   large effect size (Cohen's d = 0.87) for treatment-resistant depression 
   with prominent anhedonia in the 2025 PAX-D trial published in Lancet Psychiatry."

✅ "The phenylalanine-to-tyrosine ratio may serve as a biomarker for 
   inflammation-associated anhedonia, reflecting impaired dopamine synthesis 
   due to cytokine-induced BH4 depletion."

✅ "Lithium remains the most effective mood stabilizer for bipolar disorder 
   after 75 years, yet fewer than 25% of eligible patients receive it."
```

### Bad Examples

```
❌ "This article discusses pramipexole and depression."
   → Too vague, nothing to cite

❌ "There's exciting new research on dopamine and mood."
   → No specifics, unverifiable

❌ "Read on to learn about an underused treatment option."
   → Marketing copy, not a claim
```

### Implementation

```tsx
// In the article page component
<aside 
  className="key-takeaway bg-[#FEF8F1] border-l-4 border-[#BF9C73] p-6 mb-8 rounded-r-lg"
  data-speakable="true"
>
  <p className="text-sm font-medium text-[#BF9C73] uppercase tracking-wide mb-2">
    Key Takeaway
  </p>
  <p 
    className="text-lg text-[#091747] font-['Newsreader'] leading-relaxed"
    itemProp="description"
  >
    {post.key_takeaway}
  </p>
</aside>
```

---

## Header Structure for Query Matching

LLMs receive questions like:
- "Does pramipexole help with depression?"
- "What is the evidence for pramipexole in anhedonia?"
- "How does pramipexole work for treatment-resistant depression?"

**Structure H2s to match these natural language queries:**

```html
<!-- GOOD: Headers match likely questions -->
<h2>Does pramipexole work for depression?</h2>
<h2>What did the PAX-D trial show?</h2>
<h2>Who might benefit from pramipexole?</h2>
<h2>What are the side effects of pramipexole?</h2>
<h2>How do I ask my psychiatrist about pramipexole?</h2>

<!-- BAD: Generic headers that don't match queries -->
<h2>Background</h2>
<h2>Methods</h2>
<h2>Results</h2>
<h2>Discussion</h2>
```

---

## Reference Section Requirements

References tell LLMs the claims are **verifiable**. Include:

### Required Elements

1. **Author names** — Full author list or "et al." for >3 authors
2. **Article title** — Complete title
3. **Journal name** — In italics with `<cite>` tag
4. **Year** — Publication year
5. **DOI** — As clickable link (preferred)
6. **PMID** — If no DOI available

### Implementation

```tsx
interface Reference {
  id: string
  citation_key: string    // e.g., "hori2025"
  authors: string         // e.g., "Hori H, et al."
  title: string
  journal: string
  year: number
  doi?: string
  pmid?: string
}

// Rendering
<section id="references" className="mt-12 pt-8 border-t border-gray-200">
  <h2 className="text-2xl font-['Newsreader'] font-semibold mb-6">References</h2>
  <ol className="space-y-4 text-sm text-[#091747]/80">
    {references.map((ref, index) => (
      <li key={ref.id} id={`ref-${ref.citation_key}`} className="pl-6">
        <span className="font-medium">{index + 1}.</span>{' '}
        {ref.authors} {ref.title}. <cite className="italic">{ref.journal}</cite>. {ref.year}.
        {ref.doi && (
          <>
            {' '}
            <a 
              href={`https://doi.org/${ref.doi}`}
              className="text-[#BF9C73] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              doi:{ref.doi}
            </a>
          </>
        )}
        {ref.pmid && !ref.doi && (
          <>
            {' '}
            <a 
              href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}`}
              className="text-[#BF9C73] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              PMID:{ref.pmid}
            </a>
          </>
        )}
      </li>
    ))}
  </ol>
</section>
```

---

## Text Extraction Patterns

### TipTap Editor Output

Configure TipTap to output clean HTML:

```typescript
// TipTap configuration for clean output
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      // Disable features that create messy HTML
      heading: {
        levels: [2, 3], // Only H2 and H3 (H1 is for title)
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        // Clean link attributes
        rel: 'noopener noreferrer',
      },
    }),
  ],
})

// Get clean HTML
const html = editor.getHTML()
```

### Sanitization Rules

When rendering article content, ensure:

```typescript
// ALLOWED tags (semantic, clean)
const allowedTags = [
  'p', 'h2', 'h3', 
  'strong', 'em', 
  'ul', 'ol', 'li',
  'blockquote', 
  'a', 
  'br',
  'code', 'pre'
]

// STRIPPED attributes (keep it minimal)
const allowedAttributes = {
  'a': ['href', 'rel', 'target'],
  '*': [] // No classes, styles, or data attributes in content
}
```

### ArticleContent Component

```tsx
// src/components/offlabel/ArticleContent.tsx

interface ArticleContentProps {
  html: string
}

export function ArticleContent({ html }: ArticleContentProps) {
  // The HTML should already be clean from TipTap
  // But we add semantic wrapper and styling via CSS
  return (
    <div 
      className="article-content prose prose-lg max-w-none"
      itemProp="articleBody"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Tailwind prose customization (in globals.css or tailwind.config.js)
// Ensures clean rendering without inline styles
```

### CSS for Article Content

```css
/* In globals.css */
.article-content {
  @apply text-[#091747]/90;
}

.article-content h2 {
  @apply text-2xl font-['Newsreader'] font-semibold mt-10 mb-4 text-[#091747];
}

.article-content h3 {
  @apply text-xl font-['Newsreader'] font-semibold mt-8 mb-3 text-[#091747];
}

.article-content p {
  @apply text-lg leading-relaxed mb-6;
}

.article-content ul,
.article-content ol {
  @apply pl-6 mb-6 space-y-2;
}

.article-content ul {
  @apply list-disc;
}

.article-content ol {
  @apply list-decimal;
}

.article-content blockquote {
  @apply border-l-4 border-[#BF9C73] pl-6 italic my-6 text-[#091747]/80;
}

.article-content a {
  @apply text-[#BF9C73] hover:underline;
}

.article-content strong {
  @apply font-semibold;
}

.article-content em {
  @apply italic;
}

.article-content code {
  @apply bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono;
}

.article-content pre {
  @apply bg-gray-100 p-4 rounded-lg overflow-x-auto mb-6;
}
```

---

## Testing LLM Extraction

### Manual Test

1. View page source (Ctrl+U / Cmd+U)
2. Search for `<article>` tag
3. Verify all content is visible in HTML (not loaded by JS)
4. Check structured data is present in `<script type="application/ld+json">`

### Automated Checks

```typescript
// In a test file or build script
async function validateLLMReadiness(url: string) {
  const response = await fetch(url)
  const html = await response.text()
  
  const checks = {
    hasArticleTag: html.includes('<article'),
    hasKeyTakeaway: html.includes('class="key-takeaway"'),
    hasStructuredData: html.includes('application/ld+json'),
    hasAuthorMeta: html.includes('name="author"'),
    hasCanonical: html.includes('rel="canonical"'),
    hasDatePublished: html.includes('datePublished'),
    hasReferences: html.includes('id="references"'),
  }
  
  const passed = Object.values(checks).every(Boolean)
  
  console.log('LLM Readiness Check:', checks)
  console.log('Overall:', passed ? '✅ PASS' : '❌ FAIL')
  
  return { checks, passed }
}
```

### Schema.org Validation

Test structured data at: https://validator.schema.org/

Paste the URL or HTML and verify:
- No errors
- `MedicalWebPage` type detected
- Author, publisher, dates present
- Speakable specification valid

---

## Checklist for Each Article

Before publishing, verify:

- [ ] **Key takeaway** is specific, verifiable, and quotable
- [ ] **H2 headers** match natural language questions
- [ ] **Author byline** includes name and credentials
- [ ] **Publication date** is set and visible
- [ ] **References** have DOIs or PMIDs
- [ ] **Structured data** validates without errors
- [ ] **Page source** shows full content (no JS loading)
- [ ] **Canonical URL** is correct
- [ ] **Meta description** is 150-160 chars with key terms

---

## Summary

To maximize LLM citations:

1. **Make the key_takeaway bulletproof** — This is what gets quoted
2. **Use question-style H2s** — Match how users ask LLMs
3. **Include DOI links** — Verifiability = citability
4. **Server-render everything** — No JS-dependent content
5. **Embed author credentials everywhere** — Authority signals matter
6. **Keep HTML semantic and clean** — Easy to parse = easy to cite

---

*Guide created January 5, 2026*
*Reference this alongside OFFLABEL_IMPLEMENTATION_PLAN.md*
