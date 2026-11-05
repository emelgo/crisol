/**
 * Las clases de los dos SRD (todas menos el guerrero, que va en `guerrero.ts`): sus rasgos y los de su subclase salen
 * solos del PDF (su título, su nivel y su texto); sus datos (dado de golpe, salvaciones, competencias, habilidades y
 * lanzamiento de conjuros) y la mecánica de los rasgos clave (la furia, la defensa sin armadura, los recursos de cada
 * clase) van escritos a mano aquí
 */
import { SKILLS } from '../../packages/systems/src/catalog/5e/system.ts'
import { PROFILES, range } from './capitulos.ts'
import type { Doc } from './equipo.ts'
import { likeness } from './magicos.ts'
import { basesOf, cut, ruleRows, textOf } from './reglas.ts'
import { type Edition, type Lang, type Row, SOURCE, slug } from './texto.ts'

const t = (es: string, en: string) => ({ es, en })

type Caster = 'full' | 'half' | 'pact' | null

export interface ClassSpec {
  concept: string
  name: { es: string; en: string }
  /** Dónde está cada edición, en cada idioma, y el nombre de la clase que la sigue (donde para) */
  pages: Record<Edition, Record<Lang, [number, number, string]>>
  dado: number
  saves: [string, string]
  armor: string[]
  weapons: string[]
  skills: { count: number; from: string[] }
  /** La característica para lanzar conjuros y cuánto suma al nivel de lanzador */
  spellcasting: { ability: string; caster: Caster } | null
}

const spec = (
  concept: string,
  name: { es: string; en: string },
  pages: ClassSpec['pages'],
  rest: Omit<ClassSpec, 'concept' | 'name' | 'pages'>
): ClassSpec => ({ concept, name, pages, ...rest })

const ALL_SKILLS = [
  'acrobacias',
  'atletismo',
  'conocimiento_arcano',
  'engano',
  'historia',
  'interpretacion',
  'intimidacion',
  'investigacion',
  'juego_de_manos',
  'medicina',
  'naturaleza',
  'percepcion',
  'perspicacia',
  'persuasion',
  'religion',
  'sigilo',
  'supervivencia',
  'trato_con_animales'
]

export const CLASSES: ClassSpec[] = [
  spec(
    'barbaro',
    t('Bárbaro', 'Barbarian'),
    {
      '2014': { en: [8, 11, 'Bard'], es: [8, 11, 'Bardo'] },
      '2024': { en: [28, 31, 'Bard'], es: [32, 35, 'Bardo'] }
    },
    {
      dado: 12,
      saves: ['fue', 'con'],
      armor: ['ligera', 'media', 'escudo'],
      weapons: ['sencilla', 'marcial'],
      skills: {
        count: 2,
        from: ['trato_con_animales', 'atletismo', 'intimidacion', 'naturaleza', 'percepcion', 'supervivencia']
      },
      spellcasting: null
    }
  ),
  spec(
    'bardo',
    t('Bardo', 'Bard'),
    {
      '2014': { en: [11, 15, 'Cleric'], es: [11, 15, 'Brujo'] },
      '2024': { en: [31, 36, 'Cleric'], es: [35, 40, 'Brujo'] }
    },
    {
      dado: 8,
      saves: ['des', 'car'],
      armor: ['ligera'],
      weapons: ['sencilla'],
      skills: { count: 3, from: ALL_SKILLS },
      spellcasting: { ability: 'car', caster: 'full' }
    }
  ),
  spec(
    'clerigo',
    t('Clérigo', 'Cleric'),
    {
      '2014': { en: [15, 19, 'Druid'], es: [21, 25, 'Druida'] },
      '2024': { en: [36, 41, 'Druid'], es: [47, 52, 'Druida'] }
    },
    {
      dado: 8,
      saves: ['sab', 'car'],
      armor: ['ligera', 'media', 'escudo'],
      weapons: ['sencilla'],
      skills: { count: 2, from: ['historia', 'perspicacia', 'medicina', 'persuasion', 'religion'] },
      spellcasting: { ability: 'sab', caster: 'full' }
    }
  ),
  spec(
    'druida',
    t('Druida', 'Druid'),
    {
      '2014': { en: [19, 24, 'Fighter'], es: [25, 30, 'Explorador'] },
      '2024': { en: [41, 47, 'Fighter'], es: [52, 58, 'Explorador'] }
    },
    {
      dado: 8,
      saves: ['int', 'sab'],
      armor: ['ligera', 'media', 'escudo'],
      weapons: ['sencilla'],
      skills: {
        count: 2,
        from: [
          'conocimiento_arcano',
          'trato_con_animales',
          'perspicacia',
          'medicina',
          'naturaleza',
          'percepcion',
          'religion',
          'supervivencia'
        ]
      },
      spellcasting: { ability: 'sab', caster: 'full' }
    }
  ),
  spec(
    'monje',
    t('Monje', 'Monk'),
    {
      '2014': { en: [26, 30, 'Paladin'], es: [44, 48, 'Paladín'] },
      '2024': { en: [49, 53, 'Paladin'], es: [77, 81, 'Paladín'] }
    },
    {
      dado: 8,
      saves: ['fue', 'des'],
      armor: [],
      weapons: ['sencilla'],
      skills: { count: 2, from: ['acrobacias', 'atletismo', 'historia', 'perspicacia', 'religion', 'sigilo'] },
      spellcasting: null
    }
  ),
  spec(
    'paladin',
    t('Paladín', 'Paladin'),
    {
      '2014': { en: [30, 35, 'Ranger'], es: [48, 53, 'Pícaro'] },
      '2024': { en: [53, 57, 'Ranger'], es: [81, 86, 'Pícaro'] }
    },
    {
      dado: 10,
      saves: ['sab', 'car'],
      armor: ['ligera', 'media', 'pesada', 'escudo'],
      weapons: ['sencilla', 'marcial'],
      skills: { count: 2, from: ['atletismo', 'perspicacia', 'intimidacion', 'medicina', 'persuasion', 'religion'] },
      spellcasting: { ability: 'car', caster: 'half' }
    }
  ),
  spec(
    'explorador',
    t('Explorador', 'Ranger'),
    {
      '2014': { en: [35, 39, 'Rogue'], es: [30, 34, 'Guerrero'] },
      '2024': { en: [57, 61, 'Rogue'], es: [58, 62, 'Guerrero'] }
    },
    {
      dado: 10,
      saves: ['fue', 'des'],
      armor: ['ligera', 'media', 'escudo'],
      weapons: ['sencilla', 'marcial'],
      skills: {
        count: 3,
        from: [
          'trato_con_animales',
          'atletismo',
          'perspicacia',
          'investigacion',
          'naturaleza',
          'percepcion',
          'sigilo',
          'supervivencia'
        ]
      },
      spellcasting: { ability: 'sab', caster: 'half' }
    }
  ),
  spec(
    'picaro',
    t('Pícaro', 'Rogue'),
    {
      '2014': { en: [39, 42, 'Sorcerer'], es: [53, 56, 'Más allá del nivel 1'] },
      '2024': { en: [61, 64, 'Sorcerer'], es: [86, 89, 'Orígenes'] }
    },
    {
      dado: 8,
      saves: ['des', 'int'],
      armor: ['ligera'],
      weapons: ['sencilla'],
      skills: {
        count: 4,
        from: [
          'acrobacias',
          'atletismo',
          'engano',
          'perspicacia',
          'intimidacion',
          'investigacion',
          'percepcion',
          'interpretacion',
          'persuasion',
          'juego_de_manos',
          'sigilo'
        ]
      },
      spellcasting: null
    }
  ),
  spec(
    'hechicero',
    t('Hechicero', 'Sorcerer'),
    {
      '2014': { en: [42, 46, 'Warlock'], es: [36, 40, 'Mago'] },
      '2024': { en: [64, 70, 'Warlock'], es: [64, 71, 'Mago'] }
    },
    {
      dado: 6,
      saves: ['con', 'car'],
      armor: [],
      weapons: ['sencilla'],
      skills: {
        count: 2,
        from: ['conocimiento_arcano', 'engano', 'perspicacia', 'intimidacion', 'persuasion', 'religion']
      },
      spellcasting: { ability: 'car', caster: 'full' }
    }
  ),
  spec(
    'brujo',
    t('Brujo', 'Warlock'),
    {
      '2014': { en: [46, 52, 'Wizard'], es: [15, 21, 'Clérigo'] },
      '2024': { en: [70, 77, 'Wizard'], es: [40, 47, 'Clérigo'] }
    },
    {
      dado: 8,
      saves: ['sab', 'car'],
      armor: ['ligera'],
      weapons: ['sencilla'],
      skills: {
        count: 2,
        from: ['conocimiento_arcano', 'engano', 'historia', 'intimidacion', 'investigacion', 'naturaleza', 'religion']
      },
      spellcasting: { ability: 'car', caster: 'pact' }
    }
  ),
  spec(
    'mago',
    t('Mago', 'Wizard'),
    {
      '2014': { en: [52, 56, 'Beyond 1st Level'], es: [40, 44, 'Monje'] },
      '2024': { en: [77, 83, 'Character Origins'], es: [71, 77, 'Monje'] }
    },
    {
      dado: 6,
      saves: ['int', 'sab'],
      armor: [],
      weapons: ['sencilla'],
      skills: {
        count: 2,
        from: ['conocimiento_arcano', 'historia', 'perspicacia', 'investigacion', 'medicina', 'naturaleza', 'religion']
      },
      spellcasting: { ability: 'int', caster: 'full' }
    }
  )
]

/** El alto de los títulos de cada PDF: la clase, sus rasgos, los de su subclase y los apartados de 2024 */
const HEIGHTS: Record<Edition, Record<Lang, { klass: number; feature: number; sub: number; section: number }>> = {
  '2014': {
    en: { klass: 30.9, feature: 16.6, sub: 14.3, section: 0 },
    es: { klass: 34.8, feature: 18.8, sub: 16.1, section: 0 }
  },
  '2024': {
    en: { klass: 21.5, feature: 14.3, sub: 14.3, section: 16.7 },
    es: { klass: 21.5, feature: 14.3, sub: 14.3, section: 16.7 }
  }
}

export interface FeatureText {
  name: string
  level: number | null
  text: string
  page: number
}

export interface ClassText {
  features: FeatureText[]
  /** Los apartados aparte de 2024 (las listas de conjuros, las invocaciones), como rasgos sin nivel */
  extras: FeatureText[]
  subclass: { name: string; text: string; page: number; features: FeatureText[] }
}

/** El nivel de un rasgo de 2014, por su texto en inglés («At 3rd level», «Starting at 6th level») */
export function levelOf(text: string): number | null {
  const m =
    /(?:at|by|reach|beginning at|starting at|starting when you choose[^,]* at) (\d+)(?:st|nd|rd|th) level/i.exec(
      text.slice(0, 300)
    )
  return m ? Number(m[1]) : null
}

/** Los otros niveles en los que se vuelve a obtener («and again at 8th, 12th, 16th, and 19th level») */
export function alsoOf(text: string): number[] {
  const m = /and again at ([^.]*?) level/i.exec(text.slice(0, 300))
  return m ? [...(m[1] as string).matchAll(/(\d+)(?:st|nd|rd|th)/g)].map((x) => Number(x[1])) : []
}

/** Una línea que solo es una lista de habilidades (lo que sigue de «Skills: Choose two from…», partido) */
const SKILL_NAMES = SKILLS.flatMap(([, es, en]) => [es, en]).join('|')
const SKILL_LIST = new RegExp(`^(and |y )?((${SKILL_NAMES})(, and |, y |, | and | y )?)+\\.?$`, 'i')

/** Lo de la introducción de una clase (sus PG, sus competencias, su equipo), que ya va en sus datos */
const INTRO_HEADING = /^#### (Hit Points|Proficiencies|Equipment|Puntos de golpe|Competencias|Equipo)$/
const INTRO_LABEL =
  /^(Hit Dice|Hit Points at|Armor|Weapons|Tools|Saving Throws|Skills|Dados de golpe|Puntos de golpe a nivel|Armaduras?|Armas|Herramientas|Tiradas de salvación|Habilidades):/
const INTRO_TEXT =
  /^(You start with the following equipment|Empiezas con el siguiente equipo|Además del que obtengas por tu trasfondo|- \(?[a-c]\))/i

/**
 * El texto de un rasgo de 2014 sin lo de la introducción de su clase ni su tabla, que el orden de lectura mezcla con el
 * primer rasgo (van en la columna de al lado)
 */
export function withoutIntro(text: string): string {
  let intro = false
  let label = false
  return text
    .split('\n\n')
    .filter((block) => {
      if (INTRO_HEADING.test(block)) {
        intro = true
        return false
      }
      // Una etiqueta («Skills: Choose two from…») y lo que sigue de ella, partido en otra línea
      if (INTRO_LABEL.test(block)) {
        label = true
        return false
      }
      if (SKILL_LIST.test(block)) return false
      // (una lista corta: «Persuasion, and Religion», «Perspicacia, Persuasión y Religión.»)
      const rest = label && block.length < 80 && /,/.test(block) && !/\b(you|can|tu|puedes)\b/i.test(block)
      label = false
      if (rest) return false
      if (intro && INTRO_TEXT.test(block)) return false
      intro = false
      return true
    })
    .join('\n\n')
}

/** Los rasgos de una clase en una edición e idioma, con los de su subclase */
export function classTexts(klass: ClassSpec, edition: Edition, lang: Lang): ClassText {
  const [from, to, next] = klass.pages[edition][lang]
  const profile = PROFILES[edition][lang]
  const h = HEIGHTS[edition][lang]
  const all = ruleRows(edition, lang, range(from, to), profile.caps)
  // Desde el título de la clase hasta el de la siguiente
  const start = all.findIndex((r) => r.h === h.klass && r.text === klass.name[lang])
  const end = all.findIndex((r, i) => i > start && r.h === h.klass && r.text.startsWith(next))
  const rows = all.slice(start + 1, end < 0 ? undefined : end)
  const bases = basesOf(rows, profile.text)
  // La tabla de la clase («The Bard», «Barbarian Features») va en la columna de al lado o en la página entera: sus filas no
  // van en ningún rasgo (lo que dice ya va en sus datos y su mecánica)
  const dropTables =
    edition === '2024'
      ? /^(.+ Features|Rasgos de .+)$/
      : new RegExp(`^(The ${klass.name.en}|(El|La) ${klass.name.es.toLowerCase()})$`)
  const text = (own: readonly Row[]) => withoutIntro(textOf(own, { bases, profile: profile.text, dropTables }))
  if (edition === '2014') {
    const features = cut(rows, (r) => r.h === h.feature)
    const subclass = features.at(-1)
    if (!subclass) throw new Error(`${klass.name.en} ${edition} ${lang}: sin rasgos`)
    const own = cut(subclass.rows, (r) => r.h === h.sub)
    const intro = subclass.rows.slice(
      0,
      subclass.rows.findIndex((r) => r.h === h.sub)
    )
    return {
      features: features.slice(0, -1).map((f) => ({ name: f.name, level: null, text: text(f.rows), page: f.page })),
      extras: [],
      subclass: {
        name: subclass.name,
        text: text(intro),
        page: subclass.page,
        features: own.map((f) => ({ name: f.name, level: null, text: text(f.rows), page: f.page }))
      }
    }
  }
  // 2024: «Level 3: Frenzy» y la subclase, «Barbarian Subclass: Path of the Berserker»
  const LEVEL = /^(?:Level|Nivel) (\d+): (.+)$/
  const entries = cut(rows, (r) => r.h === h.feature || r.h === h.section)
  const features: FeatureText[] = []
  const extras: FeatureText[] = []
  let subclass: ClassText['subclass'] | null = null
  let inFeatures = false
  for (const e of entries) {
    const level = LEVEL.exec(e.name)
    const sub = /(?:Subclass|Subclase de [^:]+): (.+)$/.exec(e.name)
    if (e.h === h.section) {
      inFeatures = /Features$|^Rasgos de clase/.test(e.name)
      if (sub) subclass = { name: sub[1] as string, text: text(e.rows), page: e.page, features: [] }
      else if (!inFeatures && features.length > 0 && !subclass && e.rows.length > 0)
        extras.push({ name: e.name, level: null, text: text(e.rows), page: e.page })
      continue
    }
    if (!level) continue
    const f = { name: level[2] as string, level: Number(level[1]), text: text(e.rows), page: e.page }
    if (subclass) subclass.features.push(f)
    else if (inFeatures) features.push(f)
  }
  if (!subclass) throw new Error(`${klass.name.en} ${edition} ${lang}: sin subclase`)
  return { features, extras, subclass }
}

/** Los nombres de los rasgos que comparten varias clases (en 2024), en los dos idiomas */
const FEATURE_NAMES: Record<string, string> = {
  'Ability Score Improvement': 'Mejora de característica',
  'Channel Divinity': 'Canalizar divinidad',
  'Epic Boon': 'Don épico',
  Evasion: 'Evasión',
  Expertise: 'Pericia',
  'Extra Attack': 'Ataque adicional',
  'Fast Movement': 'Movimiento rápido',
  'Favored Enemy': 'Enemigo predilecto',
  'Fighting Style': 'Estilo de combate',
  'Sneak Attack': 'Ataque furtivo',
  Spellcasting: 'Lanzamiento de conjuros',
  'Unarmored Defense': 'Defensa sin armadura',
  'Weapon Mastery': 'Maestría con armas'
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Los rasgos en los dos idiomas: en 2014, por su orden; en 2024, dentro de cada nivel, por su parecido */
export function pairFeatures(edition: Edition, en: FeatureText[], es: FeatureText[]): [FeatureText, FeatureText][] {
  if (en.length !== es.length)
    throw new Error(
      `${en.length} rasgos en inglés y ${es.length} en español: ${en.map((f) => f.name).join(', ')} | ${es.map((f) => f.name).join(', ')}`
    )
  if (edition === '2014') return en.map((f, i) => [f, es[i] as FeatureText])
  const out: [FeatureText, FeatureText][] = []
  const levels = [...new Set(en.map((f) => f.level))]
  for (const level of levels) {
    const a = en.filter((f) => f.level === level)
    const b = es.filter((f) => f.level === level)
    if (a.length !== b.length)
      throw new Error(`Nivel ${level}: ${a.map((f) => f.name).join(', ')} | ${b.map((f) => f.name).join(', ')}`)
    const row = (f: FeatureText) => ({
      name: f.name,
      header: '',
      category: '',
      rarity: null,
      attunement: false,
      text: f.text,
      page: f.page
    })
    const left = [...b]
    // Los nombres comunes a varias clases pesan más que el parecido de su texto
    const named = (x: FeatureText, y: FeatureText) => {
      const wanted = FEATURE_NAMES[x.name]
      return wanted === undefined ? 0 : fold(wanted) === fold(y.name) ? 10 : -10
    }
    const scored = a
      .flatMap((x) => left.map((y) => ({ x, y, score: likeness(row(x), row(y)) + named(x, y) })))
      .sort((p, q) => q.score - p.score)
    const done = new Set<FeatureText>()
    for (const { x, y } of scored) {
      if (done.has(x) || !left.includes(y)) continue
      out.push([x, y])
      done.add(x)
      left.splice(left.indexOf(y), 1)
    }
  }
  return en.map((f) => out.find(([x]) => x === f) as [FeatureText, FeatureText])
}

type Mechanics = Record<string, unknown>
const on = '@este.activo'

/** El nivel de lanzador que suma una clase y su magia de pacto */
function casterEffects(edition: Edition, caster: Caster): Record<string, unknown>[] {
  switch (caster) {
    case 'full':
      return [{ target: 'nivel_lanzador', op: 'add', value: '@este.nivel' }]
    case 'half':
      return [
        {
          target: 'nivel_lanzador',
          op: 'add',
          value:
            edition === '2024'
              ? 'ceil(@este.nivel / 2)'
              : 'count(@clases) > 1 ? floor(@este.nivel / 2) : (@este.nivel >= 2 ? ceil(@este.nivel / 2) : 0)'
        }
      ]
    case 'pact':
      return [
        {
          target: 'pacto_espacios',
          op: 'max',
          value: '@este.nivel >= 17 ? 4 : @este.nivel >= 11 ? 3 : @este.nivel >= 2 ? 2 : 1'
        },
        {
          target: 'pacto_espacios',
          op: 'min',
          value: '@este.nivel >= 17 ? 4 : @este.nivel >= 11 ? 3 : @este.nivel >= 2 ? 2 : 1'
        },
        { target: 'pacto_nivel', op: 'min', value: 'min(5, ceil(@este.nivel / 2))' }
      ]
    default:
      return []
  }
}

/** Lo de la clase: sus salvaciones y competencias (de la primera, todas), sus habilidades, su subclase y su lanzador */
/** Lo que pide cada clase para tomarla como otra (la multiclase): características a 13 */
const MULTICLASS: Record<string, string[][]> = {
  barbaro: [['fue']],
  bardo: [['car']],
  clerigo: [['sab']],
  druida: [['sab']],
  monje: [['des'], ['sab']],
  paladin: [['fue'], ['car']],
  explorador: [['des'], ['sab']],
  picaro: [['des']],
  hechicero: [['car']],
  brujo: [['car']],
  mago: [['int']]
}
const ABILITY_NAMES: Record<string, [string, string]> = {
  fue: ['Fuerza', 'Strength'],
  des: ['Destreza', 'Dexterity'],
  con: ['Constitución', 'Constitution'],
  int: ['Inteligencia', 'Intelligence'],
  sab: ['Sabiduría', 'Wisdom'],
  car: ['Carisma', 'Charisma']
}

/** Sus requisitos de multiclase: cada grupo, una característica a 13 (de las de dentro, cualquiera) */
export function multiclassRequires(concept: string) {
  return (MULTICLASS[concept] ?? []).map((group) => ({
    formula: group.map((a) => `@caracteristicas.${a}.puntuacion >= 13`).join(' || '),
    reason: t(
      `Necesitas ${group.map((a) => `${ABILITY_NAMES[a]?.[0]} 13`).join(' o ')}`,
      `Requires ${group.map((a) => `${ABILITY_NAMES[a]?.[1]} 13`).join(' or ')}`
    )
  }))
}

export function classMechanics(klass: ClassSpec, edition: Edition, subclassLevel: number, subclass: string): Mechanics {
  const first = '@este.inicial'
  return {
    requires: multiclassRequires(klass.concept),
    effects: [
      ...klass.saves.map((s) => ({
        target: `caracteristicas.${s}.salvacion_grado`,
        op: 'min',
        value: '1',
        when: first
      })),
      ...klass.weapons.map((w) => ({ target: 'competencias_armas', op: 'append', value: `"${w}"` })),
      ...klass.armor.map((a) => ({ target: 'competencias_armaduras', op: 'append', value: `"${a}"`, when: first })),
      ...casterEffects(edition, klass.spellcasting?.caster ?? null)
    ],
    grants: [
      {
        choose: {
          key: 'habilidades',
          label: t('Habilidades', 'Skills'),
          count: String(klass.skills.count),
          set: 'habilidades',
          from: klass.skills.from,
          when: first
        }
      },
      {
        level: subclassLevel,
        choose: { key: 'subclase', label: t('Subclase', 'Subclass'), count: '1', type: 'subclase', from: [subclass] }
      }
    ],
    automation: 'partial',
    manual: t(
      'El equipo inicial y los conjuros conocidos se eligen a mano',
      'Starting equipment and known spells are chosen by hand'
    )
  }
}

/** Una tabla por nivel de clase: «@origen.nivel >= 17 ? 6 : …» */
const byLevel = (steps: [number, string][]) =>
  steps
    .slice()
    .sort((a, b) => b[0] - a[0])
    .reduce(
      (acc, [level, value], i, all) =>
        i === all.length - 1 ? `${acc}${value}` : `${acc}@origen.nivel >= ${level} ? ${value} : `,
      ''
    )

/** La mecánica de los rasgos clave, por clase y nombre en inglés (lo demás, su texto) */
export function featureMechanics(klass: string, name: string, edition: Edition): Mechanics | null {
  const key = `${klass}:${name}`
  // La mejora de característica: en 2014, +2 a una o +1 a dos; en 2024, una dote (la de Mejora de característica u otra)
  if (name === 'Ability Score Improvement')
    return edition === '2014'
      ? {
          grants: [
            {
              choose: {
                key: 'mejora',
                label: t('Mejora de característica', 'Ability Score Improvement'),
                count: '2',
                set: 'caracteristicas',
                field: 'puntuacion',
                op: 'add',
                value: '1',
                repeat: true,
                most: 2
              }
            }
          ],
          automation: 'full'
        }
      : {
          grants: [{ choose: { key: 'dote', label: t('Dote', 'Feat'), count: '1', type: 'dote' } }],
          automation: 'partial',
          manual: t('La dote Mejora de característica u otra', 'The Ability Score Improvement feat or another')
        }
  switch (key) {
    case 'barbaro:Rage':
      return {
        resources: [
          {
            key: 'furias',
            label: t('Furias', 'Rages'),
            max:
              edition === '2014'
                ? byLevel([
                    [1, '2'],
                    [3, '3'],
                    [6, '4'],
                    [12, '5'],
                    [17, '6'],
                    [20, '99']
                  ])
                : byLevel([
                    [1, '2'],
                    [3, '3'],
                    [6, '4'],
                    [12, '5'],
                    [17, '6']
                  ]),
            recovery: 'long'
          }
        ],
        toggle: { duration: t('1 minuto', '1 minute') },
        effects: [
          {
            target: 'bono_dano_fue',
            op: 'add',
            value: byLevel([
              [1, '2'],
              [9, '3'],
              [16, '4']
            ]),
            when: on
          },
          { target: 'prueba.fue', op: 'advantage', when: on },
          { target: 'salvacion.fue', op: 'advantage', when: on },
          ...['contundente', 'cortante', 'perforante'].map((d) => ({
            target: 'resistencias',
            op: 'append',
            value: `"${d}"`,
            when: on
          }))
        ],
        automation: 'partial'
      }
    case 'barbaro:Unarmored Defense':
      return {
        effects: [
          {
            target: 'ca',
            op: 'base',
            value: '10 + @caracteristicas.des.mod + @caracteristicas.con.mod',
            when: '!@con_armadura'
          }
        ],
        automation: 'full'
      }
    case 'monje:Unarmored Defense':
      return {
        effects: [
          {
            target: 'ca',
            op: 'base',
            value: '10 + @caracteristicas.des.mod + @caracteristicas.sab.mod',
            when: '!@con_armadura && !@con_escudo'
          }
        ],
        automation: 'full'
      }
    case 'hechicero:Draconic Resilience':
      // CA sin armadura (13 + Des en 2014; 10 + Des + Car en 2024) y 1 PG más por nivel de hechicero
      return {
        effects: [
          {
            target: 'ca',
            op: 'base',
            value:
              edition === '2014'
                ? '13 + @caracteristicas.des.mod'
                : '10 + @caracteristicas.des.mod + @caracteristicas.car.mod',
            when: '!@con_armadura'
          },
          { target: 'pg_max', op: 'add', value: '@origen.nivel' }
        ],
        automation: 'full'
      }
    case 'barbaro:Primal Champion':
      return {
        effects: ['fue', 'con'].map((k) => ({ target: `caracteristicas.${k}.puntuacion`, op: 'add', value: '4' })),
        automation: 'partial',
        manual: t('El máximo de las dos sube a 24 (25 en 2024)', 'Their maximum rises to 24 (25 in 2024)')
      }
    case 'barbaro:Fast Movement':
      return {
        effects: [{ target: 'velocidad', op: 'add', value: '10' }],
        automation: 'partial',
        manual: t('Solo sin armadura pesada', 'Only while not wearing heavy armor')
      }
    case 'monje:Unarmored Movement':
      return {
        effects: [
          {
            target: 'velocidad',
            op: 'add',
            value: byLevel([
              [2, '10'],
              [6, '15'],
              [10, '20'],
              [14, '25'],
              [18, '30']
            ]),
            when: '!@con_armadura && !@con_escudo'
          }
        ],
        automation: 'full'
      }
    case 'barbaro:Extra Attack':
    case 'monje:Extra Attack':
    case 'paladin:Extra Attack':
    case 'explorador:Extra Attack':
      return { effects: [{ target: 'ataques', op: 'min', value: '2' }], automation: 'full' }
    case 'monje:Ki':
    case 'monje:Monk’s Focus':
      return {
        resources: [
          { key: 'ki', label: t('Puntos de concentración', 'Focus points'), max: '@origen.nivel', recovery: 'short' }
        ],
        automation: 'partial'
      }
    case 'hechicero:Font of Magic':
      return {
        resources: [
          {
            key: 'hechiceria',
            label: t('Puntos de hechicería', 'Sorcery points'),
            max: '@origen.nivel',
            recovery: 'long'
          }
        ],
        automation: 'partial'
      }
    case 'bardo:Bardic Inspiration':
      return {
        resources: [
          {
            key: 'inspiracion',
            label: t('Inspiración bárdica', 'Bardic Inspiration'),
            max: 'max(1, @caracteristicas.car.mod)',
            recovery: 'long'
          }
        ],
        automation: 'partial'
      }
    case 'paladin:Lay on Hands':
    case 'paladin:Lay On Hands':
      return {
        resources: [
          {
            key: 'imponer_manos',
            label: t('Imponer las manos', 'Lay on Hands'),
            max: '5 * @origen.nivel',
            recovery: 'long'
          }
        ],
        automation: 'partial'
      }
    case 'picaro:Sneak Attack':
      return {
        actions: [
          {
            key: 'ataque_furtivo',
            label: t('Ataque furtivo', 'Sneak Attack'),
            activation: 'special',
            damage: [{ formula: '1d6' }]
          }
        ],
        scaling: {
          mode: 'level',
          by: '@origen.nivel',
          at: Array.from({ length: 9 }, (_, i) => ({ level: 3 + 2 * i, formula: `${i + 2}d6` }))
        },
        automation: 'partial'
      }
    default:
      return null
  }
}

/** Los documentos de una clase en una edición: ella, su subclase y los rasgos de las dos */
export function classDocsOf(klass: ClassSpec, edition: Edition, en: ClassText, es: ClassText): Doc[] {
  const source = SOURCE[edition]
  const subConcept = slug(es.subclass.name)
  const features = pairFeatures(edition, en.features, es.features)
  const subFeatures = pairFeatures(edition, en.subclass.features, es.subclass.features)
  // En 2014, el nivel de cada rasgo sale de su texto; el de la subclase, del rasgo que la elige
  const levelFor = (f: FeatureText, fallback: number) => f.level ?? levelOf(f.text) ?? fallback
  const choose = features.find(([f]) =>
    /Subclass$|^(Primal Path|Bard College|Divine Domain|Druid Circle|Monastic Tradition|Sacred Oath|Ranger Archetype|Roguish Archetype|Sorcerous Origin|Otherworldly Patron|Arcane Tradition)$/.test(
      f.name
    )
  )
  const subclassLevel = choose ? levelFor(choose[0], 3) : 3
  const used = new Set<string>()
  const doc = (
    f: FeatureText,
    other: FeatureText,
    level: number,
    origin: { es: string; en: string },
    prefix: string
  ): Doc => {
    // Un rasgo que sale dos veces (el golpe brutal mejorado de los niveles 13 y 17), con su nivel
    let key = `${prefix}_${slug(other.name)}`.slice(0, 51)
    if (used.has(key)) key = `${key}_${level}`
    used.add(key)
    return {
      type: 'rasgo',
      key: `${key}_${edition}`,
      source,
      concept: key,
      data: { name: t(other.name, f.name), procedencia: origin, nivel: level, descripcion: t(other.text, f.text) },
      mechanics: featureMechanics(klass.concept, f.name, edition) ?? { automation: 'text' },
      ref: { pages: { en: f.page, es: other.page } }
    }
  }
  // Solo la mejora de característica se vuelve a obtener («and again at 8th, 12th…»)
  const again = (f: FeatureText) => (f.name === 'Ability Score Improvement' && edition === '2014' ? alsoOf(f.text) : [])
  const featureDocs = features.map(([f, other]) => ({
    level: levelFor(f, 1),
    also: again(f),
    doc: doc(f, other, levelFor(f, 1), klass.name, klass.concept)
  }))
  const subDocs = subFeatures.map(([f, other]) => ({
    level: levelFor(f, subclassLevel),
    also: [],
    doc: doc(f, other, levelFor(f, subclassLevel), t(es.subclass.name, en.subclass.name), subConcept)
  }))
  const extras = pairFeatures(edition, en.extras, es.extras).map(([f, other]) =>
    doc(f, other, 0, klass.name, klass.concept)
  )
  const grants = (list: typeof featureDocs) =>
    list.flatMap(({ level, also, doc }) =>
      [level, ...also].map((l) => ({ level: l, concept: doc.concept, type: 'rasgo' }))
    )
  const base = classMechanics(klass, edition, subclassLevel, subConcept)
  return [
    {
      type: 'clase',
      key: `${klass.concept}_${edition}`,
      source,
      concept: klass.concept,
      data: {
        name: klass.name,
        dado: klass.dado,
        dado_golpe: `1d${klass.dado}`,
        lanzamiento: klass.spellcasting?.ability ?? ''
      },
      mechanics: { ...base, grants: [...(base.grants as unknown[]), ...grants(featureDocs)] },
      ref: { pages: { en: klass.pages[edition].en[0], es: klass.pages[edition].es[0] } }
    },
    {
      type: 'subclase',
      key: `${subConcept}_${edition}`,
      source,
      concept: subConcept,
      data: {
        name: t(es.subclass.name, en.subclass.name),
        clase: klass.concept,
        descripcion: t(es.subclass.text, en.subclass.text)
      },
      mechanics: { grants: grants(subDocs), automation: 'full' },
      ref: { pages: { en: en.subclass.page, es: es.subclass.page } }
    },
    ...featureDocs.map((f) => f.doc),
    ...subDocs.map((f) => f.doc),
    ...extras
  ]
}

/** Las once clases de las dos ediciones */
export function allClassDocs(): Doc[] {
  return CLASSES.flatMap((klass) =>
    (['2014', '2024'] as const).flatMap((edition) =>
      classDocsOf(klass, edition, classTexts(klass, edition, 'en'), classTexts(klass, edition, 'es'))
    )
  )
}
