/**
 * Helper to extract the rendering provider ID from bookability rows
 * Uses the corrected rendering_provider_id_effective field when available
 */
export function getRenderingProviderId(row: any): string | null {
  // Use the corrected effective field if available
  if (row?.rendering_provider_id_effective) {
    return row.rendering_provider_id_effective;
  }

  // Fall back to the original logic for backward compatibility
  return row?.rendering_provider_id ?? row?.billing_provider_id ?? null;
}