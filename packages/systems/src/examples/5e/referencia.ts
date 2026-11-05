/**
 * Los personajes de referencia del 5e (srd-5e, tarea 20): montados con el contenido de serie, como los montará el
 * creador de personajes. Una clase a un nivel con lo que concede hasta él, su subclase y lo de ella; y el equipo que
 * se le diga, equipado. Para las pruebas que comprueban que dan lo de las tablas del SRD
 */
import type { DocumentItem, SystemDocument } from '../../evaluate.ts'
import type { ContentItem } from '../../file.ts'
import type { Mechanics } from '../../mechanics.ts'

export type Edition = '2014' | '2024'

/** Un documento del contenido, para llevarlo, con sus datos cambiados */
export function carry(content: readonly ContentItem[], key: string, data: Record<string, unknown> = {}): DocumentItem {
  const item = content.find((c) => c.key === key)
  if (!item) throw new Error(`No está «${key}» en el contenido`)
  return {
    id: key,
    type: item.type,
    name: (item.data.name as { es?: string })?.es ?? key,
    data: { ...item.data, ...data },
    ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
  }
}

/** Lo que concede algo hasta un nivel (por concepto, de su edición), como objetos que vienen de él */
function granted(content: readonly ContentItem[], from: DocumentItem, level: number, edition: Edition): DocumentItem[] {
  return (from.mechanics?.grants ?? [])
    .filter((g) => g.concept && (g.level ?? 0) <= level)
    .map((g) => ({ ...carry(content, `${g.concept}_${edition}`), id: `${g.concept}_${g.level ?? 0}`, from: from.id }))
}

export interface Reference {
  klass: string
  edition: Edition
  level: number
  /** Sus puntuaciones (fue, des, con, int, sab, car) */
  scores?: Record<string, number>
  /** Lo que lleva equipado (por su clave), y lo que tiene activo (la furia) */
  gear?: string[]
  active?: string[]
}

/** Un personaje de referencia: su clase con lo que concede, su subclase (la del SRD) y su equipo */
export function referenceCharacter(content: readonly ContentItem[], ref: Reference): SystemDocument {
  const klass = carry(content, `${ref.klass}_${ref.edition}`, { nivel: ref.level, inicial: true })
  const subclass = (klass.mechanics?.grants ?? []).find((g) => g.choose?.type === 'subclase')
  const items: DocumentItem[] = [klass, ...granted(content, klass, ref.level, ref.edition)]
  if (subclass?.choose?.from?.[0] && (subclass.level ?? 0) <= ref.level) {
    const sub = { ...carry(content, `${subclass.choose.from[0]}_${ref.edition}`), from: klass.id }
    items.push(sub, ...granted(content, sub, ref.level, ref.edition).map((it) => ({ ...it, from: klass.id })))
  }
  for (const key of ref.gear ?? []) items.push(carry(content, key, { equipado: true }))
  const active = new Set(ref.active ?? [])
  const scores = ref.scores ?? { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }
  return {
    data: { caracteristicas: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { puntuacion: v }])) },
    // Lo activo, por su concepto (el id de lo concedido es su concepto y su nivel)
    items: items.map((it) =>
      active.has(it.id.replace(/_\d+$/, '')) ? { ...it, data: { ...it.data, activo: true } } : it
    )
  }
}
