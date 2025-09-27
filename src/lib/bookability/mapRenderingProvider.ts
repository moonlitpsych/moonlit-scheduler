/**
 * Helper to extract the rendering provider ID from bookability rows
 * Falls back to billing_provider_id for backward compatibility
 */
export function getRenderingProviderId(row: any): string | null {
  return row?.rendering_provider_id ?? row?.billing_provider_id ?? null;
}