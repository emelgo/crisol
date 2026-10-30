/** Lo que comparten los enlaces y los archivos del editor: las páginas y los archivos del mundo (aparte, sin ciclos) */
import type { NamedPage } from '@crisol/domain'
import { createContext } from 'react'
import type { ActionOutput } from '../api/client.ts'

/** Lo que necesitan los enlaces del editor: las páginas del mundo por su nombre, y crear una; y sus archivos */
export interface PageLinks {
  worldId: string
  names: readonly NamedPage[]
  byId: ReadonlyMap<string, NamedPage>
  create: (title: string) => Promise<string>
  files: readonly WorldFile[]
}

export type WorldFile = ActionOutput<'listFiles'>['files'][number]

export const PageLinksContext = createContext<PageLinks | null>(null)
