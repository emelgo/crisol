import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core'
import { campaigns } from './campaigns.ts'
import { trackedColumns } from './tracked.ts'

/** Un contenedor del grupo («El carro»); el de serie, «Del grupo», no se guarda */
export interface PartyContainerRow {
  id: string
  name: string
}

/** Un objeto del grupo: del compendio (su clave y su nombre) o escrito a mano (key null), con su cantidad */
export interface PartyItemRow {
  id: string
  key: string | null
  name: string
  note?: string
  quantity: number
  container: string
}

/**
 * El inventario del grupo de una campaña (docs/specs/grupo.md): sus contenedores, sus objetos y sus monedas. Una fila
 * por campaña, que nace al ponerle algo; pasa por el historial (mover con un personaje es una sola operación)
 */
export const campaignParty = pgTable('campaign_party', {
  ...trackedColumns(),
  campaignId: uuid()
    .notNull()
    .unique()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  containers: jsonb().$type<PartyContainerRow[]>().notNull().default([]),
  items: jsonb().$type<PartyItemRow[]>().notNull().default([]),
  coins: jsonb().$type<Record<string, number>>().notNull().default({})
})
