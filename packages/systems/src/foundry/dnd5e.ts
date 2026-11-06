/**
 * Lo propio de dnd5e en los textos: sus valores calculados ([[lookup @labels.description.template]]) y sus tiradas
 * ([[/attack extended]], [[/damage average]], [[/save dex 15]]) como los enseña dnd5e, con los números del objeto y de
 * la criatura que lo lleva. Origen: el sistema dnd5e de Foundry VTT (MIT; su contenido, SRD 5.2.1 con CC BY 4.0), leído
 * de sus compendios y sus textos (ADR-0014)
 */
import type { HtmlContext, InlineRoll } from './html.ts'
import type { FoundryDocument } from './manifest.ts'

const ABILITIES: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
}
const SKILLS: Record<string, string> = {
  acr: 'Acrobatics',
  ani: 'Animal Handling',
  arc: 'Arcana',
  ath: 'Athletics',
  dec: 'Deception',
  his: 'History',
  ins: 'Insight',
  itm: 'Intimidation',
  inv: 'Investigation',
  med: 'Medicine',
  nat: 'Nature',
  prc: 'Perception',
  prf: 'Performance',
  per: 'Persuasion',
  rel: 'Religion',
  slt: 'Sleight of Hand',
  ste: 'Stealth',
  sur: 'Survival'
}
const SKILL_ABILITY: Record<string, string> = {
  acr: 'dex',
  ani: 'wis',
  arc: 'int',
  ath: 'str',
  dec: 'cha',
  his: 'int',
  ins: 'wis',
  itm: 'cha',
  inv: 'int',
  med: 'wis',
  nat: 'int',
  prc: 'wis',
  prf: 'cha',
  per: 'cha',
  rel: 'int',
  slt: 'dex',
  ste: 'dex',
  sur: 'wis'
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const get = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (isObject(v) ? v[k] : undefined), value)
const num = (v: unknown) =>
  typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : null
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)

/** El nombre de una característica o una habilidad, de su abreviatura o de su nombre (dex, nature) */
const abilityName = (key: string) => ABILITIES[key.toLowerCase()] ?? capital(key)
const skillName = (key: string) => SKILLS[key.toLowerCase()] ?? capital(key)

/** La media de una fórmula sencilla (2d6 + 3); si no es sencilla, null */
export function average(formula: string): number | null {
  const terms = formula.replace(/\s+/g, '').replace(/-/g, '+-').split('+').filter(Boolean)
  let total = 0
  for (const term of terms) {
    const dice = /^(-?)(\d*)d(\d+)$/i.exec(term)
    if (dice) {
      const n = Number(dice[2] || 1) * (dice[1] ? -1 : 1)
      total += (n * (Number(dice[3]) + 1)) / 2
    } else if (/^-?\d+$/.test(term)) total += Number(term)
    else return null
  }
  return Math.floor(total)
}

interface Activity {
  type?: string
  range?: { value?: unknown; units?: string }
  attack?: { ability?: string; bonus?: string; flat?: boolean; type?: { value?: string } }
  damage?: { includeBase?: boolean; parts?: Part[] }
  save?: { ability?: string | string[]; dc?: { calculation?: string; formula?: string } }
  target?: {
    affects?: { type?: string; count?: string; choice?: boolean }
    template?: { type?: string; size?: string; width?: string; height?: string; units?: string }
  }
}
interface Part {
  number?: number | null
  denomination?: number | null
  bonus?: string
  types?: string[]
  custom?: { enabled?: boolean; formula?: string }
}

/**
 * Los enriquecedores de un texto de dnd5e: de un documento (un conjuro, un objeto, un rasgo) y, si es de una criatura,
 * con sus características y su competencia
 */
export function dnd5eContext(
  document: FoundryDocument | null,
  actor: FoundryDocument | null = null
): Pick<HtmlContext, 'lookup' | 'roll'> {
  const system = document?.system ?? {}
  const activities = Object.values(isObject(system.activities) ? system.activities : {}).filter(isObject) as Activity[]
  const activityFor = (named: Record<string, string>, types: readonly string[]) => {
    const chosen = named.activity ? (get(system.activities, named.activity) as Activity | undefined) : undefined
    return chosen ?? activities.find((a) => types.includes(a.type ?? '')) ?? activities[0]
  }
  const mod = (ability: string) => {
    const score = num(get(actor?.system, `abilities.${ability}.value`))
    return score === null ? 0 : Math.floor((score - 10) / 2)
  }
  const proficiency = () => {
    const cr = Number(get(actor?.system, 'details.cr') ?? Number.NaN)
    if (Number.isFinite(cr)) return Math.max(2, Math.floor((Math.max(cr, 1) - 1) / 4) + 2)
    const items = Array.isArray(actor?.items) ? actor.items.filter(isObject) : []
    const level = items.filter((i) => i.type === 'class').reduce((n, i) => n + (num(get(i.system, 'levels')) ?? 0), 0)
    return level > 0 ? Math.floor((level - 1) / 4) + 2 : 2
  }
  const spellAbility = () => String(get(actor?.system, 'attributes.spellcasting') || 'int')
  const spellDc = () => 8 + proficiency() + mod(spellAbility())
  /** La característica de un ataque: la suya, la de lanzar conjuros o la del arma (sutil: la mejor) */
  const attackAbility = (activity: Activity) => {
    if (activity.attack?.ability && activity.attack.ability !== 'none') {
      return activity.attack.ability === 'spellcasting' ? spellAbility() : activity.attack.ability
    }
    if (document?.type === 'spell') return spellAbility()
    const properties = Array.isArray(system.properties) ? system.properties : []
    const ranged = activity.attack?.type?.value === 'ranged'
    if (properties.includes('fin')) return mod('dex') > mod('str') ? 'dex' : 'str'
    return ranged ? 'dex' : 'str'
  }
  const dcOf = (activity: Activity | undefined) => {
    const dc = activity?.save?.dc
    const flat = num(dc?.formula)
    if ((!dc?.calculation || dc.calculation === '') && flat !== null) return flat
    if (!actor) return null
    if (!dc?.calculation || dc.calculation === 'spellcasting') return spellDc()
    return 8 + proficiency() + mod(dc.calculation)
  }
  /** Una parte de daño: su media, su fórmula y su tipo (5 (1d6 + 2) Slashing) */
  const partText = (formula: string, types: readonly string[], showAverage: boolean) => {
    const avg = showAverage ? average(formula) : null
    const type = types.map(capital).join(' or ')
    return [avg !== null ? `${avg} (${formula})` : formula, type].filter(Boolean).join(' ')
  }
  const formulaOf = (part: Part, bonus = 0) => {
    if (part.custom?.enabled && part.custom.formula) return part.custom.formula
    if (!part.number || !part.denomination) return null
    const extra = (num(part.bonus) ?? 0) + bonus
    return `${part.number}d${part.denomination}${extra ? ` ${extra > 0 ? '+' : '−'} ${Math.abs(extra)}` : ''}`
  }
  const template = (activity: Activity | undefined) => {
    const t = activity?.target?.template?.type
      ? activity.target.template
      : (system.target as Activity['target'])?.template
    if (!t?.type) return ''
    const size = t.size ?? ''
    switch (t.type) {
      case 'radius':
      case 'sphere':
        return `${size}-foot-radius Sphere`
      case 'cylinder':
        return `${size}-foot-radius, ${t.height ?? ''}-foot-high Cylinder`
      case 'line':
        return `${size}-foot-long, ${t.width ?? 5}-foot-wide Line`
      default:
        return `${size}-foot ${capital(t.type)}`
    }
  }
  const affects = (activity: Activity | undefined) => {
    const a = activity?.target?.affects?.type ? activity.target.affects : (system.target as Activity['target'])?.affects
    if (!a?.type) return ''
    const what = a.type === 'creature' ? 'creature' : a.type === 'object' ? 'object' : a.type.replace(/([A-Z])/g, ' $1')
    const count = num(a.count)
    if (count && count > 1) return `${a.choice ? 'up to ' : ''}${count} ${what}s`
    if (count === 1) return `one ${what}`
    return `each ${what}`
  }

  const lookup = (path: string): string | undefined => {
    const activity = activityFor({}, ['save', 'attack', 'damage'])
    switch (path) {
      case 'labels.description.affects':
        return affects(activity)
      case 'target.affects.type':
        return activity?.target?.affects?.type ?? (get(system, path) as string | undefined)
      case 'labels.description.template':
        return template(activity)
      case 'save.dc.value':
      case 'attributes.spell.dc': {
        const dc = path === 'save.dc.value' ? dcOf(activity) : actor ? spellDc() : null
        return dc === null ? undefined : String(dc)
      }
    }
    const ability = /^abilities\.(\w+)\.mod$/.exec(path)
    if (ability && actor) return signed(mod(ability[1] as string))
    const passive = /^skills\.(\w+)\.passive$/.exec(path)
    if (passive && actor) {
      const skill = passive[1] as string
      const level = num(get(actor.system, `skills.${skill}.value`)) ?? 0
      return String(10 + mod(SKILL_ABILITY[skill] ?? 'wis') + Math.floor(level * proficiency()))
    }
    const target = /^target\.template\.(size|width|height)$/.exec(path)
    if (target) return String(get(activity, path) ?? get(system, path) ?? '') || undefined
    const own = get(system, path.replace(/^item\./, ''))
    if (typeof own === 'number' || typeof own === 'string') return String(own)
    const theirs = get(actor?.system, path)
    return typeof theirs === 'number' || typeof theirs === 'string' ? String(theirs) : undefined
  }

  const roll = ({ command, named, words }: InlineRoll): string | undefined => {
    const flags = new Set(words.map((w) => w.toLowerCase()))
    const loose = words.filter((w) => !['average', 'extended', 'passive'].includes(w.toLowerCase()))
    switch (command) {
      case 'attack': {
        const activity = activityFor(named, ['attack'])
        if (activity?.type !== 'attack') return undefined
        const ranged = activity.attack?.type?.value === 'ranged'
        const kind = `${ranged ? 'Ranged' : 'Melee'} Attack Roll`
        let bonus: number | null = null
        if (actor) {
          const own = num(activity.attack?.bonus) ?? 0
          const magic = num(system.magicalBonus) ?? 0
          bonus = activity.attack?.flat ? own : mod(attackAbility(activity)) + proficiency() + own + magic
        }
        if (!flags.has('extended')) return bonus === null ? '' : signed(bonus)
        const reach = num(activity.range?.value) ?? num(get(system, 'range.reach')) ?? 5
        const distance = ranged
          ? `range ${[get(system, 'range.value'), get(system, 'range.long')].filter((v) => v !== null && v !== undefined && v !== '').join('/')} ft`
          : `reach ${reach} ft`
        return `${kind}: ${bonus === null ? '' : `${signed(bonus)}, `}${distance}`
      }
      case 'damage':
      case 'heal':
      case 'healing': {
        const showAverage = flags.has('average')
        const given = named.formula ?? loose.find((w) => /\d/.test(w))
        let text: string
        if (given) {
          const types = (named.type ?? loose.filter((w) => w !== given).join('|')).split('|').filter(Boolean)
          text = partText(given, types, showAverage)
        } else {
          const activity = activityFor(named, ['attack', 'damage', 'save', 'heal'])
          if (!activity) return undefined
          const parts: string[] = []
          const base = get(system, 'damage.base') as Part | undefined
          if (activity.damage?.includeBase && base) {
            // La característica del ataque y el bono mágico del arma
            const ability = activity.type === 'attack' && actor ? mod(attackAbility(activity)) : 0
            const formula = formulaOf(base, ability + (num(system.magicalBonus) ?? 0))
            if (formula) parts.push(partText(formula, base.types ?? [], showAverage))
          }
          for (const part of activity.damage?.parts ?? []) {
            const formula = formulaOf(part)
            if (formula && !formula.includes('@')) parts.push(partText(formula, part.types ?? [], showAverage))
          }
          if (parts.length === 0) return undefined
          text = parts.join(' plus ')
        }
        return flags.has('extended') ? `Hit: ${text} damage` : text
      }
      case 'save': {
        const activity = activityFor(named, ['save'])
        const given = named.ability ?? loose.find((w) => !/^\d+$/.test(w))
        const saveAbility = activity?.save?.ability
        const ability = given ?? (Array.isArray(saveAbility) ? saveAbility[0] : saveAbility)
        const dc = num(named.dc) ?? num(loose.find((w) => /^\d+$/.test(w))) ?? dcOf(activity)
        if (!ability) return undefined
        if (flags.has('extended')) return `${abilityName(ability)} Saving Throw${dc !== null ? `: DC ${dc}` : ''}`
        return `${dc !== null ? `DC ${dc} ` : ''}${abilityName(ability)}`
      }
      case 'check':
      case 'skill':
      case 'tool': {
        const rest = loose.filter((w) => !/^\d+$/.test(w))
        const ability = named.ability ?? (rest[0] && ABILITIES[rest[0]] ? rest[0] : undefined)
        const skill = named.skill ?? rest.find((w) => w !== ability)
        const dc = num(named.dc) ?? num(loose.find((w) => /^\d+$/.test(w)))
        const label = [
          ability ? abilityName(ability) : '',
          skill ? (ability ? `(${skillName(skill)})` : skillName(skill)) : ''
        ]
          .filter(Boolean)
          .join(' ')
        return [dc !== null ? `DC ${dc}` : '', label].filter(Boolean).join(' ')
      }
      default:
        return undefined
    }
  }
  return { lookup, roll }
}
