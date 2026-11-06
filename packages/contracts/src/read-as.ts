import { z } from 'zod'

/**
 * Para leer como jugador (ADR-0017): la campaña desde la que lee (si juega una sola del mundo, se deduce) y, quien
 * lleva la wiki, como qué personaje de esa campaña («Ver como jugador»; campaign: la campaña sin excepciones)
 */
export const readAs = {
  campaignId: z
    .uuid()
    .optional()
    .describe('Leer desde esta campaña, con lo que sabe (un jugador; si juega una sola del mundo, se deduce)'),
  asCharacterId: z
    .union([z.uuid(), z.literal('campaign')])
    .optional()
    .describe('Quien lleva la wiki: leer como ese personaje de la campaña (campaign: la campaña, sin excepciones)')
}
