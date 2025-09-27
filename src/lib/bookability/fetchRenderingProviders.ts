import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

/**
 * Batch-load provider names to avoid N+1 queries
 * Returns a Map from provider ID to full name
 */
export async function fetchRenderingProviderNames(ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (!uniqueIds.length) return new Map<string, string>()

  const supabase = createClientComponentClient<Database>()

  const { data, error } = await supabase
    .from('providers')
    .select('id, first_name, last_name')
    .in('id', uniqueIds)

  if (error) {
    console.error('Error fetching rendering provider names:', error)
    return new Map<string, string>()
  }

  const map = new Map<string, string>()
  ;(data ?? []).forEach(p => {
    map.set(p.id, `${p.first_name} ${p.last_name}`)
  })

  return map
}