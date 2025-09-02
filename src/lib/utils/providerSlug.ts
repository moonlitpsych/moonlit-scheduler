import { Provider } from '@/types/provider'

/**
 * Generate a URL-friendly slug from a provider's name
 * Example: "Travis Norseth" -> "dr-travis-norseth"
 */
export function generateProviderSlug(provider: Pick<Provider, 'first_name' | 'last_name'>) {
    if (!provider.first_name || !provider.last_name) {
        throw new Error('Provider must have both first_name and last_name to generate slug')
    }
    
    const name = `dr-${provider.first_name}-${provider.last_name}`.toLowerCase()
    return name
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-')         // Replace spaces with hyphens
        .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
        .trim()                       // Remove leading/trailing whitespace
        .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
}

/**
 * Parse a provider slug back to name components
 * Example: "dr-travis-norseth" -> { first_name: "Travis", last_name: "Norseth" }
 */
export function parseProviderSlug(slug: string): { first_name: string, last_name: string } | null {
    if (!slug || typeof slug !== 'string') {
        return null
    }

    // Remove 'dr-' prefix if present
    const nameSlug = slug.startsWith('dr-') ? slug.slice(3) : slug
    
    // Split by hyphens and reconstruct names
    const parts = nameSlug.split('-').filter(part => part.length > 0)
    
    if (parts.length < 2) {
        return null
    }

    // Capitalize each part
    const capitalizedParts = parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    )

    // First part is first name, last part is last name
    // If there are middle parts, they go with the first name
    const firstName = capitalizedParts.slice(0, -1).join(' ')
    const lastName = capitalizedParts[capitalizedParts.length - 1]

    return {
        first_name: firstName,
        last_name: lastName
    }
}

/**
 * Check if a string looks like a UUID (provider ID) vs a slug
 */
export function isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}

/**
 * Determine if the identifier is a UUID (legacy) or a slug (new format)
 */
export function getProviderLookupType(identifier: string): 'uuid' | 'slug' {
    return isUUID(identifier) ? 'uuid' : 'slug'
}