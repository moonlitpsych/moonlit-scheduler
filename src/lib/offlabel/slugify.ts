/**
 * Convert a string to a URL-safe slug
 *
 * Examples:
 *   "The TB Drug That Invented Antidepressants" -> "the-tb-drug-that-invented-antidepressants"
 *   "What I Tell Patients Who Are Scared of SSRIs" -> "what-i-tell-patients-who-are-scared-of-ssris"
 *   "Pramipexole: The Parkinson's Drug That Treats Anhedonia" -> "pramipexole-the-parkinsons-drug-that-treats-anhedonia"
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove special characters except hyphens
    .replace(/[^\w\-]+/g, '')
    // Replace multiple hyphens with single hyphen
    .replace(/\-\-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

/**
 * Generate a unique slug by appending a number if the base slug is taken
 *
 * @param baseSlug - The initial slug to try
 * @param checkAvailability - Async function that returns true if slug is available
 * @returns A unique slug
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkAvailability: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (!(await checkAvailability(slug))) {
    counter++
    slug = `${baseSlug}-${counter}`
  }

  return slug
}
