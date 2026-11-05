/**
 * Lo de dnd5e (Foundry, MIT; su contenido, SRD con CC BY 4.0), exportado a `datos-locales/dnd5e/` con
 * `dnd5e-exportar.ts`: sus criaturas con lo que hacen, para cruzarlas con las nuestras (ADR-0014)
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dirname, '../../datos-locales/dnd5e')

/** Lo que se tira de una acción de dnd5e: su activación, si es ataque o salvación, su recarga y sus usos */
export interface Dnd5eAction {
  name: string
  activation: string | null
  attack: boolean
  save: string | null
  damage: number
  recharge: string | null
  perDay: number | null
}

export interface Dnd5eActor {
  name: string
  actions: Dnd5eAction[]
}

interface Activity {
  type?: string
  activation?: { type?: string }
  save?: { ability?: string[] }
  damage?: { parts?: unknown[] }
}

interface Item {
  name: string
  type: string
  system?: {
    activities?: Record<string, Activity>
    uses?: { max?: string; recovery?: { period?: string; formula?: string }[] }
  }
}

const read = (pack: string): Record<string, unknown> | null => {
  const file = join(DIR, `${pack}.json`)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : null
}

/** Las criaturas de una edición, por su nombre en inglés en minúsculas; sin exportar, ninguna */
export function dnd5eActors(edition: '2014' | '2024'): Map<string, Dnd5eActor> {
  const docs = read(edition === '2014' ? 'monsters' : 'actors24')
  const out = new Map<string, Dnd5eActor>()
  if (!docs) return out
  const items = new Map<string, Item[]>()
  for (const [key, value] of Object.entries(docs)) {
    const m = /^!actors\.items!([^.]+)\./.exec(key)
    if (m) items.set(m[1] as string, [...(items.get(m[1] as string) ?? []), value as Item])
  }
  for (const [key, value] of Object.entries(docs)) {
    const m = /^!actors!([^.!]+)$/.exec(key)
    if (!m) continue
    const actor = value as { name: string }
    const actions = (items.get(m[1] as string) ?? []).flatMap((item): Dnd5eAction[] => {
      if (item.type === 'spell') return []
      const activities = Object.values(item.system?.activities ?? {})
      const rolled = activities.filter((a) => a.type === 'attack' || a.type === 'save' || a.type === 'damage')
      if (rolled.length === 0) return []
      const recovery = item.system?.uses?.recovery ?? []
      const recharge = recovery.find((r) => r.period === 'recharge')
      const day = recovery.find((r) => r.period === 'day' || r.period === 'dawn')
      return [
        {
          name: item.name,
          activation: rolled[0]?.activation?.type ?? null,
          attack: rolled.some((a) => a.type === 'attack'),
          save: rolled.find((a) => a.type === 'save')?.save?.ability?.[0] ?? null,
          damage: rolled.reduce((n, a) => n + (a.damage?.parts?.length ?? 0), 0),
          recharge: recharge ? (recharge.formula === '6' ? '6' : `${recharge.formula ?? '6'}-6`) : null,
          perDay: day && item.system?.uses?.max ? Number(item.system.uses.max) : null
        }
      ]
    })
    out.set(actor.name.toLowerCase(), { name: actor.name, actions })
  }
  return out
}
