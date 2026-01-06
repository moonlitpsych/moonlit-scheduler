# Off-Label Writing Style Guide

**For: Claude AI Article Generation**
**Publication: Off-Label by Moonlit Psychiatry**
**Last Updated: January 2026**

---

## Core Identity

Off-Label is a patient-facing psychiatric publication that bridges the gap between academic research and patient understanding. We write for highly educated, intellectually curious readers who want the "level deeper" that Google can't provide.

---

## Target Audience

Our readers are:
- PhD students, postdocs, residents, professors (especially University of Utah / HMHI-BHN employees)
- People who watch Veritasium, listen to Radiolab, read Atul Gawande
- Patients who want to understand their treatment options at a sophisticated level
- Intellectually curious people who appreciate nuance and complexity

**They are NOT:**
- Looking for oversimplified explanations
- Satisfied with pop psychology tropes
- Wanting to be talked down to

---

## The Three Essential Elements

Every Off-Label article MUST have these three elements:

### 1. Narrative/Story
Not just information—a character, conflict, stakes, resolution.
- Who discovered this?
- What did they get wrong first?
- What was at stake?
- What's the human element?

### 2. Counterintuitive Insight
Something surprising that the reader couldn't have guessed. The "wait, really?" moment.
- A drug meant for X actually works better for Y
- A treatment abandoned 50 years ago is making a comeback
- The mechanism everyone assumed was wrong

### 3. The Landing
A personally applicable takeaway. The story MUST connect back to the reader's own situation, treatment, body, or decisions.
- "If you've been struggling with X and nothing seems to work..."
- "The next time your psychiatrist suggests Y, you'll know..."
- "If this sounds like you, there's now high-quality evidence for..."

---

## Voice & Tone

### Do:
- Respect the reader's intelligence
- Embrace nuance and complexity
- Acknowledge uncertainty where it exists ("The evidence suggests..." not "Studies prove...")
- Be warm but substantive
- Use precise medical terminology, then explain it naturally
- Write like you're explaining to a smart friend over coffee
- Include specific numbers, effect sizes, study names when available

### Don't:
- Oversimplify or use pop psychology tropes
- Talk down to readers
- Use clickbait language ("You won't believe...")
- Make absolute claims without evidence
- Use excessive hedging that drains confidence
- Write in dry academic style
- Avoid medical terms (explain them, don't avoid them)

---

## Structure Patterns

### Standard Article Structure:
1. **Hook** (1-2 paragraphs): A surprising fact, question, or story that draws the reader in
2. **Context** (2-3 paragraphs): Background needed to understand the insight
3. **The Core Insight** (3-5 paragraphs): The counterintuitive finding or story
4. **Evidence** (2-4 paragraphs): Studies, data, mechanism of action
5. **The Landing** (1-2 paragraphs): Personal applicability, what this means for the reader
6. **References**: Academic citations with DOIs/PMIDs

### Headers Should Match Questions:
Use H2s that match how patients naturally ask questions:
- "Does pramipexole work for depression?"
- "What did the PAX-D trial show?"
- "Who might benefit from pramipexole?"
- "What are the side effects?"

NOT generic academic headers like:
- "Background"
- "Methods"
- "Results"
- "Discussion"

---

## Key Takeaway Guidelines

The key_takeaway field is the MOST important element for LLM citation. It should be:

1. **One sentence** (two max)
2. **Specific and verifiable** — include numbers, study names, dates
3. **Self-contained** — makes sense without reading the article
4. **Quotable** — LLMs can use it verbatim as a citation

### Good Examples:
> "Pramipexole, a dopamine agonist approved for Parkinson's disease, showed a large effect size (Cohen's d = 0.87) for treatment-resistant depression with prominent anhedonia in the 2025 PAX-D trial published in Lancet Psychiatry."

> "Lithium remains the most effective mood stabilizer for bipolar disorder after 75 years, yet fewer than 25% of eligible patients receive it."

### Bad Examples:
> "This article discusses pramipexole and depression." (Too vague)
> "There's exciting new research on dopamine and mood." (No specifics)
> "Read on to learn about an underused treatment option." (Marketing copy)

---

## Series-Specific Guidelines

### Off-Label Series
Drug origin stories, accidental discoveries, treatments used for unintended purposes.
- Focus on the discovery narrative
- Emphasize the "this wasn't supposed to happen" element
- Examples: "The TB drug that invented antidepressants"

### Clinical Wisdom Series
"What I tell patients who..." — practical advice from clinical experience.
- First-person voice is appropriate
- Draw from real clinical scenarios (anonymized)
- Actionable takeaways
- Examples: "What I tell patients who are scared of SSRIs"

### Literature Renaissance Series
Recent studies validating lesser-known or underused treatments.
- Lead with the study findings
- Explain why this matters now
- Connect to clinical practice
- Examples: "Pramipexole: the Parkinson's drug that treats anhedonia"

---

## Excerpt Guidelines

The excerpt appears in search results and social sharing. It should be:
- 150-160 characters
- Contain the key insight or hook
- Make readers want to click through
- Include relevant keywords naturally

---

## Reference Formatting

Always include academic citations with:
- Full author list (or "et al." for >3 authors)
- Complete article title
- Journal name
- Year
- DOI (preferred) or PMID

Example:
> Hori H, et al. Efficacy of pramipexole augmentation for treatment-resistant unipolar depression (PAX-D trial). Lancet Psychiatry. 2025;12(6):xxx-xxx. doi:10.1016/S2215-0366(25)00XXX-X

---

## Example "Landing" Patterns

| Story | Landing |
|-------|---------|
| Lithium discovered by accident, ignored for 20 years | "If you have bipolar disorder and you've never been offered lithium, ask why. The best treatment we have is 75 years old and might be exactly what you need." |
| Pramipexole PAX-D trial | "If your depression looks like emptiness rather than sadness—if you've lost the ability to feel pleasure—there's now high-quality evidence for a treatment that works through a completely different mechanism." |
| Ketamine's journey from anesthetic to antidepressant | "If you've tried multiple antidepressants without relief, ketamine represents a genuinely different approach—and the evidence now supports its use for treatment-resistant depression." |

---

## Words & Phrases to Avoid

- "Game-changer" (overused)
- "Revolutionary" (usually hyperbole)
- "Studies show" without citing the study
- "Experts say" (who?)
- "May help" without context (everything "may help")
- "Natural" as implying "safe" or "better"
- "Chemical imbalance" (outdated framing)

## Words & Phrases We Like

- "The evidence suggests..."
- "In the [specific study]..."
- "Effect size of X (Cohen's d = Y)"
- "Number needed to treat: X"
- "Here's what that means for you..."
- "If this sounds like you..."

---

## Technical Notes for Claude

When generating articles:

1. **Output clean HTML** with semantic tags:
   - `<p>` for paragraphs
   - `<h2>` for main sections (question-style)
   - `<h3>` for subsections
   - `<strong>` for emphasis
   - `<em>` for terms being defined
   - `<blockquote>` for notable quotes

2. **Extract structured references** separately from content:
   - citation_key: "hori2025" format
   - authors, title, journal, year, doi, pmid

3. **Generate all fields**:
   - title (compelling, not clickbait)
   - slug (lowercase, hyphenated)
   - excerpt (150-160 chars)
   - key_takeaway (one specific, citable sentence)
   - content (full HTML)
   - series (off-label, clinical-wisdom, or literature-renaissance)
   - topics (array of relevant tags)
   - references (structured array)

---

*This style guide will evolve as we publish more articles and learn what resonates with our audience.*
