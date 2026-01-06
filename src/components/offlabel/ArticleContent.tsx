interface ArticleContentProps {
  content: string
}

/**
 * Renders HTML article content with proper typography styling.
 *
 * The content comes from TipTap editor and is stored as HTML.
 * We use dangerouslySetInnerHTML because content is authored by trusted admins.
 */
export function ArticleContent({ content }: ArticleContentProps) {
  return (
    <div
      className="article-content"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

/**
 * CSS for article content should be added to globals.css:
 *
 * .article-content h2 {
 *   @apply text-2xl font-['Newsreader'] font-semibold mt-10 mb-4 text-[#091747];
 * }
 * .article-content h3 {
 *   @apply text-xl font-['Newsreader'] font-semibold mt-8 mb-3 text-[#091747];
 * }
 * .article-content p {
 *   @apply text-lg leading-relaxed mb-6 text-[#091747]/90 font-['Newsreader'];
 * }
 * .article-content ul {
 *   @apply list-disc pl-6 mb-6 space-y-2;
 * }
 * .article-content ol {
 *   @apply list-decimal pl-6 mb-6 space-y-2;
 * }
 * .article-content li {
 *   @apply text-lg text-[#091747]/90 font-['Newsreader'];
 * }
 * .article-content blockquote {
 *   @apply border-l-4 border-[#BF9C73] pl-6 italic my-6 text-[#091747]/80 font-['Newsreader'];
 * }
 * .article-content a {
 *   @apply text-[#BF9C73] hover:underline;
 * }
 * .article-content code {
 *   @apply bg-stone-100 px-1.5 py-0.5 rounded text-sm font-mono;
 * }
 * .article-content pre {
 *   @apply bg-stone-100 p-4 rounded-lg overflow-x-auto mb-6;
 * }
 * .article-content pre code {
 *   @apply bg-transparent p-0;
 * }
 * .article-content hr {
 *   @apply my-8 border-stone-200;
 * }
 */
