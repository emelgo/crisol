/**
 * El contenido de los sistemas de ejemplo (srd-5e): JSON por categorías junto a cada sistema. No viene de serie
 * (ADR-0015): sirve para las pruebas y para armar su archivo, que se importa como cualquier otro
 */
import { readdirSync, readFileSync } from 'node:fs'
import type { ContentItem } from '../file.ts'

const FOLDERS: Record<string, string> = { '5e': './5e/content/' }
const loaded = new Map<string, readonly ContentItem[]>()

/** El contenido de un sistema de ejemplo, en el orden de sus archivos (sin contenido, ninguno) */
export function exampleContent(systemId: string): readonly ContentItem[] {
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
