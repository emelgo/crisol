/**
 * Los conectores de IA (ADR-0030) y sus direcciones: «Crisol · Mundos» en /mcp y uno por campaña en
 * /mcp/campanas/:id. Cada dirección es también su recurso OAuth: el token de un conector solo vale en él
 */

/** «Crisol · Mundos». Quien solo juega (no lleva ninguna cuenta ni ningún mundo) solo ve las herramientas de leer */
export interface WorldsScope {
  kind: 'worlds'
  readOnly: boolean
}

/** «Crisol · {campaña}»: la campaña, su mundo y el papel en ella de quien conecta (máster de ella o de su mundo) */
export interface CampaignScope {
  kind: 'campaign'
  campaignId: string
  worldId: string
  organizationId: string
  name: string
  role: 'master' | 'player'
}

export type McpScope = WorldsScope | CampaignScope

export const WORLDS: WorldsScope = { kind: 'worlds', readOnly: false }

/** La dirección de «Crisol · Mundos» */
export const mcpResource = (baseURL: string) => new URL('/mcp', baseURL).toString()

/** La dirección del conector de una campaña */
export const campaignResource = (baseURL: string, campaignId: string) =>
  new URL(`/mcp/campanas/${campaignId}`, baseURL).toString()

const CAMPAIGN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** De qué campaña es una dirección; null si no es la de una campaña (o no lleva un id) */
export function campaignOfResource(baseURL: string, resource: string): string | null {
  const prefix = campaignResource(baseURL, '')
  if (!resource.startsWith(prefix)) return null
  const id = resource.slice(prefix.length)
  return CAMPAIGN_ID.test(id) ? id : null
}
