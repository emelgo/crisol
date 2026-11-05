/**
 * Los objetos mágicos de los dos SRD: su categoría, su rareza y su sintonización, su texto en Markdown y su mecánica,
 * sacada del texto en inglés: los bonos a la CA y a las salvaciones, las características que fija, las resistencias,
 * las cargas y lo que cura al beberlo
 */
import { ABILITIES, DAMAGE_TYPES } from '../../packages/systems/src/catalog/5e/system.ts'
import { PROFILES, range } from './capitulos.ts'
import { concepts, type Doc } from './equipo.ts'
import { MAGIC_ITEM_PAIRS, MAGIC_ITEM_RENAMES } from './pares.ts'
import { basesOf, cut, joinLine, ruleRows, textOf } from './reglas.ts'
import { type Edition, type Lang, type Row, SOURCE } from './texto.ts'

const t = (es: string, en: string) => ({ es, en })

/** Dónde están, desde «Magic Items A-Z» hasta lo que sigue */
const PAGES: Record<Edition, Record<Lang, { pages: [number, number]; stop: RegExp }>> = {
  '2014': {
    en: { pages: [207, 251], stop: /^Sentient Magic Items$/ },
    es: { pages: [222, 271], stop: /^Objetos mágicos$/ }
  },
  '2024': {
    en: { pages: [209, 253], stop: /^Monsters$/ },
    es: { pages: [228, 277], stop: /^Monstruos$/ }
  }
}
/** El alto del nombre de un objeto y el de su línea de categoría (en el 5.1 inglés, la del texto) */
const HEIGHTS: Record<Edition, Record<Lang, { name: number[]; header: number | null }>> = {
  '2014': { en: { name: [14.3], header: null }, es: { name: [16.1], header: 13.2 } },
  '2024': { en: { name: [14.3], header: 13.3 }, es: { name: [14.3], header: 13.3 } }
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Las rarezas, en el orden en que salen en la cabecera (la primera es la del objeto) */
const RARITY: [RegExp, string][] = [
  [/\bvery rare\b|\bmuy rar[ao]\b/, 'muy_rara'],
  [/\buncommon\b|\binfrecuente\b/, 'infrecuente'],
  [/\bcommon\b|\bcomun\b/, 'comun'],
  [/\brare\b|\brar[ao]\b/, 'rara'],
  [/\blegendary\b|\blegendari[ao]\b/, 'legendaria'],
  [/\bartifact\b|\bartefacto\b/, 'artefacto']
]

export interface MagicRow {
  name: string
  /** La línea de su categoría, rareza y sintonización */
  header: string
  /** La categoría (lo de antes de la rareza): «Wondrous item», «Armor (plate)» */
  category: string
  rarity: string | null
  attunement: boolean
  text: string
  page: number
}

/** Lo que dice la línea de la cabecera: su categoría, su rareza (la primera que nombra) y si pide sintonización */
export function headerOf(header: string): Pick<MagicRow, 'category' | 'rarity' | 'attunement'> | null {
  const folded = fold(header)
  const found = RARITY.map(([re, key]) => ({ key, at: folded.search(re) }))
    .filter((r) => r.at >= 0)
    .sort((a, b) => a.at - b.at)
  const varies = /rarity varies|rareza variable|varies|variable/.exec(folded)
  const first = found[0]
  const at = Math.min(first?.at ?? Infinity, varies?.index ?? Infinity)
  if (!Number.isFinite(at)) return null
  return {
    category: header
      .slice(0, at)
      .replace(/[,\s]+$/, '')
      .trim(),
    rarity: first && first.at === at ? first.key : null,
    attunement: /requires attunement|requiere sintonizaci/.test(folded)
  }
}

/** Un objeto a partir de sus líneas: la cabecera (en una o más líneas) y su texto */
export function parseMagicItem(
  name: string,
  rows: readonly Row[],
  page: number,
  header: number | null,
  textRows: (rows: readonly Row[]) => string
): MagicRow | null {
  let used = 0
  let line = ''
  if (header !== null) {
    while (used < rows.length && (rows[used] as Row).h === header) line = joinLine(line, (rows[used++] as Row).text)
  } else {
    line = rows[0]?.text ?? ''
    used = 1
    // Sigue en la línea de abajo si queda un paréntesis abierto, si acaba en coma, «or» o «very» o si la siguiente sigue la
    // rareza («rare (+3)», «(requires attunement)»)
    while (used < rows.length) {
      const next = (rows[used] as Row).text
      const open = (line.match(/\(/g)?.length ?? 0) > (line.match(/\)/g)?.length ?? 0)
      const cutRarity = /(,| or| very)$/.test(line) || /^(\(|or |rare|very rare|uncommon|legendary|artifact)/.test(next)
      if (!(open || cutRarity)) break
      line = joinLine(line, next)
      used++
    }
  }
  const head = headerOf(line.trim())
  if (!head) return null
  return { name, header: line.trim(), ...head, text: textRows(rows.slice(used)), page }
}

/** Los objetos mágicos de una edición en un idioma, en su orden */
export function magicRows(edition: Edition, lang: Lang): MagicRow[] {
  const { pages, stop } = PAGES[edition][lang]
  const profile = PROFILES[edition][lang]
  const rows = ruleRows(edition, lang, range(...pages), profile.caps)
  const bases = basesOf(rows, profile.text)
  const { name, header } = HEIGHTS[edition][lang]
  const entries = cut(rows, (r) => name.includes(r.h) || profile.section.includes(r.h), stop)
  // Lo de antes de la sección de la A a la Z (las reglas) no va
  const start = entries.findIndex((e) => profile.section.includes(e.h) && /A[–-]Z|de la A/.test(e.name))
  return entries
    .slice(start + 1)
    .filter((e) => name.includes(e.h))
    .map((e) => parseMagicItem(e.name, e.rows, e.page, header, (own) => textOf(own, { bases, profile: profile.text })))
    .filter((r): r is MagicRow => r !== null)
}

/** La clase de un objeto por su categoría, en los dos idiomas */
function kindOf(category: string): string {
  const kind = fold(category)
  return (
    [
      ['wondrous|maravillos', 'w'],
      ['shield|escudo', 'a'],
      ['armor|armadura', 'a'],
      ['weapon|arma', 'x'],
      ['potion|pocion', 'p'],
      ['ring|anillo', 'r'],
      ['rod|vara(?!ita)', 'o'],
      ['scroll|pergamino', 's'],
      ['staff|baston', 't'],
      ['wand|varita', 'v']
    ].find(([re]) => new RegExp(re as string).test(kind))?.[1] ?? '?'
  )
}

/** El grupo de un objeto: su clase, sus rarezas y su sintonización (lo mismo en los dos idiomas) */
export function magicGroup(r: MagicRow): string {
  const rarities = RARITY.filter(([re]) => re.test(fold(r.header)))
    .map(([, k]) => k)
    .sort()
  return `${kindOf(r.category)}|${rarities.join(',')}|${r.attunement ? 'S' : ''}`
}

/** Los dados y los números de un texto, sin los que llevan unidad (cambian al traducirse) ni los separadores de miles */
export function numbersOf(text: string): { dice: string[]; numbers: string[] } {
  const dice = [...text.matchAll(/\b(\d*)d(\d+)\b/g)].map((m) => `${m[1] || 1}d${m[2]}`)
  const plain = text
    .replace(/\b(\d*)d(\d+)\b/g, ' ')
    .replace(/(\d)[,.\u00a0\u202f ](\d{3})(?!\d)/g, '$1$2')
    .replace(/[\d.,]+\s*(feet|foot|ft\.?|pounds?|lb\.?|miles?|m|metros?|kg|km|cm|kilos?|kilogramos?)\b/gi, ' ')
  const numbers = [...plain.matchAll(/(?<![\d.,])(\d+)(?![\d.,]\d)/g)].map((m) => m[1] as string)
  return { dice, numbers }
}

/** Cuánto se parecen dos multiconjuntos (de 0 a 1; vacíos los dos, 1) */
function overlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  const left = [...b]
  let same = 0
  for (const x of a) {
    const i = left.indexOf(x)
    if (i >= 0) {
      same++
      left.splice(i, 1)
    }
  }
  return (2 * same) / (a.length + b.length)
}

/** El sustantivo de un nombre en inglés y lo que es en español (la primera palabra del nombre español) */
const NOUNS: Record<string, string[]> = {
  ammunition: ['municion'],
  amulet: ['amuleto'],
  apparatus: ['aparato'],
  armor: ['armadura', 'cota', 'malla', 'cuero'],
  arrow: ['flecha'],
  axe: ['hacha'],
  bag: ['bolsa'],
  ball: ['bola'],
  bands: ['bandas'],
  bead: ['canica', 'abalorio'],
  belt: ['cinturon'],
  boat: ['bote'],
  boots: ['botas'],
  bottle: ['botella'],
  bow: ['arco'],
  bowl: ['cuenco'],
  bracers: ['brazales'],
  brazier: ['brasero'],
  brooch: ['broche'],
  broom: ['escoba'],
  candle: ['vela'],
  cape: ['capa'],
  carpet: ['alfombra'],
  censer: ['incensario'],
  chime: ['carillon'],
  circlet: ['diadema'],
  cloak: ['capa'],
  cube: ['cubo'],
  dagger: ['daga'],
  decanter: ['decantador'],
  deck: ['baraja'],
  dust: ['polvo'],
  elixir: ['elixir'],
  eyes: ['anteojos'],
  fan: ['abanico'],
  figurine: ['estatuilla'],
  flask: ['frasco'],
  fortress: ['fortaleza'],
  gate: ['portal'],
  gauntlets: ['guanteletes'],
  gem: ['gema'],
  gloves: ['guantes'],
  glue: ['pegamento'],
  goggles: ['anteojos'],
  greatclub: ['garrote'],
  hammer: ['martillo'],
  hat: ['sombrero'],
  haversack: ['morral'],
  headband: ['diadema'],
  helm: ['yelmo'],
  hole: ['agujero'],
  horn: ['cuerno'],
  horseshoes: ['herraduras'],
  javelin: ['jabalina'],
  lantern: ['linterna'],
  mace: ['maza'],
  mantle: ['manto'],
  manual: ['manual'],
  medallion: ['medallon'],
  mirror: ['espejo'],
  necklace: ['collar', 'colgante'],
  oil: ['aceite'],
  ointment: ['unguento'],
  orb: ['orbe'],
  pearl: ['perla'],
  periapt: ['talisman', 'colgante'],
  philter: ['filtro'],
  pigments: ['pigmentos'],
  pipes: ['flauta'],
  potion: ['pocion'],
  potions: ['pociones'],
  quarterstaff: ['baston'],
  quiver: ['aljaba'],
  ring: ['anillo'],
  robe: ['tunica'],
  rod: ['vara', 'cetro'],
  rope: ['cuerda'],
  scarab: ['escarabajo'],
  scimitar: ['cimitarra'],
  scroll: ['pergamino'],
  shackles: ['grilletes'],
  shield: ['escudo'],
  slippers: ['babuchas'],
  solvent: ['disolvente'],
  sphere: ['esfera'],
  staff: ['baston'],
  stone: ['piedra'],
  stones: ['piedras'],
  talisman: ['talisman'],
  tome: ['tomo'],
  trident: ['tridente'],
  wand: ['varita'],
  well: ['pozo'],
  wings: ['alas']
}

/** El sustantivo de un nombre en inglés: lo de antes de «of» («Boots of Elvenkind») o la última palabra */
const nounOf = (name: string) =>
  (name.includes(' of ') ? (name.split(' of ')[0] ?? '') : name.replace(/,.*$/, '')).split(' ').at(-1)?.toLowerCase() ??
  ''

/**
 * Cuánto se parecen un objeto en inglés y uno en español del mismo grupo: sus dados, sus números y su largo, y si su
 * nombre empieza por lo que es en español su sustantivo
 */
export function likeness(en: MagicRow, es: MagicRow): number {
  const a = numbersOf(en.text)
  const b = numbersOf(es.text)
  const ratio = Math.log((es.text.length + 50) / (en.text.length + 50) / 1.15)
  const noun = NOUNS[nounOf(en.name)]
  const first = fold(es.name).split(/[ ,]/)[0] ?? ''
  const named = noun ? (noun.includes(first) ? 1 : -3) : 0
  return overlap(a.dice, b.dice) + overlap(a.numbers, b.numbers) - Math.abs(ratio) + named
}

/**
 * Empareja por la lista revisada y, los demás, dentro de su grupo, por parecido: de más a menos, cada uno con uno. Lo
 * que queda sin pareja, o con un parecido pobre, falla y dice cuáles son (para la lista revisada)
 */
export function pairByLikeness(
  en: readonly MagicRow[],
  es: readonly MagicRow[],
  manual: Record<string, string> = {}
): [MagicRow, MagicRow][] {
  const out: [MagicRow, MagicRow][] = []
  const left = new Set(es)
  const pending: MagicRow[] = []
  for (const row of en) {
    const wanted = manual[row.name]
    const found = wanted ? [...left].find((r) => r.name === wanted) : undefined
    if (wanted && !found) throw new Error(`No está «${wanted}» en español`)
    if (found) {
      out.push([row, found])
      left.delete(found)
    } else pending.push(row)
  }
  const candidates = pending.flatMap((a) =>
    [...left].filter((b) => magicGroup(a) === magicGroup(b)).map((b) => ({ a, b, score: likeness(a, b) }))
  )
  candidates.sort((x, y) => y.score - x.score)
  const done = new Set<MagicRow>()
  for (const { a, b, score } of candidates) {
    if (done.has(a) || !left.has(b) || score < 0.8) continue
    out.push([a, b])
    done.add(a)
    left.delete(b)
  }
  const lost = pending.filter((a) => !done.has(a))
  if (lost.length > 0 || left.size > 0)
    throw new Error(
      `Sin pareja: ${lost.map((r) => `${r.name} (${magicGroup(r)})`).join(', ')} | en español: ${[...left].map((r) => `${r.name} (${magicGroup(r)})`).join(', ')}`
    )
  return en.map((row) => out.find(([a]) => a === row) as [MagicRow, MagicRow])
}

const ABILITY: Record<string, string> = Object.fromEntries(ABILITIES.map(([key, , en]) => [en.toLowerCase(), key]))
const DAMAGE: Record<string, string> = Object.fromEntries(DAMAGE_TYPES.map(([key, , en]) => [en.toLowerCase(), key]))

type Mechanics = Record<string, unknown>

/** Lo que hace un objeto, del texto en inglés: sus efectos (sintonizado o, si no lo pide, equipado), sus cargas y sus pociones */
export function magicMechanics(edition: Edition, en: MagicRow, name: { es: string; en: string }): Mechanics {
  const on = en.attunement ? '@este.sintonizado' : '@este.equipado'
  const text = en.text
  const effects: Record<string, unknown>[] = []
  // «+1 bonus to AC and saving throws» (el anillo, la capa); «+2 bonus to AC if you are wearing no armor» (los brazales)
  const ac = /\+(\d) bonus to (?:AC|Armor Class)( and (?:to )?saving throws)?/i.exec(text)
  if (ac) {
    const bare = /wearing no armor|aren’t wearing armor|no armor and using no Shield|not wearing armor/i.test(text)
    const when = bare ? `${on} && !@con_armadura && !@con_escudo` : on
    effects.push({ target: 'ca', op: 'add', value: ac[1], when })
    if (ac[2]) effects.push({ target: 'bono_salvaciones', op: 'add', value: ac[1], when })
  } else {
    const saves = /\+(\d) bonus to (?:all )?saving throws/i.exec(text)
    if (saves) effects.push({ target: 'bono_salvaciones', op: 'add', value: saves[1], when: on })
  }
  // «Your Constitution score is 19 while you wear this amulet»
  const score = /Your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) (?:score )?is (\d+) while/i.exec(
    text
  )
  if (score)
    effects.push({
      target: `caracteristicas.${ABILITY[(score[1] as string).toLowerCase()]}.puntuacion`,
      op: 'min',
      value: score[2],
      when: on
    })
  // «You have resistance to fire damage»
  for (const m of text.matchAll(/(?:have|has|gain) resistance to (\w+) damage/gi)) {
    const type = DAMAGE[(m[1] as string).toLowerCase()]
    if (type && !effects.some((e) => e.value === `"${type}"`))
      effects.push({ target: 'resistencias', op: 'append', value: `"${type}"`, when: on })
  }
  const resources: Record<string, unknown>[] = []
  const charges = /has (\d+) charges/i.exec(text)
  if (charges) {
    const back = /regains (\d+d\d+(?:\s*\+\s*\d+)?|\d+|all)(?: expended)? charges? daily at dawn/i.exec(text)
    resources.push({
      key: 'cargas',
      label: t('Cargas', 'Charges'),
      max: charges[1],
      ...(back
        ? {
            recovery: 'dawn',
            ...(back[1] && back[1] !== 'all' ? { amount: (back[1] as string).replace(/\s+/g, '') } : {})
          }
        : {})
    })
  }
  const actions: Record<string, unknown>[] = []
  // «You regain 2d4 + 2 Hit Points when you drink this potion»
  const drink = /regain (\d+d\d+(?:\s*\+\s*\d+)?) hit points when you drink/i.exec(text)
  if (drink)
    actions.push({
      key: 'beber',
      label: name,
      activation: edition === '2024' ? 'bonus' : 'action',
      heal: (drink[1] as string).replace(/\s+/g, '')
    })
  if (effects.length === 0 && resources.length === 0 && actions.length === 0) return { automation: 'text' }
  return {
    ...(effects.length > 0 ? { effects } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    ...(actions.length > 0 ? { actions } : {}),
    automation: 'partial'
  }
}

/** El documento de un objeto mágico de una edición */
export function magicDoc(edition: Edition, en: MagicRow, es: MagicRow, concept: string): Doc {
  return {
    type: 'objeto_magico',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data: {
      name: t(es.name, en.name),
      tipo: t(es.category, en.category),
      ...(en.rarity ? { rareza: en.rarity } : {}),
      sintonia: en.attunement,
      descripcion: t(es.text, en.text)
    },
    mechanics: magicMechanics(edition, en, t(es.name, en.name)),
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** Los objetos de una edición, emparejados por la lista revisada y, los demás, por su firma */
export function magicPairs(edition: Edition): [MagicRow, MagicRow][] {
  return pairByLikeness(magicRows(edition, 'en'), magicRows(edition, 'es'), MAGIC_ITEM_PAIRS[edition])
}

/** Los objetos mágicos de las dos ediciones, con su concepto; el que ya es de otro tipo (la poción), con «objeto_magico_» */
export function magicDocs(taken: ReadonlySet<string> = new Set()): Doc[] {
  const newer = magicPairs('2024')
  const older = magicPairs('2014')
  const names = concepts(newer, older, MAGIC_ITEM_RENAMES)
  const own = (concept: string) => (taken.has(concept) ? `objeto_magico_${concept}` : concept)
  return [
    ...older.map(([en, es], i) => magicDoc('2014', en, es, own(names.older[i] as string))),
    ...newer.map(([en, es], i) => magicDoc('2024', en, es, own(names.newer[i] as string)))
  ]
}
