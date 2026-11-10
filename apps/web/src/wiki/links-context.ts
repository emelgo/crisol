/** Lo que comparten los enlaces y los archivos del editor: las páginas y los archivos del mundo (aparte, sin ciclos) */
import type { NamedPage } from '@crisol/domain'
import { createContext } from 'react'
import type { ActionOutput } from '../api/client.ts'

/** Lo que necesitan los enlaces del editor: las páginas del mundo por su nombre, y crear una; y sus archivos */
export interface PageLinks {
  worldId: string
  names: readonly NamedPage[]
  byId: ReadonlyMap<string, NamedPage>
  /** Crea la página que falta (con una plantilla, si se da) y da su id */
  create: (title: string, template?: string) => Promise<string>
  files: readonly WorldFile[]
  /** false: no se crean páginas desde un enlace (un jugador escribe con lo que conoce) */
  canCreate?: boolean
  /** Lo que se puede enlazar del compendio con `[[@`: del mundo y de los sistemas de sus campañas */
  searchContent?: (query: string) => Promise<LinkableContent[]>
}

export type WorldFile = ActionOutput<'listFiles'>['files'][number]
export type LinkableContent = ActionOutput<'searchLinkableContent'>['items'][number]

export const PageLinksContext = createContext<PageLinks | null>(null)
