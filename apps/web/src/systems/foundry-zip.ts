/**
 * El zip de un sistema o un módulo de Foundry, leído aquí antes de subirlo (ADR-0015): su manifiesto dice sus
 * compendios, y de ellos se elige cuáles van. Se sube solo lo que hace falta (el manifiesto, sus idiomas y esos
 * compendios), sin imágenes ni código, para que pese poco
 */
import { strFromU8, unzipSync, zipSync } from 'fflate'

export interface FoundryPack {
  name: string
  label: string
  /** Item, Actor, JournalEntry, RollTable… */
  type: string
  /** Su carpeta (LevelDB) o su archivo (.db), dentro del zip */
  path: string
}

export interface FoundryZip {
  kind: 'system' | 'module'
  id: string
  title: string
  version: string
  packs: FoundryPack[]
  /** Dónde está el manifiesto dentro del zip (la carpeta del sistema), con su barra final o vacío */
  root: string
}

/** Lo que Crisol sabe traer: objetos, actores, diarios y tablas */
export const IMPORTED = new Set(['Item', 'Actor', 'JournalEntry', 'RollTable'])

const MANIFESTS = ['system.json', 'module.json']

/** Lee su manifiesto; si no es de Foundry, null */
export function readFoundryZip(bytes: Uint8Array): FoundryZip | null {
  let names: string[]
  try {
    names = Object.keys(unzipSync(bytes, { filter: (file) => MANIFESTS.some((m) => file.name.endsWith(m)) }))
  } catch {
    return null
  }
  // El más cercano a la raíz: dentro de un sistema puede haber otros JSON con ese nombre
  const found = names
    .filter((name) => MANIFESTS.includes(name.split('/').at(-1) ?? ''))
    .sort((a, b) => a.split('/').length - b.split('/').length)[0]
  if (!found) return null
  const file = unzipSync(bytes, { filter: (each) => each.name === found })[found]
  if (!file) return null
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(strFromU8(file)) as Record<string, unknown>
  } catch {
    return null
  }
  const root = found.slice(0, found.length - (found.split('/').at(-1) ?? '').length)
  const packs = (Array.isArray(manifest.packs) ? manifest.packs : []).flatMap((raw): FoundryPack[] => {
    const pack = raw as Record<string, unknown>
    const name = String(pack.name ?? '')
    const type = String(pack.type ?? pack.entity ?? '')
    if (!name || !IMPORTED.has(type)) return []
    const path = String(pack.path ?? `packs/${name}`).replace(/^\.?\//, '')
    return [{ name, label: String(pack.label ?? name), type, path }]
  })
  return {
    kind: found.endsWith('module.json') ? 'module' : 'system',
    id: String(manifest.id ?? manifest.name ?? ''),
    title: String(manifest.title ?? manifest.id ?? ''),
    version: String(manifest.version ?? ''),
    packs,
    root
  }
}

/** Un zip con solo lo que hace falta: el manifiesto, sus idiomas y los compendios elegidos */
export function slimZip(bytes: Uint8Array, foundry: FoundryZip, chosen: readonly string[]): Uint8Array {
  const paths = foundry.packs.filter((p) => chosen.includes(p.name)).map((p) => `${foundry.root}${p.path}`)
  const wanted = (name: string) =>
    MANIFESTS.some((m) => name === `${foundry.root}${m}`) ||
    (name.startsWith(`${foundry.root}lang/`) && name.endsWith('.json')) ||
    paths.some((path) => name === path || name.startsWith(`${path.replace(/\/$/, '')}/`))
  const files = unzipSync(bytes, { filter: (file) => wanted(file.name) })
  return zipSync(files, { level: 6 })
}

/** Unos bytes en base64, a trozos (uno entero no cabe en la pila) */
export function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}
