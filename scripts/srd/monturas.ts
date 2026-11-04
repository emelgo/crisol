/**
 * Las monturas, los arreos y los vehículos (y, en 2014, las mercancías) de los dos SRD: tablas en el orden de lectura,
 * cada una con sus columnas; lo que dicen sus columnas va en el texto del objeto, con las palabras de cada idioma
 */
import { costOf, type Doc, weightOf } from './equipo.ts'
import type { Edition, Lang, Row } from './texto.ts'
import { SOURCE } from './texto.ts'

export interface MountRow {
  name: string
  kind: 'montura' | 'arreos' | 'vehiculo' | 'mercancia'
  cost: number
  weight: number | null
  /** Lo que dicen sus columnas, tal cual, para su texto */
  stats: Record<string, string>
  page: number
}

const COST: Record<Lang, string> = {
  en: String.raw`[\d,]+ (?:cp|sp|gp|CP|SP|GP)`,
  es: String.raw`\d+(?: \d{3})* (?:pc|pp|po)`
}
const WEIGHT: Record<Lang, string> = { en: String.raw`[\d,/½]+ lb\.|—`, es: String.raw`[\d,½]+ kg|—` }

/** Lo que en la tabla de arreos es un vehículo (lo demás, arreos) */
const DRAWN = /^(Carriage|Cart|Chariot|Sled|Wagon|Carruaje|Carreta|Carro|Carro de guerra|Trineo)$/

const cost = (text: string, lang: Lang) =>
  costOf(
    text.replace(/ [A-Z]+$/, (u) => u.toLowerCase()),
    lang
  )

/** Las filas de una tabla desde su título hasta el siguiente título conocido (o lo que ya no es una fila) */
function tableRows(rows: readonly Row[], title: RegExp, end: RegExp): Row[] {
  const start = rows.findIndex((r) => title.test(r.text))
  if (start < 0) return []
  const out: Row[] = []
  for (const row of rows.slice(start + 1)) {
    if (end.test(row.text)) break
    out.push(row)
  }
  return out
}

const ENDS: Record<Lang, RegExp> = {
  en: /^(Tack, Harness, and Drawn Vehicles|Waterborne Vehicles|Trade Goods|Large Vehicles|Lifestyle Expenses|Food, Drink, and Lodging|Airborne and Waterborne Vehicles|Crew)$/,
  es: /^(Arreos, arneses y vehículos tirados( por)?|Vehículos acuáticos|Mercancías|Vehículos grandes|Gastos de estilo de vida|Comida, bebida y alojamiento|Vehículos acuáticos y aéreos|Tripulación)$/
}

export function mountRows(rows: readonly Row[], edition: Edition, lang: Lang): MountRow[] {
  const out: MountRow[] = []
  const C = COST[lang]
  const W = WEIGHT[lang]
  const distance = lang === 'en' ? String.raw`\d+ ft\.` : String.raw`[\d,]+ m`
  const capacity = lang === 'en' ? String.raw`[\d,]+ lb\.` : String.raw`[\d,]+ kg`
  const add = (
    name: string,
    kind: MountRow['kind'],
    c: string,
    w: string | null,
    stats: Record<string, string>,
    page: number
  ) => out.push({ name, kind, cost: cost(c, lang), weight: w ? weightOf(w) : null, stats, page })

  // Las monturas
  const mounts = tableRows(rows, /^(Mounts and Other Animals|Monturas y otros animales)$/, ENDS[lang])
  const mount =
    edition === '2014'
      ? new RegExp(`^(?<name>.+?) (?<cost>${C}) (?<speed>${distance}) (?<capacity>${capacity})$`)
      : new RegExp(`^(?<name>.+?) (?<capacity>${capacity}) (?<cost>${C})$`)
  for (const r of mounts) {
    const m = mount.exec(r.text)?.groups
    if (m)
      add(
        m.name as string,
        'montura',
        m.cost as string,
        null,
        { ...(m.speed ? { speed: m.speed } : {}), capacity: m.capacity as string },
        r.page
      )
  }

  // Los arreos y los vehículos de tiro (las sillas, en su grupo)
  const tack = tableRows(
    rows,
    /^(Tack, Harness, and Drawn Vehicles|Arreos, arneses y vehículos tirados( por)?)$/,
    /^(Waterborne Vehicles|Vehículos acuáticos|Large Vehicles|Vehículos grandes)$/
  )
  const tackRow =
    edition === '2014'
      ? new RegExp(`^(?<name>.+?) (?<cost>${C}) (?<weight>${W})$`)
      : new RegExp(`^(?<name>.+?) (?<weight>${W}) (?<cost>${C})$`)
  let saddle = false
  for (const r of tack) {
    if (/^(Saddle|Silla)$/.test(r.text)) {
      saddle = true
      continue
    }
    const m = tackRow.exec(r.text)?.groups
    if (!m) continue
    const raw = m.name as string
    const inSaddle = saddle && /^(Exotic|Military|Pack|Riding|De monta|De tiro|Exótica|Militar)$/.test(raw)
    if (!inSaddle) saddle = false
    const name = inSaddle ? (lang === 'en' ? `${raw} saddle` : `Silla ${raw.toLowerCase()}`) : raw
    add(name, DRAWN.test(raw) ? 'vehiculo' : 'arreos', m.cost as string, m.weight as string, {}, r.page)
  }

  if (edition === '2014') {
    // Los vehículos acuáticos y las mercancías
    const speed = lang === 'en' ? String.raw`[\d½]+ mph` : String.raw`[\d,]+ km/h`
    const ship = new RegExp(`^(?<name>.+?) (?<cost>${C}) (?<speed>${speed})$`)
    for (const r of tableRows(rows, /^(Waterborne Vehicles|Vehículos acuáticos)$/, /^(Trade Goods|Mercancías)$/)) {
      const m = ship.exec(r.text)?.groups
      if (m) add(m.name as string, 'vehiculo', m.cost as string, null, { speed: m.speed as string }, r.page)
    }
    const goods = new RegExp(`^(?<cost>${C}) (?<goods>.+)$`)
    // Su tabla es la segunda con ese título (el primero es el de la sección)
    const titles = rows.flatMap((r, i) => (/^(Trade Goods|Mercancías)$/.test(r.text) ? [i] : []))
    const from = titles.at(-1) ?? -1
    for (const r of rows.slice(from + 1)) {
      const m = goods.exec(r.text)?.groups
      if (!m) {
        if (out.some((x) => x.kind === 'mercancia')) break
        continue
      }
      // El PDF parte el «m²» en «m 2»
      const text = (m.goods as string).replace(/ m 2 /g, ' m² ')
      add(text.charAt(0).toUpperCase() + text.slice(1), 'mercancia', m.cost as string, null, {}, r.page)
    }
    return out
  }

  // En 2024, los vehículos grandes: la mitad de sus columnas en cada columna de la página, fila a fila
  const big = tableRows(rows, /^(Airborne and Waterborne Vehicles|Vehículos acuáticos y aéreos)$/, /^$/)
  const speed = lang === 'en' ? String.raw`[\d½]+ mph` : String.raw`[\d,]+ km/h`
  const left = new RegExp(
    `^(?<name>.+?) (?<speed>${speed}) (?<crew>\\d+) (?<passengers>\\d+|—)(?: (?<cargo>[\\d/]+|—))?$`
  )
  // En español, el cargamento cae en la otra mitad: va delante
  const right = new RegExp(`^(?:(?<load>[\\d/]+|—) )?(?<ac>\\d+) (?<hp>\\d+) (?<threshold>\\d+|—) (?<cost>${C})$`)
  const halves = { left: [] as Record<string, string>[], right: [] as Record<string, string>[] }
  let page = 0
  for (const r of big) {
    const l = left.exec(r.text)?.groups
    if (l) {
      halves.left.push(l as Record<string, string>)
      page = r.page
    }
    const g = right.exec(r.text)?.groups
    if (g) halves.right.push(g as Record<string, string>)
  }
  for (const [i, l] of halves.left.entries()) {
    const g = halves.right[i]
    if (!g) break
    const { load, ...rest } = g
    add(l.name as string, 'vehiculo', g.cost as string, null, { ...l, ...rest, ...(load ? { cargo: load } : {}) }, page)
  }
  return out
}

/** Lo que dicen sus columnas, como texto en cada idioma */
export function statsText(row: MountRow, lang: Lang): string {
  const s = row.stats
  const parts =
    lang === 'en'
      ? [
          s.speed && `Speed ${s.speed}`,
          s.capacity && `carrying capacity ${s.capacity}`,
          s.crew && `crew ${s.crew}`,
          s.passengers && `passengers ${s.passengers}`,
          s.cargo && `cargo (tons) ${s.cargo}`,
          s.ac && `AC ${s.ac}`,
          s.hp && `HP ${s.hp}`,
          s.threshold && `damage threshold ${s.threshold}`
        ]
      : [
          s.speed && `Velocidad ${s.speed}`,
          s.capacity && `capacidad de carga ${s.capacity}`,
          s.crew && `tripulación ${s.crew}`,
          s.passengers && `pasajeros ${s.passengers}`,
          s.cargo && `cargamento (t) ${s.cargo}`,
          s.ac && `CA ${s.ac}`,
          s.hp && `PG ${s.hp}`,
          s.threshold && `umbral de daño ${s.threshold}`
        ]
  const text = parts.filter(Boolean).join('; ')
  if (!text) return ''
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}${text.endsWith('.') ? '' : '.'}`
}

/** La firma de una montura o un vehículo: su clase y su precio, y (si lo hay) su peso, su velocidad o su carga */
export function mountSignature(r: MountRow): string {
  const feet = r.stats.speed?.endsWith(' m')
    ? Math.round(Number(r.stats.speed.replace(' m', '').replace(',', '.')) / 0.3)
    : r.stats.speed
  const mph = r.stats.speed?.endsWith('km/h')
    ? Math.round((Number(r.stats.speed.replace(' km/h', '').replace(',', '.')) / 1.5) * 2) / 2
    : r.stats.speed?.endsWith('mph')
      ? Number(r.stats.speed.replace(' mph', '').replace('½', '.5'))
      : null
  const capacity = r.stats.capacity ? weightOf(r.stats.capacity) : null
  return `${r.kind}|${r.cost}|${r.weight ?? ''}|${mph ?? (typeof feet === 'number' ? feet : (feet ?? '').replace(' ft.', ''))}|${capacity ?? ''}`
}

export function mountDoc(edition: Edition, en: MountRow, es: MountRow, name: string): Doc {
  const text = { es: statsText(es, 'es'), en: statsText(en, 'en') }
  // Una mercancía se llama por lo que es y cuánto («0,5 kg de trigo»): su clave, con su clase delante
  const concept = en.kind === 'mercancia' ? `mercancia_${name}` : name
  return {
    type: 'equipo',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data: {
      name: { es: es.name, en: en.name },
      categoria: en.kind,
      peso: en.weight ?? 0,
      coste: en.cost,
      ...(text.es && text.en ? { descripcion: text } : {})
    },
    mechanics: { automation: 'text' },
    ref: { pages: { en: en.page, es: es.page } }
  }
}
