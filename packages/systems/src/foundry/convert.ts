/**
 * Un sistema o un módulo de contenido de Foundry VTT, convertido en el archivo de un sistema de Crisol: cada clase de
 * documento con su subtipo es un tipo (los diarios, reglas; las tablas de tirar, tablas), cada paquete es una fuente y
 * el compendio se ordena como sus paquetes. De cada documento se trae su nombre, su texto (de HTML a Markdown) y los
 * valores sueltos de `system` que comparten bastantes de su tipo. Formato de los documentos de Foundry VTT, leído de sus
 * compendios (ADR-0014)
 */
import { type ContentItem, FILE_BYTES, type SystemFile, toFile } from '../file.ts'
import { type Field, FORMAT, LIMITS, type System } from '../format.ts'
import type { Language, Text } from '../text.ts'
import { dnd5eContext, dnd5eEdition } from './dnd5e.ts'
import { type HtmlContext, htmlToLine, htmlToMarkdown } from './html.ts'
import { type FoundryDocument, FoundryError, type FoundryManifest, type FoundryPack, packOrder } from './manifest.ts'

export interface FoundryInput {
  manifest: FoundryManifest
  /** Los textos de su idioma, aplanados (flattenLang) */
  names: Record<string, string>
  /** Los paquetes que se traen, con sus documentos */
  packs: FoundryPack[]
  /** El idioma de sus textos */
  language: Language
  /** Sus mapas de arte, ya leídos del zip: el retrato de cada actor por su paquete («dnd5e.monsters») y su id */
  art?: FoundryArt
}

export interface FoundryArt {
  credit: string | null
  map: Record<string, Record<string, { actor?: string }>>
}

export interface Converted {
  file: SystemFile
  /** Lo que conviene saber: lo que se dejó fuera o se recortó */
  notes: string[]
}

/** Una imagen del propio paquete (systems/<id>/… o modules/<id>/…); las de Foundry o de otros paquetes, fuera */
function ownImage(path: string | null | undefined, manifest: FoundryManifest): string | null {
  if (!path) return null
  const clean = path.replace(/^\/+/, '')
  const prefix = `${manifest.kind === 'module' ? 'modules' : 'systems'}/${manifest.id}/`
  return clean.startsWith(prefix) && clean.length <= 500 && !clean.includes('..') ? clean : null
}

/** Las clases de documento que se traen */
export const FOUNDRY_DOCUMENTS = ['Item', 'Actor', 'JournalEntry', 'RollTable'] as const
type DocumentClass = (typeof FOUNDRY_DOCUMENTS)[number]
const isSupported = (type: string): type is DocumentClass => (FOUNDRY_DOCUMENTS as readonly string[]).includes(type)

/** Hasta tanto, un diario va entero; si no, una regla por página */
const JOURNAL_BYTES = 60 * 1024
/** Lo que se lee de `system`: tantos niveles */
const DEPTH = 3
/** Un campo de opciones: tantas como mucho */
const MAX_OPTIONS = 30

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length
const both = (es: string, en: string): Text => ({ es, en })

/** De camelCase a palabras: «activationType» → «activation_type» */
const snake = (text: string) => text.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')

/** Una clave de Crisol (KEY): en minúsculas, sin tildes y empezando por letra */
export function keyOf(text: string, prefix = 'x'): string {
  const base = snake(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const key = /^[a-z]/.test(base) ? base : `${prefix}_${base}`.replace(/_+$/, '')
  return key.slice(0, 60).replace(/_+$/, '')
}

/** Una clave que no está ya: con _2, _3… */
function unique(key: string, used: Set<string>): string {
  let out = key
  for (let n = 2; used.has(out); n++) out = `${key.slice(0, 60 - String(n).length - 1)}_${n}`
  used.add(out)
  return out
}

/** Un resumen corto y estable de un texto (FNV-1a), en base 36 */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36).padStart(7, '0')
}

/** La clave de un documento del contenido: su nombre y un resumen de dónde está (su paquete y su id) */
export function contentKeyOf(name: string, where: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return `${slug || 'doc'}-${hash(where)}`
}

/** Un nombre para leer de una ruta: «activation.type» → «Activation type» */
const humanize = (path: string) => {
  const words = path
    .split('.')
    .map((s) => snake(s).replace(/[_-]+/g, ' ').toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, 200) || path.slice(0, 200)
}

const get = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (isObject(v) ? v[k] : undefined), value)

/** Un valor suelto: un número, sí o no, un texto corto o una lista de textos cortos */
type Raw = number | boolean | string | string[]

const IMAGE = /\.(webp|png|jpe?g|gif|svg|avif|bmp|mp4|webm|ogg|mp3|wav|m4a|flac)$/i
const UUID = /^(Compendium|Item|Actor|JournalEntry|RollTable|Scene|Macro|Folder)\.[A-Za-z0-9._-]+$/
/** Un id de Foundry (16 letras y números): lo que va por id no es un campo */
const FOUNDRY_ID = /^(?=.*[A-Z0-9])[A-Za-z0-9]{16}$/
/** Lo de `system` que no es un campo: textos largos, de dónde sale, la mecánica por id, imágenes */
const SKIP = new Set([
  'description',
  'biography',
  'source',
  '_stats',
  'flags',
  'folder',
  'img',
  'ownership',
  'sort',
  '_id',
  'id',
  'effects',
  'activities',
  'advancement',
  'chat'
])

function rawOf(v: unknown): Raw | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t || t.length > 200 || t.includes('<') || IMAGE.test(t) || UUID.test(t)) return undefined
    return t
  }
  if (Array.isArray(v) && v.length > 0 && v.length <= 200) {
    if (!v.every((x) => typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x)))) return undefined
    const items = v.map((x) => String(x).trim()).filter(Boolean)
    if (items.length === 0 || items.some((x) => x.length > 200 || IMAGE.test(x) || UUID.test(x))) return undefined
    return items
  }
  return undefined
}

/** Los valores sueltos de `system`, por su ruta (a.b.c), hasta tres niveles */
function flatten(system: unknown, html: ReadonlySet<string>): Map<string, Raw> {
  const out = new Map<string, Raw>()
  const walk = (value: unknown, path: string[]) => {
    if (isObject(value)) {
      if (path.length >= DEPTH) return
      for (const [k, v] of Object.entries(value)) {
        if (SKIP.has(k) || FOUNDRY_ID.test(k)) continue
        walk(v, [...path, k])
      }
      return
    }
    if (path.length === 0) return
    const joined = path.join('.')
    if (html.has(joined)) return
    const raw = rawOf(value)
    if (raw !== undefined) out.set(joined, raw)
  }
  walk(system, [])
  return out
}

/** Un documento de Crisol, antes de saber los campos de su tipo */
interface Entry {
  pack: FoundryPack
  type: string
  /** Dónde está: su paquete y su id (y el de su página) */
  where: string
  name: string
  text: string
  values: Map<string, Raw>
  folder: string | null
  /** Su imagen: la del documento o, en un actor, su retrato del mapa de arte; solo si es del propio paquete */
  img?: string | null
}

/** Un campo que sale de `system`: su clave, su campo y cómo se guarda su valor */
interface Column {
  path: string
  key: string
  field: Field
  convert: (raw: Raw) => unknown
}

const NUMERIC = /^-?\d+(\.\d+)?$/

/** Los campos de un tipo: los valores que comparten bastantes de sus documentos, con su clase */
function columnsOf(entries: readonly Entry[], reserved: ReadonlySet<string>): Column[] {
  const n = entries.length
  const paths = new Map<string, Raw[]>()
  for (const e of entries)
    for (const [path, raw] of e.values) {
      const list = paths.get(path)
      if (list) list.push(raw)
      else paths.set(path, [raw])
    }
  // En uno de pocos, todo; en uno de muchos, lo que está en uno de cada diez y no es igual en todos
  const enough = Math.max(1, Math.ceil(n * 0.1))
  const same = (values: readonly unknown[]) =>
    n >= 5 && values.length === n && new Set(values.map((v) => JSON.stringify(v))).size === 1
  const used = new Set(reserved)
  const columns: (Column & { count: number })[] = []
  for (const [path, values] of paths) {
    if (values.length < enough || same(values)) continue
    const label = humanize(path)
    const column = (field: Field, convert: (raw: Raw) => unknown) =>
      columns.push({ path, key: '', field, convert, count: values.length })
    if (values.every((v) => typeof v === 'boolean')) column({ kind: 'boolean', label }, (raw) => raw)
    else if (values.every((v) => typeof v === 'number' || (typeof v === 'string' && NUMERIC.test(v)))) {
      const integer = values.every((v) => Number.isInteger(Number(v)))
      column({ kind: 'number', label, ...(integer ? { integer: true } : {}) }, (raw) => Number(raw))
    } else if (values.every((v) => Array.isArray(v))) column({ kind: 'list', label }, (raw) => raw)
    else {
      const text = (raw: Raw) => (Array.isArray(raw) ? raw.join(', ') : String(raw))
      const distinct = [...new Set(values.map(text))]
      const options = distinct.map((d) => keyOf(d, 'v'))
      if (
        distinct.length >= 2 &&
        distinct.length <= MAX_OPTIONS &&
        values.length >= 2 * distinct.length &&
        new Set(options).size === options.length
      ) {
        const byValue = new Map(distinct.map((d, i) => [d, options[i] as string]))
        column(
          { kind: 'choice', label, options: distinct.map((d, i) => ({ value: options[i] as string, label: d })) },
          (raw) => byValue.get(text(raw))
        )
      } else column({ kind: 'text', label }, text)
    }
  }
  // Si son demasiados, los que más salen (en su orden)
  const room = LIMITS.fieldsPerType - reserved.size
  const kept =
    columns.length > room
      ? new Set(
          [...columns]
            .sort((a, b) => b.count - a.count)
            .slice(0, room)
            .map((c) => c.path)
        )
      : null
  return columns
    .filter((c) => !kept || kept.has(c.path))
    .map(({ count: _, ...c }) => ({ ...c, key: unique(keyOf(c.path.replaceAll('.', '_'), 'f'), used) }))
}

/** El texto de un diario, por páginas */
function pagesOf(doc: FoundryDocument, html: (text: string) => string): { id: string; name: string; text: string }[] {
  // Los de antes de la v10: el texto en el propio diario
  if (typeof doc.content === 'string') return [{ id: '', name: doc.name ?? '', text: html(doc.content) }]
  const pages = (Array.isArray(doc.pages) ? doc.pages : [])
    .filter(isObject)
    .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0))
  return pages.flatMap((p) => {
    const content = get(p, 'text.content')
    const markdown = get(p, 'text.markdown')
    const description = get(p, 'system.description.value')
    const text = str(content)
      ? html(content as string)
      : str(markdown)
        ? (markdown as string).trim()
        : str(description)
          ? html(description as string)
          : ''
    return text ? [{ id: String(p._id ?? ''), name: str(p.name) ?? '', text }] : []
  })
}

/** Una tabla de tirar en Markdown: la fórmula en su primera columna y cada fila con su rango (1–5) */
function tableText(doc: FoundryDocument, line: (text: string) => string, language: Language): string {
  const results = (Array.isArray(doc.results) ? doc.results : [])
    .filter(isObject)
    .map((r) => {
      const range = Array.isArray(r.range) ? r.range.map(Number) : []
      const from = Number.isFinite(range[0]) ? (range[0] as number) : 0
      const to = Number.isFinite(range[1]) ? (range[1] as number) : from
      // De un documento, su nombre; de texto, su texto
      const linked =
        r.type === 'document' || r.type === 'pack' || r.type === 'compendium' || r.type === 1 || r.type === 2
      const candidates = linked ? [r.name, r.text, r.description] : [r.description, r.text, r.name]
      const html = candidates.map(str).find(Boolean) ?? ''
      return { from, to, text: line(html).replace(/\|/g, '\\|') }
    })
    .sort((a, b) => a.from - b.from)
  if (results.length === 0) return ''
  const top = Math.max(...results.map((r) => r.to))
  const formula = (str(doc.formula) ?? `1d${Math.max(1, top)}`).replace(/\s+/g, '')
  const head = `| ${formula} | ${language === 'es' ? 'Resultado' : 'Result'} |`
  const rows = results.map((r) => `| ${r.from === r.to ? r.from : `${r.from}–${r.to}`} | ${r.text} |`)
  return [head, '| --- | --- |', ...rows].join('\n')
}

/** Recorta un texto hasta que el documento quepa */
function fit(data: Record<string, unknown>, field: string, language: Language): boolean {
  if (bytes(data) <= LIMITS.contentBytes) return false
  const value = data[field] as Record<string, string> | undefined
  const text = value?.[language] ?? ''
  const rest = bytes({ ...data, [field]: { [language]: '' } })
  // Los bytes de JSON de un texto: lo escapado ocupa más; se va recortando hasta que cabe
  let length = Math.max(0, Math.floor((LIMITS.contentBytes - rest - 64) / 2))
  let cut = text.slice(0, length)
  while (length > 0 && bytes({ ...data, [field]: { [language]: `${cut}\n\n…` } }) > LIMITS.contentBytes) {
    length = Math.floor(length * 0.9)
    cut = text.slice(0, length)
  }
  // Si se cortara un carácter doble (un emoji), fuera la mitad suelta
  data[field] = { [language]: `${cut.replace(/[\ud800-\udbff]$/, '')}\n\n…` }
  return true
}

/** Convierte lo leído de Foundry en el archivo de un sistema de Crisol (sin validar: lo valida quien lo guarda) */
export function convertFoundry(input: FoundryInput): Converted {
  const { manifest, names, language } = input
  const notes: string[] = []
  const at = (text: string): Text => ({ [language]: text.slice(0, 200) })
  const order = packOrder(manifest)
  const packs = [...input.packs].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  for (const p of packs)
    if (!isSupported(p.type)) notes.push(`Se deja fuera «${p.label}»: sus documentos (${p.type}) no se traen`)
  const supported = packs.filter((p) => isSupported(p.type))
  if (supported.length > 50) throw new FoundryError('FOUNDRY_TOO_BIG', 'Como mucho, 50 paquetes a la vez')

  // Los nombres de los documentos por su id, para los enlaces sin etiqueta
  const byId = new Map<string, string>()
  for (const p of supported)
    for (const d of p.documents) {
      if (d.name) byId.set(d._id, d.name)
      for (const page of Array.isArray(d.pages) ? d.pages.filter(isObject) : [])
        if (typeof page._id === 'string' && typeof page.name === 'string') byId.set(page._id, page.name)
    }
  const nameOf = (id: string) => byId.get(id)
  // Los valores de los textos ([[lookup @level]]): los del documento o los de quien lo lleva; en dnd5e, como él
  const dnd5e = manifest.id === 'dnd5e' || manifest.system === 'dnd5e'
  const scalar = (value: unknown) =>
    typeof value === 'number' || typeof value === 'string' ? String(value) : undefined
  const contextOf = (doc: FoundryDocument | null, actor: FoundryDocument | null, self: string): HtmlContext => ({
    nameOf,
    self,
    ...(dnd5e
      ? dnd5eContext(doc, actor)
      : { lookup: (path) => scalar(get(doc?.system, path.replace(/^item\./, ''))) ?? scalar(get(actor?.system, path)) })
  })
  const md = (html: string, context: HtmlContext) => htmlToMarkdown(html, context)
  const line = (html: string) => htmlToLine(html, { nameOf })

  // Las claves de los tipos: el subtipo (weapon, npc); si se repite entre clases, con la clase delante
  const subtypes = { Item: new Set<string>(), Actor: new Set<string>() }
  for (const p of supported)
    if (p.type === 'Item' || p.type === 'Actor') for (const d of p.documents) subtypes[p.type].add(d.type ?? 'base')
  const typeKeys = new Map<string, string>()
  const usedTypes = new Set(['regla', 'tabla'])
  const typeKey = (document: DocumentClass, subtype: string) => {
    const id = `${document}.${subtype}`
    let key = typeKeys.get(id)
    if (!key) {
      const shared = document === 'Actor' && subtypes.Item.has(subtype)
      key = unique(keyOf(shared ? `actor_${subtype}` : subtype, 't'), usedTypes)
      typeKeys.set(id, key)
    }
    return key
  }
  const typeLabel = (document: 'Item' | 'Actor', subtype: string, plural = false) => {
    const suffix = plural ? 'Pl' : ''
    const capital = subtype.charAt(0).toUpperCase() + subtype.slice(1)
    return (
      names[`TYPES.${document}.${subtype}${suffix}`] ??
      names[`${document.toUpperCase()}.Type${capital}${suffix}`] ??
      (plural ? null : humanize(subtype))
    )
  }
  const typeInfo = new Map<string, { document: 'actor' | 'item'; label: Text; plural: Text | null }>()

  const entries: Entry[] = []
  for (const pack of supported) {
    const folders = new Map(pack.folders.map((f) => [f._id, f.name]))
    const folderOf = (d: FoundryDocument) => (d.folder ? (folders.get(d.folder) ?? null) : null)
    const document = pack.type as DocumentClass
    for (const doc of pack.documents) {
      const name = str(doc.name) ?? doc._id
      const where = `${pack.name}/${doc._id}`
      if (document === 'JournalEntry') {
        const type = 'regla'
        typeInfo.set(type, { document: 'item', label: both('Regla', 'Rule'), plural: both('Reglas', 'Rules') })
        const pages = pagesOf(doc, (html) => md(html, contextOf(null, null, name)))
        const whole =
          pages.length === 1
            ? (pages[0]?.text ?? '')
            : pages.map((p) => (p.name ? `## ${p.name}\n\n${p.text}` : p.text)).join('\n\n')
        if (new TextEncoder().encode(whole).length <= JOURNAL_BYTES || pages.length === 1)
          entries.push({ pack, type, where, name, text: whole, values: new Map(), folder: folderOf(doc) })
        else
          for (const p of pages)
            entries.push({
              pack,
              type,
              where: `${where}/${p.id}`,
              name: p.name || name,
              text: p.text,
              values: new Map(),
              folder: name
            })
        continue
      }
      if (document === 'RollTable') {
        const type = 'tabla'
        typeInfo.set(type, { document: 'item', label: both('Tabla', 'Table'), plural: both('Tablas', 'Tables') })
        const description = str(doc.description) ? md(doc.description as string, contextOf(null, null, name)) : ''
        const text = [description, tableText(doc, line, language)].filter(Boolean).join('\n\n')
        entries.push({ pack, type, where, name, text, values: new Map(), folder: folderOf(doc) })
        continue
      }
      const subtype = doc.type ?? 'base'
      const type = typeKey(document, subtype)
      if (!typeInfo.has(type)) {
        const plural = typeLabel(document, subtype, true)
        typeInfo.set(type, {
          document: document === 'Actor' ? 'actor' : 'item',
          label: at(typeLabel(document, subtype) ?? subtype),
          plural: plural ? at(plural) : null
        })
      }
      const htmlFields = manifest.htmlFields[document]?.[subtype] ?? []
      const candidates = [...htmlFields, 'description.value', 'details.biography.value', 'description', 'biography']
      const html = candidates.map((path) => str(get(doc.system, path))).find(Boolean) ?? ''
      let text = html ? md(html, document === 'Actor' ? contextOf(null, doc, name) : contextOf(doc, null, name)) : ''
      // Lo que lleva un actor (sus acciones, sus rasgos, su equipo), detrás de su texto
      if (document === 'Actor' && Array.isArray(doc.items)) {
        const groups = new Map<string, string[]>()
        for (const item of doc.items.filter(isObject)) {
          const itemName = str(item.name)
          if (!itemName) continue
          const itemType = typeof item.type === 'string' ? item.type : 'base'
          const heading = typeLabel('Item', itemType, true) ?? typeLabel('Item', itemType) ?? itemType
          const body = md(
            str(get(item.system, 'description.value')) ?? '',
            contextOf(item as FoundryDocument, doc, name)
          )
          const paragraph = !body
            ? `**${itemName}.**`
            : /^[|#>-]/.test(body)
              ? `**${itemName}.**\n\n${body}`
              : `**${itemName}.** ${body}`
          groups.set(heading, [...(groups.get(heading) ?? []), paragraph])
        }
        const parts = [...groups].map(([heading, list]) => `## ${heading}\n\n${list.join('\n\n')}`)
        text = [text, ...parts].filter(Boolean).join('\n\n')
      }
      const art = document === 'Actor' ? input.art?.map[`${manifest.id}.${pack.name}`]?.[doc._id]?.actor : undefined
      entries.push({
        pack,
        type,
        where,
        name,
        text,
        values: flatten(doc.system, new Set(htmlFields)),
        folder: folderOf(doc),
        img: ownImage(art ?? str(doc.img), manifest)
      })
    }
  }
  if (entries.length > LIMITS.contentDocuments)
    throw new FoundryError(
      'FOUNDRY_TOO_BIG',
      `Son ${entries.length} documentos y caben ${LIMITS.contentDocuments}: elige menos paquetes`
    )
  if (typeInfo.size > LIMITS.types)
    throw new FoundryError(
      'FOUNDRY_TOO_BIG',
      `Son ${typeInfo.size} tipos y caben ${LIMITS.types}: elige menos paquetes`
    )

  // Los tipos, con sus campos
  const byType = new Map<string, Entry[]>()
  for (const e of entries) byType.set(e.type, [...(byType.get(e.type) ?? []), e])
  const types: System['types'] = {}
  const columns = new Map<string, Column[]>()
  for (const [type, list] of byType) {
    const info = typeInfo.get(type) as { document: 'actor' | 'item'; label: Text }
    const folders = list.some((e) => e.folder)
    const reserved = new Set(['name', 'description', ...(folders ? ['folder'] : [])])
    const own = columnsOf(list, reserved)
    columns.set(type, own)
    types[type] = {
      document: info.document,
      label: info.label,
      fields: {
        ...Object.fromEntries(own.map((c) => [c.key, c.field])),
        ...(folders ? { folder: { kind: 'text', label: both('Carpeta', 'Folder') } } : {}),
        description: { kind: 'text', label: both('Descripción', 'Description'), lines: 8 }
      }
    }
  }

  // Las fuentes: una por paquete
  const usedSources = new Set<string>()
  const sourceOf = new Map<string, string>()
  const sources: NonNullable<System['sources']> = []
  const attribution = [manifest.title, manifest.version].filter(Boolean).join(' ')
  for (const pack of supported) {
    if (!entries.some((e) => e.pack === pack)) continue
    const key = unique(keyOf(pack.name, 'p'), usedSources)
    sourceOf.set(pack.name, key)
    const edition = dnd5e ? dnd5eEdition(pack, manifest.id === 'dnd5e') : null
    sources.push({
      key,
      name: at(pack.label),
      license: (manifest.license ?? 'Sin indicar').slice(0, 200),
      attribution: attribution.slice(0, 4000),
      ...(edition ? { edition } : {})
    })
  }

  // El contenido
  let trimmed = 0
  const usedKeys = new Set<string>()
  const content: ContentItem[] = entries.map((e) => {
    const data: Record<string, unknown> = { name: at(e.name) }
    for (const c of columns.get(e.type) ?? []) {
      const raw = e.values.get(c.path)
      if (raw === undefined) continue
      const value = c.convert(raw)
      if (value !== undefined) data[c.key] = value
    }
    if (e.folder) data.folder = e.folder.slice(0, 200)
    if (e.text) data.description = { [language]: e.text }
    if (fit(data, 'description', language)) trimmed++
    let key = contentKeyOf(e.name, e.where)
    for (let n = 2; usedKeys.has(key); n++) key = contentKeyOf(e.name, `${e.where}#${n}`)
    usedKeys.add(key)
    return { type: e.type, key, source: sourceOf.get(e.pack.name) ?? null, data, ...(e.img ? { img: e.img } : {}) }
  })
  if (trimmed > 0) notes.push(`Se recortó el texto de ${trimmed} documento${trimmed === 1 ? '' : 's'}: no cabía entero`)

  const summary = manifest.description ? htmlToLine(manifest.description).slice(0, 8000) : ''
  const system: System = {
    format: FORMAT,
    id: keyOf(manifest.id, 's'),
    name: manifest.title.slice(0, 200),
    ...(summary ? { summary } : {}),
    version: (manifest.version ?? '1.0').slice(0, 40),
    languages: [language],
    types,
    sources,
    ...(compendiumOf(supported, entries, typeInfo, at) ?? {})
  }
  const file = toFile(system, content)
  const size = bytes(file)
  if (size > FILE_BYTES)
    throw new FoundryError(
      'FOUNDRY_TOO_BIG',
      `Ocupa ${(size / 1024 / 1024).toFixed(1)} MB y caben ${FILE_BYTES / 1024 / 1024}: elige menos paquetes`
    )
  return { file, notes }
}

/**
 * El compendio: una sección por paquete con los tipos que tienen en él la mayoría de sus documentos, en el orden de los
 * paquetes; cada tipo, por las carpetas de sus documentos si casi todos están en una
 */
function compendiumOf(
  packs: readonly FoundryPack[],
  entries: readonly Entry[],
  info: ReadonlyMap<string, { plural: Text | null; label: Text }>,
  at: (text: string) => Text
): Pick<System, 'compendium'> | null {
  const counts = new Map<string, Map<string, number>>()
  for (const e of entries) {
    const byPack = counts.get(e.type) ?? new Map<string, number>()
    byPack.set(e.pack.name, (byPack.get(e.pack.name) ?? 0) + 1)
    counts.set(e.type, byPack)
  }
  const home = new Map<string, string>()
  for (const [type, byPack] of counts) {
    let best: string | null = null
    for (const p of packs) if (best === null || (byPack.get(p.name) ?? 0) > (byPack.get(best) ?? 0)) best = p.name
    if (best) home.set(type, best)
  }
  const used = new Set<string>()
  const sections = packs.flatMap((p) => {
    const types = [...new Set(entries.filter((e) => e.pack === p && home.get(e.type) === p.name).map((e) => e.type))]
    return types.length > 0 ? [{ key: unique(keyOf(p.name, 's'), used), label: at(p.label), types }] : []
  })
  if (sections.length === 0 || sections.length > 30 || sections.some((s) => s.types.length > 20)) return null
  const types: NonNullable<System['compendium']>['types'] = {}
  for (const [type, list] of [...counts.keys()].map((t) => [t, entries.filter((e) => e.type === t)] as const)) {
    const plural = info.get(type)?.plural
    const folders = list.filter((e) => e.folder).length >= list.length / 2
    types[type] = {
      ...(plural ? { label: plural } : {}),
      ...(folders ? { folder: { field: 'folder' } } : {})
    }
  }
  return { compendium: { sections, types } }
}

/**
 * El contenido de un módulo, dentro de un sistema que ya hay: sus tipos se añaden (o se les añaden los campos que les
 * falten), sus fuentes también, y sus documentos se suman a los del sistema (los de la misma clave, se cambian)
 */
export function mergeFoundry(base: { system: System; content: readonly ContentItem[] }, file: SystemFile): SystemFile {
  const system = structuredClone(base.system)
  const remap = new Map<string, string>()
  const usedTypes = new Set(Object.keys(system.types))
  for (const [key, type] of Object.entries(file.system.types)) {
    const existing = system.types[key]
    if (existing && existing.document === type.document) {
      remap.set(key, key)
      for (const [field, spec] of Object.entries(type.fields))
        if (!existing.fields[field] && Object.keys(existing.fields).length < LIMITS.fieldsPerType)
          existing.fields[field] = spec
      continue
    }
    const target = existing ? unique(key, usedTypes) : key
    usedTypes.add(target)
    remap.set(key, target)
    system.types[target] = structuredClone(type)
  }
  if (Object.keys(system.types).length > LIMITS.types)
    throw new FoundryError(
      'FOUNDRY_TOO_BIG',
      `Serían ${Object.keys(system.types).length} tipos y caben ${LIMITS.types}`
    )
  const sources = system.sources ?? []
  for (const s of file.system.sources ?? []) if (!sources.some((o) => o.key === s.key)) sources.push(s)
  system.sources = sources
  for (const l of file.system.languages) if (!system.languages.includes(l)) system.languages.push(l)
  const layout = system.compendium
  if (layout && file.system.compendium) {
    const placed = new Set(layout.sections.flatMap((s) => s.types))
    const keys = new Set(layout.sections.map((s) => s.key))
    for (const section of file.system.compendium.sections) {
      const types = section.types.map((t) => remap.get(t) ?? t).filter((t) => !placed.has(t))
      if (types.length === 0 || layout.sections.length >= 30) continue
      layout.sections.push({ ...section, key: unique(section.key, keys), types })
      for (const t of types) placed.add(t)
    }
    layout.types ??= {}
    for (const [type, spec] of Object.entries(file.system.compendium.types ?? {})) {
      const target = remap.get(type) ?? type
      if (!layout.types[target]) layout.types[target] = spec
    }
  }
  const content = new Map(base.content.map((c) => [c.key, c]))
  for (const c of file.content) content.set(c.key, { ...c, type: remap.get(c.type) ?? c.type })
  if (content.size > LIMITS.contentDocuments)
    throw new FoundryError(
      'FOUNDRY_TOO_BIG',
      `Serían ${content.size} documentos y caben ${LIMITS.contentDocuments}: elige menos paquetes`
    )
  return toFile(system, [...content.values()])
}
