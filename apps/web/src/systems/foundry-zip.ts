/**
 * El zip de un sistema o un módulo de Foundry, leído aquí antes de subirlo (ADR-0015): su manifiesto dice sus
 * compendios, y de ellos se elige cuáles van. Se sube solo lo que hace falta (el manifiesto, sus idiomas, sus mapas de
 * arte y esos compendios), sin imágenes ni código, para que pese poco; las imágenes que nombra lo importado se sacan
 * después de aquí mismo y se suben aparte (docs/specs/imagenes.md)
 */
import { type ImageLicense, licenseOf, zipPathOf } from '@crisol/systems/foundry'
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
  /** Sus paquetes de escenas, de aventuras y de listas de sonido (docs/specs/escenas-foundry.md, sonido-foundry.md) */
  scenePacks: FoundryPack[]
  /** Dónde está el manifiesto dentro del zip (la carpeta del sistema), con su barra final o vacío */
  root: string
  /** Sus mapas de arte (el retrato de cada actor), dentro del zip */
  art: string[]
  /** Los idiomas de sus textos (los de su manifiesto: «en», «es»…) */
  languages: string[]
}

/** Una imagen que nombra lo importado, sacada del zip, con su licencia */
export interface ZipImage {
  path: string
  bytes: Uint8Array
  license: ImageLicense
  credit: string | null
}

/** Lo que Crisol sabe traer: objetos, actores, diarios y tablas */
export const IMPORTED = new Set(['Item', 'Actor', 'JournalEntry', 'RollTable'])
/** Y, a un mundo, sus escenas, aventuras y listas de sonido */
export const SCENES = new Set(['Scene', 'Adventure', 'Playlist'])

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
  const all = (Array.isArray(manifest.packs) ? manifest.packs : []).flatMap((raw): FoundryPack[] => {
    const pack = raw as Record<string, unknown>
    const name = String(pack.name ?? '')
    const type = String(pack.type ?? pack.entity ?? '')
    if (!name) return []
    const path = String(pack.path ?? `packs/${name}`).replace(/^\.?\//, '')
    return [{ name, label: String(pack.label ?? name), type, path }]
  })
  const packs = all.filter((p) => IMPORTED.has(p.type))
  const scenePacks = all.filter((p) => SCENES.has(p.type))
  const kind = found.endsWith('module.json') ? 'module' : 'system'
  const id = String(manifest.id ?? manifest.name ?? '')
  const flags = (manifest.flags ?? {}) as Record<string, unknown>
  const mappings = Object.values((flags.compendiumArtMappings ?? {}) as Record<string, { mapping?: unknown }>)
  const art = mappings.flatMap((m) => {
    const inside = typeof m?.mapping === 'string' ? zipPathOf(m.mapping, { id, kind, root }) : null
    return inside ? [inside] : []
  })
  return {
    kind,
    id,
    title: String(manifest.title ?? manifest.id ?? ''),
    version: String(manifest.version ?? ''),
    packs,
    scenePacks,
    root,
    art,
    languages: (Array.isArray(manifest.languages) ? manifest.languages : []).flatMap((raw) => {
      const lang = (raw as { lang?: unknown } | null)?.lang
      return typeof lang === 'string' ? [lang] : []
    })
  }
}

/** Los avisos de licencia del zip (LICENSE, LICENSE.txt, LICENSE.md…), por su ruta */
const NOTICE = /(^|\/)(licen[cs]e|copying|credits?)(\.(txt|md))?$/i

/**
 * Las imágenes que nombra lo importado, sacadas del zip con su licencia (por los avisos de sus carpetas); las que no
 * vienen en él (las de serie de Foundry), fuera
 */
export function imagesFromZip(
  bytes: Uint8Array,
  foundry: FoundryZip,
  wanted: readonly { path: string; credit: string | null }[]
): ZipImage[] {
  const inside = new Map(
    wanted.flatMap((w) => {
      const at = zipPathOf(w.path, foundry)
      return at ? [[at, w] as const] : []
    })
  )
  const files = unzipSync(bytes, { filter: (file) => inside.has(file.name) || NOTICE.test(file.name) })
  const notices: Record<string, string> = {}
  for (const [name, data] of Object.entries(files))
    if (NOTICE.test(name)) notices[name] = strFromU8(data).slice(0, 100_000)
  return [...inside].flatMap(([at, w]) => {
    const data = files[at]
    return data ? [{ path: w.path, bytes: data, license: licenseOf(at, notices), credit: w.credit }] : []
  })
}

/** Un zip con solo lo que hace falta: el manifiesto, sus idiomas y los compendios elegidos (o los de escenas) */
export function slimZip(bytes: Uint8Array, foundry: FoundryZip, chosen: readonly string[]): Uint8Array {
  const paths = [...foundry.packs, ...foundry.scenePacks]
    .filter((p) => chosen.includes(p.name))
    .map((p) => `${foundry.root}${p.path}`)
  const wanted = (name: string) =>
    MANIFESTS.some((m) => name === `${foundry.root}${m}`) ||
    (name.startsWith(`${foundry.root}lang/`) && name.endsWith('.json')) ||
    foundry.art.includes(name) ||
    paths.some((path) => name === path || name.startsWith(`${path.replace(/\/$/, '')}/`))
  const files = unzipSync(bytes, { filter: (file) => wanted(file.name) })
  return zipSync(files, { level: 6 })
}

/** Unos archivos del zip por su ruta de Foundry (modules/…): los que vienen en él (y, con maxBytes, no pasan de eso) */
export function filesFromZip(
  bytes: Uint8Array,
  foundry: FoundryZip,
  paths: readonly string[],
  maxBytes = Number.POSITIVE_INFINITY
): Map<string, Uint8Array> {
  const inside = new Map(
    paths.flatMap((path) => {
      const at = zipPathOf(path, foundry)
      return at ? [[at, path] as const] : []
    })
  )
  if (inside.size === 0) return new Map()
  const files = unzipSync(bytes, { filter: (file) => inside.has(file.name) && file.originalSize <= maxBytes })
  return new Map(
    Object.entries(files).flatMap(([at, data]) => (inside.has(at) ? [[inside.get(at) as string, data]] : []))
  )
}

/** Unos bytes en base64, a trozos (uno entero no cabe en la pila) */
export function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(text)
}
