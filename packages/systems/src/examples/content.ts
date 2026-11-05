/**
 * El contenido de los sistemas de serie (srd-5e): JSON por categorías junto a cada sistema. Pesa mucho: lo lee solo el
 * servidor, una vez, y a la web llega por las acciones (buscar y leer), nunca en su paquete
 */
import { readdirSync, readFileSync } from 'node:fs'
import type { ContentItem } from '../file.ts'

const FOLDERS: Record<string, string> = { '5e': './5e/content/' }
const loaded = new Map<string, readonly ContentItem[]>()

/** El contenido de un sistema de serie, en el orden de sus archivos (sin contenido, ninguno) */
export function catalogContent(systemId: string): readonly ContentItem[] {
  const cached = loaded.get(systemId)
  if (cached) return cached
  if (!Object.hasOwn(FOLDERS, systemId)) return []
  const folder = new URL(FOLDERS[systemId] as string, import.meta.url)
  const items = readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => JSON.parse(readFileSync(new URL(name, folder), 'utf8')) as ContentItem[])
  loaded.set(systemId, items)
  return items
}
