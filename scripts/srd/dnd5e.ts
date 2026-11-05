/**
 * Lo de dnd5e (Foundry, MIT; su contenido, SRD con CC BY 4.0), exportado a `datos-locales/dnd5e/` con
 * `dnd5e-exportar.ts`: sus criaturas con lo que hacen, para cruzarlas con las nuestras (ADR-0014)
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ABILITIES, DAMAGE_TYPES } from '../../packages/systems/src/catalog/5e/system.ts'
import { slug } from './texto.ts'

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

interface Part {
  number?: number | null
  denomination?: number | null
  bonus?: string
  types?: string[]
  custom?: { enabled?: boolean; formula?: string }
}

interface Activity {
  type?: string
  activation?: { type?: string }
  save?: { ability?: string[] | string; dc?: { calculation?: string; formula?: string } }
  attack?: { bonus?: string; flat?: boolean }
  damage?: { parts?: Part[]; onSave?: string }
  healing?: Part
  spell?: { uuid?: string; challenge?: { attack?: number | null; save?: number | null; override?: boolean } }
  consumption?: { targets?: { type?: string; value?: string }[] }
}

interface Item {
  name: string
  type: string
  system?: {
    activities?: Record<string, Activity>
    uses?: { max?: string; recovery?: { period?: string; formula?: string }[] }
  }
}

const cache = new Map<string, Record<string, unknown> | null>()
const read = (pack: string): Record<string, unknown> | null => {
  if (!cache.has(pack)) {
    const file = join(DIR, `${pack}.json`)
    cache.set(pack, existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : null)
  }
  return cache.get(pack) ?? null
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
          save: ((given) => (Array.isArray(given) ? given[0] : given) ?? null)(
            rolled.find((a) => a.type === 'save')?.save?.ability
          ),
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

const ABILITY: Record<string, string> = Object.fromEntries(
  ABILITIES.map(([key, , en]) => [en.toLowerCase().slice(0, 3), key])
)
const DAMAGE: Record<string, string> = Object.fromEntries(DAMAGE_TYPES.map(([key, , en]) => [en.toLowerCase(), key]))
const ACTIVATION: Record<string, string> = { action: 'action', bonus: 'bonus', reaction: 'reaction' }

/** Una parte de daño o de curación de dnd5e, como fórmula nuestra: «8d6», «2d4 + 2» */
function formulaOf(part: Part): string | null {
  // (Una fórmula suya con sus nombres, @item o @scaling, no es nuestra: no se trae)
  if (part.custom?.enabled && part.custom.formula)
    return part.custom.formula.includes('@') ? null : part.custom.formula.replace(/\s+/g, ' ').trim()
  if (!part.number || !part.denomination) return part.bonus && /^\d+$/.test(part.bonus) ? part.bonus : null
  const bonus = part.bonus && /^\d+$/.test(part.bonus) && part.bonus !== '0' ? ` + ${part.bonus}` : ''
  return `${part.number}d${part.denomination}${bonus}`
}

type Mechanics = Record<string, unknown>
type Name = { es: string; en: string }

/** Los conjuros nuestros de una edición, por su nombre en inglés: para nombrar en español lo que lanza un objeto */
function spellNames(edition: '2014' | '2024'): Map<string, Name> {
  const file = join(import.meta.dirname, '../../packages/systems/src/catalog/5e/content/conjuros.json')
  const spells = JSON.parse(readFileSync(file, 'utf8')) as { key: string; data: { name: Name } }[]
  return new Map(
    spells.filter((s) => s.key.endsWith(`_${edition}`)).map((s) => [s.data.name.en.toLowerCase(), s.data.name])
  )
}

/** Una actividad de dnd5e (o la del conjuro que lanza) como acción nuestra; si no se puede decir con números, null */
function actionOf(activity: Activity, label: Name, charges: boolean): Mechanics | null {
  let rolled = activity
  let dc: string | null = null
  let attack: string | null = null
  if (activity.type === 'cast') {
    const [, , pack, , id] = activity.spell?.uuid?.split('.') ?? []
    const spell =
      pack && id ? (read(pack)?.[`!items!${id}`] as { system?: { activities?: Record<string, Activity> } }) : null
    const inner = Object.values(spell?.system?.activities ?? {}).find((a) =>
      ['save', 'attack', 'damage', 'heal'].includes(a.type ?? '')
    )
    if (!inner) return null
    rolled = inner
    // Su CD y su ataque: los del objeto si los fija; si no, los de conjuros de quien lo lleva
    const challenge = activity.spell?.challenge
    dc = challenge?.override && challenge.save ? String(challenge.save) : '@cd_conjuros'
    attack = challenge?.override && challenge.attack ? String(challenge.attack) : '@ataque_conjuros'
  } else {
    const flat = activity.save?.dc?.calculation === '' && activity.save.dc.formula
    if (flat && /^\d+$/.test(flat)) dc = flat
    if (activity.attack?.flat && activity.attack.bonus && /^\d+$/.test(activity.attack.bonus))
      attack = activity.attack.bonus
  }
  const action: Mechanics = {
    key: slug(label.es).slice(0, 50) || 'usar',
    label,
    activation: ACTIVATION[activity.activation?.type ?? ''] ?? 'special'
  }
  if (rolled.type === 'save') {
    // (Una lista en 2014; un texto en los de 2024)
    const given = rolled.save?.ability
    const ability = ABILITY[(Array.isArray(given) ? given[0] : given) ?? '']
    if (!ability || !dc) return null
    action.save = { ability, dc, success: rolled.damage?.onSave === 'half' ? 'half' : 'none' }
  }
  if (rolled.type === 'attack') {
    if (!attack) return null
    action.attack = attack
  }
  const damage = (rolled.damage?.parts ?? []).flatMap((part) => {
    const formula = formulaOf(part)
    const type = DAMAGE[part.types?.[0] ?? '']
    return formula ? [{ formula, ...(type ? { type } : {}) }] : []
  })
  if (damage.length > 0) action.damage = damage
  const heal = rolled.type === 'heal' && rolled.healing ? formulaOf(rolled.healing) : null
  if (heal) action.heal = heal
  if (!action.save && !action.attack && !action.damage && !action.heal) return null
  // Lo que gasta de sus cargas
  const spent = activity.consumption?.targets?.find((target) => target.type === 'itemUses')
  if (charges && spent) {
    action.uses = 'cargas'
    const cost = Number(spent.value)
    if (Number.isInteger(cost) && cost > 1 && cost <= 10) action.cost = cost
  }
  return action
}

/**
 * Lo que dnd5e dice que hace un objeto mágico (por su nombre en inglés): sus acciones (las de lanzar un conjuro, con la
 * salvación y el daño de ese conjuro) y sus cargas; sin exportar o sin pareja, nada
 */
export function dnd5eItemMechanics(
  edition: '2014' | '2024',
  name: Name
): { actions: Mechanics[]; charges: Mechanics | null } | null {
  const docs = read(edition === '2014' ? 'items' : 'equipment24')
  if (!docs) return null
  const item = Object.entries(docs).find(
    ([key, value]) => /^!items![^.]+$/.test(key) && (value as Item).name.toLowerCase() === name.en.toLowerCase()
  )?.[1] as
    | (Item & {
        system?: { uses?: { max?: string; recovery?: { period?: string; type?: string; formula?: string }[] } }
      })
    | undefined
  if (!item) return null
  const uses = item.system?.uses
  const max = uses?.max && /^\d+$/.test(uses.max) ? uses.max : null
  const recovery = uses?.recovery?.[0]
  const period: Record<string, string> = { dawn: 'dawn', day: 'dawn', lr: 'long', sr: 'short' }
  const charges: Mechanics | null = max
    ? {
        key: 'cargas',
        label: { es: 'Cargas', en: 'Charges' },
        max,
        ...(recovery?.period && period[recovery.period] ? { recovery: period[recovery.period] } : {}),
        ...(recovery?.type === 'formula' && recovery.formula ? { amount: recovery.formula.replace(/\s+/g, '') } : {})
      }
    : null
  const spells = spellNames(edition)
  const actions = Object.values(item.system?.activities ?? {}).flatMap((activity) => {
    // Lo que lanza, con el nombre del conjuro; lo demás, con el del objeto (y el de su actividad, si lo tiene)
    const own = (activity as { name?: string }).name
    let label: Name = own ? { es: `${name.es}: ${own}`, en: `${name.en}: ${own}` } : name
    if (activity.type === 'cast') {
      const [, , pack, , id] = activity.spell?.uuid?.split('.') ?? []
      const spell = pack && id ? (read(pack)?.[`!items!${id}`] as { name?: string } | undefined) : undefined
      const named = spell?.name ? spells.get(spell.name.toLowerCase()) : undefined
      if (named) label = named
      else if (spell?.name) label = { es: spell.name, en: spell.name }
    }
    const action = actionOf(activity, label, Boolean(charges))
    return action ? [action] : []
  })
  // Una clave por acción
  const seen = new Set<string>()
  for (const action of actions) {
    let key = action.key as string
    for (let n = 2; seen.has(key); n++) key = `${action.key}_${n}`
    seen.add(key)
    action.key = key
  }
  return { actions, charges }
}
