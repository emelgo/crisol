/**
 * Las especies (y las subrazas de 2014), los trasfondos y las dotes de los dos SRD: cada uno por su nombre (la lista
 * revisada de abajo), con su texto, sus rasgos como documentos que concede y la mecánica que sale clara de su texto: los
 * aumentos de característica, la velocidad, las resistencias, las habilidades, la dote de origen y algunas dotes
 */
import { ABILITIES, DAMAGE_TYPES, SKILLS } from '../../packages/systems/src/catalog/5e/system.ts'
import { PROFILES, range } from './capitulos.ts'
import type { Doc } from './equipo.ts'
import { TRAIT_PAIRS } from './pares.ts'
import { basesOf, cut, joinLine, ruleRows, textOf } from './reglas.ts'
import { type Edition, type Lang, type Row, SOURCE, slug } from './texto.ts'

const t = (es: string, en: string) => ({ es, en })

type Kind = 'especie' | 'trasfondo' | 'dote'

export interface Origin {
  type: Kind
  en: string
  es: string
  /** El nombre de su título, si no es el suyo («Dwarf Traits») */
  heading?: { en: string; es: string }
  /** La especie de una subraza (en inglés) */
  parent?: string
}

const o = (type: Kind, en: string, es: string, more: Partial<Origin> = {}): Origin => ({ type, en, es, ...more })
const race = (en: string, es: string, plural: string, enPlural = en) =>
  o('especie', en, es, { heading: { en: `${enPlural} Traits`, es: `Atributos de los ${plural}` } })

/** Lo que hay en cada edición, por su nombre en los dos idiomas y dónde está */
export const ORIGINS: Record<Edition, { pages: Record<Lang, [number, number]>; items: Origin[] }[]> = {
  '2014': [
    {
      pages: { en: [3, 7], es: [2, 7] },
      items: [
        race('Dwarf', 'Enano', 'enanos'),
        o('especie', 'Hill Dwarf', 'Enano de las colinas', { parent: 'Dwarf' }),
        race('Elf', 'Elfo', 'elfos'),
        o('especie', 'High Elf', 'Alto elfo', { parent: 'Elf' }),
        race('Halfling', 'Mediano', 'medianos'),
        o('especie', 'Lightfoot', 'Piesligeros', { parent: 'Halfling' }),
        race('Human', 'Humano', 'humanos'),
        race('Dragonborn', 'Dracónido', 'dracónidos'),
        race('Gnome', 'Gnomo', 'gnomos'),
        o('especie', 'Rock Gnome', 'Gnomo de las rocas', { parent: 'Gnome' }),
        race('Half-Elf', 'Semielfo', 'semielfos'),
        race('Half-Orc', 'Semiorco', 'semiorcos'),
        race('Tiefling', 'Tiefling', 'tieflings')
      ]
    },
    { pages: { en: [60, 61], es: [61, 62] }, items: [o('trasfondo', 'Acolyte', 'Acólito')] },
    { pages: { en: [75, 75], es: [78, 78] }, items: [o('dote', 'Grappler', 'Apresador')] }
  ],
  '2024': [
    {
      pages: { en: [83, 86], es: [89, 93] },
      items: [
        o('trasfondo', 'Acolyte', 'Acólito'),
        o('trasfondo', 'Criminal', 'Criminal'),
        o('trasfondo', 'Sage', 'Erudito'),
        o('trasfondo', 'Soldier', 'Soldado'),
        o('especie', 'Dragonborn', 'Dracónido'),
        o('especie', 'Dwarf', 'Enano'),
        o('especie', 'Elf', 'Elfo'),
        o('especie', 'Gnome', 'Gnomo'),
        o('especie', 'Goliath', 'Goliat'),
        o('especie', 'Halfling', 'Mediano'),
        o('especie', 'Human', 'Humano'),
        o('especie', 'Orc', 'Orco'),
        o('especie', 'Tiefling', 'Tiefling')
      ]
    },
    {
      pages: { en: [87, 88], es: [94, 96] },
      items: [
        o('dote', 'Alert', 'Alerta'),
        o('dote', 'Magic Initiate', 'Iniciado en la magia'),
        o('dote', 'Savage Attacker', 'Atacante salvaje'),
        o('dote', 'Skilled', 'Habilidoso'),
        o('dote', 'Ability Score Improvement', 'Mejora de característica'),
        o('dote', 'Grappler', 'Apresador'),
        o('dote', 'Archery', 'Tiro con arco'),
        o('dote', 'Defense', 'Defensa'),
        o('dote', 'Great Weapon Fighting', 'Combate con armas a dos manos'),
        o('dote', 'Two-Weapon Fighting', 'Combate con dos armas'),
        o('dote', 'Boon of Combat Prowess', 'Don de la pericia en combate'),
        o('dote', 'Boon of Dimensional Travel', 'Don del viaje dimensional'),
        o('dote', 'Boon of Fate', 'Don del destino'),
        o('dote', 'Boon of Irresistible Offense', 'Don del ataque imparable'),
        o('dote', 'Boon of Spell Recall', 'Don del recuerdo de conjuros'),
        o('dote', 'Boon of the Night Spirit', 'Don del espíritu de la noche'),
        o('dote', 'Boon of Truesight', 'Don de la visión verdadera')
      ]
    }
  ]
}

/** Las líneas de cabecera (2024): «Size: Medium», «Skill Proficiencies: …», «Origin Feat» o «General Feat (…)» */
/** La categoría de una dote de 2024 («General Feat (Prerequisite: Level 4+)», «Dote general (requisito: …)») */
const FEAT_LINE = /^((?:Origin|General|Fighting Style|Epic Boon) Feat|Dote (?:de|del|general))/
const HEADER =
  /^(Creature Type|Size|Speed|Ability Scores|Feat|Skill Proficiencies|Tool Proficiency|Equipment|Tipo de criatura|Tamaño|Velocidad|Puntuaciones de característica|Dote|Competencias en habilidades|Competencia con herramientas|Equipo)\s*:/

export interface OriginText {
  name: string
  /** Lo de su cabecera, por su etiqueta («Size», «Feat»), y su categoría de dote («General Feat (Prerequisite: …)») */
  header: Record<string, string>
  category: string
  text: string
  page: number
}

/** Lo de una edición en un idioma, por su nombre (el de la lista), con su texto */
export function originTexts(edition: Edition, lang: Lang): Map<string, OriginText> {
  const profile = PROFILES[edition][lang]
  const out = new Map<string, OriginText>()
  for (const group of ORIGINS[edition]) {
    const rows = ruleRows(edition, lang, range(...group.pages[lang]), profile.caps)
    const bases = basesOf(rows, profile.text)
    const names = new Map(group.items.map((it) => [(it.heading ?? it)[lang], it[lang]]))
    // Los títulos de las secciones y los apartados también cortan (lo de ahí no es de nadie)
    const cuts = new Set([...profile.chapter, ...profile.section, ...(profile.text.headings[0] ?? [])])
    for (const entry of cut(rows, (r) => names.has(r.text) || cuts.has(r.h))) {
      const name = names.get(entry.name)
      if (!name || out.has(name)) continue
      const header: Record<string, string> = {}
      let category = ''
      let label: string | null = null
      let i = 0
      for (; i < entry.rows.length; i++) {
        const row = entry.rows[i] as Row
        const open = (category.match(/\(/g)?.length ?? 0) > (category.match(/\)/g)?.length ?? 0)
        if (open) {
          category = joinLine(category, row.text)
          continue
        }
        if (!category && !label && FEAT_LINE.test(row.text)) {
          category = row.text
          continue
        }
        const found = HEADER.exec(row.text)
        if (found) {
          label = found[1] as string
          header[label] = row.text.replace(HEADER, '').trim()
          continue
        }
        // Lo que sigue a una línea de la cabecera (más pequeña que el texto) es de ella
        if (label && !profile.text.body.includes(row.h)) {
          header[label] = joinLine(header[label] ?? '', row.text)
          continue
        }
        break
      }
      out.set(name, {
        name,
        header,
        category,
        text: textOf(entry.rows.slice(i), { bases, profile: profile.text }),
        page: entry.page
      })
    }
  }
  return out
}

/**
 * Los rasgos de un texto: los párrafos que empiezan con su nombre («Darkvision. You can see…»), de pocas palabras, sin
 * comas ni paréntesis (lo que no, es una frase o una opción de un rasgo)
 */
export function traitsOf(text: string): { name: string; text: string }[] {
  return text
    .split('\n\n')
    .map((p) => /^([A-ZÁÉÍÓÚÑ][^.\n,(]{1,50})\. ([\s\S]+)$/.exec(p))
    .filter((m): m is RegExpExecArray => m !== null && (m[1] as string).split(' ').length <= 5)
    .map((m) => ({ name: m[1] as string, text: m[2] as string }))
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Los rasgos en los dos idiomas: por la lista revisada y, los demás, por su orden (si son los mismos) */
export function pairTraits(
  en: readonly { name: string; text: string }[],
  es: readonly { name: string; text: string }[],
  pairs: Record<string, string> = TRAIT_PAIRS
): [{ name: string; text: string }, { name: string; text: string }][] {
  const left = [...es]
  const out = new Map<string, { name: string; text: string }>()
  for (const trait of en) {
    const wanted = pairs[trait.name]
    const i = wanted ? left.findIndex((e) => fold(e.name) === fold(wanted)) : -1
    if (i >= 0) out.set(trait.name, left.splice(i, 1)[0] as { name: string; text: string })
  }
  const rest = en.filter((trait) => !out.has(trait.name))
  if (rest.length > 0 && rest.length === left.length)
    rest.forEach((trait, i) => {
      out.set(trait.name, left[i] as { name: string; text: string })
    })
  else if (rest.length > 0)
    throw new Error(`Rasgos sin pareja: ${rest.map((r) => r.name).join(', ')} | ${left.map((r) => r.name).join(', ')}`)
  return en.map((trait) => [trait, out.get(trait.name) as { name: string; text: string }])
}

const ABILITY: Record<string, string> = Object.fromEntries(ABILITIES.map(([key, , en]) => [en.toLowerCase(), key]))
const SKILL: Record<string, string> = Object.fromEntries(SKILLS.map(([key, , en]) => [en.toLowerCase(), key]))
const DAMAGE: Record<string, string> = Object.fromEntries(DAMAGE_TYPES.map(([key, , en]) => [en.toLowerCase(), key]))

type Mechanics = Record<string, unknown>

/** Lo que hace un rasgo (en inglés), si sale claro de su texto: características, velocidad, resistencias y habilidades */
export function traitMechanics(text: string): Mechanics {
  const effects: Record<string, unknown>[] = []
  const grants: Record<string, unknown>[] = []
  // «Your Constitution score increases by 2»; «Your ability scores each increase by 1»
  for (const m of text.matchAll(
    /Your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score increases by (\d)/g
  ))
    effects.push({
      target: `caracteristicas.${ABILITY[(m[1] as string).toLowerCase()]}.puntuacion`,
      op: 'add',
      value: m[2]
    })
  if (/Your ability scores each increase by 1/.test(text))
    for (const [key] of ABILITIES) effects.push({ target: `caracteristicas.${key}.puntuacion`, op: 'add', value: '1' })
  // «two other ability scores of your choice increase by 1»
  const choice = /(two|one) (?:other )?ability scores? of your choice increases? by 1/i.exec(text)
  if (choice)
    grants.push({
      choose: {
        key: 'caracteristicas',
        label: t('Características', 'Ability scores'),
        count: choice[1] === 'two' ? '2' : '1',
        set: 'caracteristicas',
        field: 'puntuacion',
        op: 'add',
        value: '1'
      }
    })
  // «Your hit point maximum increases by 1, and it increases by 1 every time you gain a level» (la dureza enana)
  if (
    /hit point maximum increases by 1,? and it increases by 1 (?:again )?(?:every time|whenever) you gain a level/i.test(
      text
    )
  )
    effects.push({ target: 'pg_max', op: 'add', value: '@nivel' })
  const speed = /Your base walking speed is (\d+) feet/.exec(text)
  if (speed) effects.push({ target: 'velocidad', op: 'base', value: speed[1] })
  for (const m of text.matchAll(/(?:have|has) resistance (?:to|against) (\w+) damage/gi)) {
    const type = DAMAGE[(m[1] as string).toLowerCase()]
    if (type) effects.push({ target: 'resistencias', op: 'append', value: `"${type}"` })
  }
  // «You have proficiency in the Perception skill»
  for (const m of text.matchAll(/proficiency in the (\w+(?: \w+)?) skill/gi)) {
    const key = SKILL[(m[1] as string).toLowerCase()]
    if (key) effects.push({ target: `habilidades.${key}.grado`, op: 'min', value: '1' })
  }
  if (effects.length === 0 && grants.length === 0) return { automation: 'text' }
  return { ...(effects.length > 0 ? { effects } : {}), ...(grants.length > 0 ? { grants } : {}), automation: 'partial' }
}

/** Lo que hace una dote (por su nombre en inglés), escrito a mano donde es claro */
const FEAT_MECHANICS: Record<string, Mechanics> = {
  Alert: { effects: [{ target: 'bono_iniciativa', op: 'add', value: '@competencia' }], automation: 'partial' },
  Archery: { effects: [{ target: 'bono_ataque_distancia', op: 'add', value: '2' }], automation: 'full' },
  Defense: { effects: [{ target: 'ca', op: 'add', value: '1', when: '@con_armadura' }], automation: 'full' },
  Skilled: {
    grants: [
      {
        choose: {
          key: 'habilidades',
          label: t('Habilidades', 'Skills'),
          count: '3',
          set: 'habilidades'
        }
      }
    ],
    automation: 'partial'
  }
}

/** Las habilidades de un trasfondo: «Insight and Religion», «Insight, Religion» */
export function skillsOf(text: string | undefined): string[] {
  return [...(text ?? '').matchAll(/[A-Z][a-z]+(?: (?:of|[A-Z])[a-z]*)*/g)]
    .map((m) => SKILL[m[0].toLowerCase()])
    .filter((k): k is string => Boolean(k))
}

/** Los documentos de una edición: cada especie, trasfondo y dote, y los rasgos que conceden */
export function originDocs(
  edition: Edition,
  en: ReadonlyMap<string, OriginText>,
  es: ReadonlyMap<string, OriginText>,
  conceptOf: (item: Origin) => string,
  featConcepts: ReadonlyMap<string, string> = new Map()
): Doc[] {
  const docs: Doc[] = []
  const items = ORIGINS[edition].flatMap((g) => g.items)
  for (const item of items) {
    const a = en.get(item.en)
    const b = es.get(item.es)
    if (!a || !b) throw new Error(`Falta «${item.en}» / «${item.es}» de ${edition}`)
    const concept = conceptOf(item)
    const ref = { pages: { en: a.page, es: b.page } }
    const grants: Record<string, unknown>[] = []
    const effects: Record<string, unknown>[] = []
    // Sus rasgos (los de una especie): en los dos idiomas por su orden, si cuadran
    const traitsEn = item.type === 'especie' ? traitsOf(a.text) : []
    const traitsEs = item.type === 'especie' ? traitsOf(b.text) : []
    if (traitsEn.length > 0)
      pairTraits(traitsEn, traitsEs).forEach(([trait, other]) => {
        const key = `${concept}_${slug(other.name)}`.slice(0, 50)
        grants.push({ concept: key, type: 'rasgo' })
        docs.push({
          type: 'rasgo',
          key: `${key}_${edition}`,
          source: SOURCE[edition],
          concept: key,
          data: {
            name: t(other.name, trait.name),
            procedencia: t(item.es, item.en),
            nivel: 0,
            descripcion: t(other.text, trait.text)
          },
          mechanics: traitMechanics(trait.text),
          ref
        })
      })
    if (item.parent)
      grants.push({ concept: conceptOf(items.find((p) => p.en === item.parent) as Origin), type: 'especie' })
    // En 2024, la velocidad va en la cabecera; las habilidades y la dote de un trasfondo, también
    const speed = /(\d+) feet/.exec(a.header.Speed ?? '')
    if (speed) effects.push({ target: 'velocidad', op: 'base', value: speed[1] })
    for (const skill of skillsOf(a.header['Skill Proficiencies'] ?? /Skill Proficiencies: ([^\n]*)/.exec(a.text)?.[1]))
      effects.push({ target: `habilidades.${skill}.grado`, op: 'min', value: '1' })
    const feat = /^([A-Z][A-Za-z ]+?)(?: \(|$)/.exec(a.header.Feat ?? '')?.[1]
    const featConcept = feat ? featConcepts.get(feat) : undefined
    if (featConcept) grants.push({ concept: featConcept, type: 'dote' })
    const base =
      item.type === 'dote'
        ? (FEAT_MECHANICS[item.en] ?? { automation: 'text' })
        : effects.length > 0 || grants.length > 0
          ? {
              ...(effects.length > 0 ? { effects } : {}),
              ...(grants.length > 0 ? { grants } : {}),
              automation: 'partial'
            }
          : { automation: 'text' }
    const size = /\b(Small|Medium)\b/.exec(a.header.Size ?? a.text)?.[1]
    const prerequisite = /\(Prerequisite: ([^)]*)\)/.exec(a.category)?.[1]
    const prerequisiteEs = /\(requisitos?: ([^)]*)\)/i.exec(b.category)?.[1]
    docs.push({
      type: item.type,
      key: `${concept}_${edition}`,
      source: SOURCE[edition],
      concept,
      data: {
        name: t(item.es, item.en),
        ...(item.type === 'especie' && size ? { tamano: size === 'Small' ? 'pequena' : 'mediana' } : {}),
        ...(item.type === 'dote'
          ? {
              categoria: t(b.category.replace(/\s*\(.*$/, ''), a.category.replace(/\s*\(.*$/, '')),
              ...(prerequisite ? { requisito: t(prerequisiteEs ?? prerequisite, prerequisite) } : {}),
              repetible: /Repeatable\./.test(a.text)
            }
          : {}),
        descripcion: t(withHeader(b), withHeader(a))
      },
      mechanics: base,
      ref
    })
  }
  return docs
}

/** Su texto con su cabecera delante (lo de 2024: tamaño, velocidad, habilidades…) */
const withHeader = (o: OriginText) =>
  [...(o.category ? [`*${o.category}*`] : []), ...Object.entries(o.header).map(([k, v]) => `**${k}:** ${v}`), o.text]
    .filter(Boolean)
    .join('\n\n')

/** Las especies, los trasfondos y las dotes de las dos ediciones; lo que está en las dos comparte concepto */
export function allOriginDocs(taken: ReadonlySet<string> = new Set()): Doc[] {
  // El concepto, por el nombre en español de 2024 (o el suyo); el que ya es de otro tipo, con su tipo delante
  const newest = new Map(ORIGINS['2024'].flatMap((g) => g.items).map((it) => [`${it.type}:${it.en}`, it.es]))
  const conceptOf = (item: Origin) => {
    const base = slug(newest.get(`${item.type}:${item.en}`) ?? item.es)
    return taken.has(base) ? `${item.type}_${base}` : base
  }
  const feats = new Map(
    ORIGINS['2024']
      .flatMap((g) => g.items)
      .filter((it) => it.type === 'dote')
      .map((it) => [it.en, conceptOf(it)])
  )
  return (['2014', '2024'] as const).flatMap((edition) => {
    const en = originTexts(edition, 'en')
    const es = originTexts(edition, 'es')
    if (edition === '2024') {
      mergeSplitTables(en, 'en')
      mergeSplitTables(es, 'es')
    }
    return originDocs(edition, en, es, conceptOf, feats)
  })
}

/** Las tablas partidas en dos mitades de las especies de 2024: su título y de quién son, por su primera cabecera */
const SPLIT_TABLES: { left: RegExp; owner: { en: string; es: string }; title: { en: string; es: string } }[] = [
  {
    left: /^\| (Lineage|Linaje) \|/,
    owner: { en: 'Elf', es: 'Elfo' },
    title: { en: 'Elven Lineages', es: 'Linajes élficos' }
  },
  {
    left: /^\| (Legacy|Legado) \|/,
    owner: { en: 'Tiefling', es: 'Tiefling' },
    title: { en: 'Fiendish Legacies', es: 'Legados infernales' }
  }
]
const RIGHT_HALF = /^\| (Level|Nivel) 3 \|/
const SPLIT_TITLE = /^\*\*(Elven Lineages|Fiendish Legacies|Linajes élficos|Legados infernales)\*\*$/

/**
 * Las tablas de linajes élficos y legados infernales de 2024 van partidas en dos mitades (columnas) que la maquetación
 * deja en especies vecinas: se quitan de donde caigan y se juntan, fila a fila, en su especie (las mitades derechas, en
 * su orden de lectura: la primera es la de los elfos)
 */
export function mergeSplitTables(texts: Map<string, OriginText>, lang: Lang): void {
  const lefts = new Map<number, string[][]>()
  const rights: string[][][] = []
  const rowsOf = (block: string) =>
    block
      .split('\n')
      .filter((_, i) => i !== 1)
      .map((l) => l.replace(/^\| | \|$/g, '').split(' | '))
  for (const [name, entry] of texts) {
    const kept = entry.text.split('\n\n').filter((block) => {
      if (SPLIT_TITLE.test(block)) return false
      const owner = SPLIT_TABLES.findIndex((table) => table.left.test(block))
      if (owner >= 0) {
        lefts.set(owner, rowsOf(block))
        return false
      }
      if (RIGHT_HALF.test(block)) {
        rights.push(rowsOf(block))
        return false
      }
      return true
    })
    texts.set(name, { ...entry, text: kept.join('\n\n') })
  }
  SPLIT_TABLES.forEach((table, i) => {
    const left = lefts.get(i)
    const owner = texts.get(table.owner[lang])
    if (!left || !owner) return
    const right = rights[i] ?? []
    const [head = [], ...body] = left.map((row, j) => [...row, ...(right[j] ?? [])])
    const markdown = [
      `| ${head.join(' | ')} |`,
      `| ${head.map(() => '---').join(' | ')} |`,
      ...body.map((r) => `| ${r.join(' | ')} |`)
    ]
    texts.set(table.owner[lang], {
      ...owner,
      text: `${owner.text}\n\n**${table.title[lang]}**\n\n${markdown.join('\n')}`
    })
  })
}
