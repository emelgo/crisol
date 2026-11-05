/**
 * Los estados de los dos SRD: en 2014, el apéndice de estados; en 2024, las entradas «[Condition]» del glosario de
 * reglas. Su texto en los dos idiomas y su mecánica, escrita a mano: lo que cambia de quien lo tiene (las tiradas con
 * desventaja, la velocidad a 0); lo que depende de quien ataca o de lo que no se calcula va en `manual`
 */
import { CONDITIONS } from '../../packages/systems/src/catalog/5e/system.ts'
import { glossaryTexts } from './capitulos.ts'
import { readingRows } from './clases.ts'
import type { Doc } from './equipo.ts'
import { basesOf, cut, textOf } from './reglas.ts'
import { type Edition, type Lang, SOURCE } from './texto.ts'

const t = (es: string, en: string) => ({ es, en })

/** Dónde están: en 2014, el apéndice; en 2024, las entradas del glosario */
const CONDITION_PAGES: Record<Lang, number[]> = { en: [358, 359], es: [389, 390] }

/** La etiqueta de un estado en el glosario de 2024 */
const TAG: Record<Lang, string> = { en: ' [Condition]', es: ' [estado]' }

const NAMES: Record<Lang, Set<string>> = {
  en: new Set(CONDITIONS.map(([, , en]) => en)),
  es: new Set(CONDITIONS.map(([, es]) => es))
}

/** Los estados de una edición en un idioma: su nombre, su texto y su página */
export function conditionEntries(edition: Edition, lang: Lang): { name: string; text: string; page: number }[] {
  if (edition === '2014') {
    const rows = readingRows(edition, lang, CONDITION_PAGES[lang])
    const bases = basesOf(rows)
    const tables = /^(Level Effect|Nivel Efecto)$/
    return cut(rows, (r) => NAMES[lang].has(r.text)).map((e) => ({
      name: e.name,
      text: textOf(e.rows, { bases, tables }),
      page: e.page
    }))
  }
  return glossaryTexts(lang)
    .filter((e) => e.name.endsWith(TAG[lang]))
    .map((e) => ({ ...e, name: e.name.slice(0, -TAG[lang].length) }))
}

// La mecánica: solo con el estado activo; lo de las reglas de una edición, con las de la campaña
const on = '@este.activo'
const all = (...conditions: string[]) => [on, ...conditions].join(' && ')
const rules2014 = '@ajustes.reglas == "e2014"'
const rules2024 = '@ajustes.reglas == "e2024"'
const disadvantage = (target: string, ...when: string[]) => ({ target, op: 'disadvantage', when: all(...when) })
const advantage = (target: string, ...when: string[]) => ({ target, op: 'advantage', when: all(...when) })
/** Las pruebas de característica: las de cada una, las de habilidad y la iniciativa (una prueba de Destreza) */
const checks = (...when: string[]) => ['prueba', 'habilidad', 'iniciativa'].map((r) => disadvantage(r, ...when))
const speed0 = { target: 'velocidad', op: 'max', value: '0', when: on }
const DAMAGE_TYPES = [
  'acido',
  'contundente',
  'cortante',
  'frio',
  'fuego',
  'fuerza',
  'necrotico',
  'perforante',
  'psiquico',
  'radiante',
  'relampago',
  'trueno',
  'veneno'
]

/** El cansancio: el nivel del estado pasa al personaje (las tiradas de 2024 lo restan) y lo de cada nivel, con sus reglas */
const exhaustion = [
  { target: 'cansancio', op: 'min', value: '@este.nivel', when: on },
  ...checks(rules2014, '@cansancio >= 1'),
  { target: 'velocidad', op: 'mul', value: '0.5', when: all(rules2014, '@cansancio >= 2') },
  ...['ataque', 'salvacion', 'salvacion_muerte'].map((r) => disadvantage(r, rules2014, '@cansancio >= 3')),
  { target: 'pg_max', op: 'mul', value: '0.5', when: all(rules2014, '@cansancio >= 4') },
  { target: 'velocidad', op: 'max', value: '0', when: all(rules2014, '@cansancio >= 5') },
  { target: 'velocidad', op: 'add', value: '-5 * @cansancio', when: all(rules2024) },
  { target: 'velocidad', op: 'min', value: '0', when: all(rules2024) }
]

/** Lo que no se calcula y se lleva a mano, por estado */
const MANUAL = {
  cegado: t(
    'No ve: falla las pruebas que piden ver. Los ataques contra él tienen ventaja.',
    'Can’t see: fails checks that require sight. Attack rolls against it have advantage.'
  ),
  asustado: t(
    'Solo mientras ve la fuente de su miedo (desactívalo si no la ve). No puede acercarse a ella.',
    'Only while the source of its fear is in sight (turn it off otherwise). Can’t move closer to it.'
  ),
  agarrado: t(
    'Termina si quien agarra queda incapacitado o se aleja.',
    'Ends if the grappler is incapacitated or moved away.'
  ),
  agarrado2024: t(
    'Desventaja en los ataques contra quien no sea quien lo agarra. Quien agarra puede arrastrarlo.',
    'Disadvantage on attack rolls against any target other than the grappler. The grappler can drag it.'
  ),
  incapacitado: t(
    'No puede hacer acciones, acciones adicionales ni reacciones; pierde la concentración y no puede hablar.',
    'Can’t take actions, Bonus Actions or Reactions; Concentration is broken and it can’t speak.'
  ),
  invisible: t(
    'Los ataques contra él tienen desventaja; no le afecta lo que pide verlo.',
    'Attack rolls against it have disadvantage; effects that require seeing it don’t affect it.'
  ),
  inmovil: t(
    'Incapacitado. Falla las salvaciones de Fuerza y Destreza. Los ataques contra él tienen ventaja y, a 1,5 m o menos, son críticos.',
    'Incapacitated. Fails Strength and Dexterity saving throws. Attack rolls against it have advantage and, within 5 feet, are critical hits.'
  ),
  petrificado: t(
    'Incapacitado. Falla las salvaciones de Fuerza y Destreza. Los ataques contra él tienen ventaja. Pesa diez veces más.',
    'Incapacitated. Fails Strength and Dexterity saving throws. Attack rolls against it have advantage. Its weight increases tenfold.'
  ),
  derribado: t(
    'Solo se arrastra o se levanta (con la mitad de su velocidad). Los ataques contra él tienen ventaja a 1,5 m o menos y desventaja más lejos.',
    'Can only crawl or stand up (half its speed). Attack rolls against it have advantage within 5 feet and disadvantage otherwise.'
  ),
  apresado: t('Los ataques contra él tienen ventaja.', 'Attack rolls against it have advantage.'),
  aturdido: t(
    'Incapacitado. Falla las salvaciones de Fuerza y Destreza. Los ataques contra él tienen ventaja.',
    'Incapacitated. Fails Strength and Dexterity saving throws. Attack rolls against it have advantage.'
  ),
  inconsciente: t(
    'Incapacitado y derribado; suelta lo que lleva en las manos. Falla las salvaciones de Fuerza y Destreza. Los ataques contra él tienen ventaja y, a 1,5 m o menos, son críticos.',
    'Incapacitated and prone; drops whatever it’s holding. Fails Strength and Dexterity saving throws. Attack rolls against it have advantage and, within 5 feet, are critical hits.'
  ),
  cansancio: t(
    'Con el nivel 6, muere. Un descanso largo quita un nivel.',
    'At level 6, it dies. A long rest removes one level.'
  )
}

type Mechanics = Record<string, unknown>
const partial = (effects: unknown[], manual: { es: string; en: string }): Mechanics => ({
  effects,
  toggle: {},
  automation: 'partial',
  manual
})
const textOnly: Mechanics = { automation: 'text' }
/** En 2024, quien está incapacitado tira la iniciativa con desventaja (sorprendido) */
const surprised = disadvantage('iniciativa')

/** La mecánica de cada estado en cada edición */
export const CONDITION_MECHANICS: Record<Edition, Record<string, Mechanics>> = {
  '2014': {
    cegado: partial([disadvantage('ataque')], MANUAL.cegado),
    hechizado: textOnly,
    ensordecido: textOnly,
    cansancio: partial(exhaustion, MANUAL.cansancio),
    asustado: partial([...checks(), disadvantage('ataque')], MANUAL.asustado),
    agarrado: partial([speed0], MANUAL.agarrado),
    incapacitado: textOnly,
    invisible: partial([advantage('ataque')], MANUAL.invisible),
    paralizado: partial([speed0], MANUAL.inmovil),
    petrificado: partial(
      [
        speed0,
        ...DAMAGE_TYPES.map((d) => ({ target: 'resistencias', op: 'append', value: `"${d}"`, when: on })),
        { target: 'inmunidades', op: 'append', value: '"veneno"', when: on },
        { target: 'inmunidades_estados', op: 'append', value: '"envenenado"', when: on }
      ],
      MANUAL.petrificado
    ),
    envenenado: { effects: [...checks(), disadvantage('ataque')], toggle: {}, automation: 'full' },
    derribado: partial([disadvantage('ataque')], MANUAL.derribado),
    apresado: partial([speed0, disadvantage('ataque'), disadvantage('salvacion.des')], MANUAL.apresado),
    aturdido: partial([speed0], MANUAL.aturdido),
    inconsciente: partial([speed0], MANUAL.inconsciente)
  },
  '2024': {
    cegado: partial([disadvantage('ataque')], MANUAL.cegado),
    hechizado: textOnly,
    ensordecido: textOnly,
    cansancio: partial(exhaustion, MANUAL.cansancio),
    asustado: partial([...checks(), disadvantage('ataque')], MANUAL.asustado),
    agarrado: partial([speed0], MANUAL.agarrado2024),
    incapacitado: partial([surprised], MANUAL.incapacitado),
    invisible: partial([advantage('iniciativa'), advantage('ataque')], MANUAL.invisible),
    paralizado: partial([speed0, surprised], MANUAL.inmovil),
    petrificado: partial(
      [
        speed0,
        surprised,
        ...DAMAGE_TYPES.map((d) => ({ target: 'resistencias', op: 'append', value: `"${d}"`, when: on })),
        { target: 'inmunidades_estados', op: 'append', value: '"envenenado"', when: on }
      ],
      MANUAL.petrificado
    ),
    envenenado: { effects: [...checks(), disadvantage('ataque')], toggle: {}, automation: 'full' },
    derribado: partial([disadvantage('ataque')], MANUAL.derribado),
    apresado: partial([speed0, disadvantage('ataque'), disadvantage('salvacion.des')], MANUAL.apresado),
    aturdido: partial([surprised], MANUAL.aturdido),
    inconsciente: partial([speed0, surprised], MANUAL.inconsciente)
  }
}

type ConditionText = { name: string; text: string; page: number }

/** El documento de un estado de una edición: su texto en los dos idiomas y su mecánica */
export function conditionDoc(
  edition: Edition,
  [concept, nameEs, nameEn]: readonly [string, string, string],
  en: ConditionText,
  es: ConditionText
): Doc {
  const mechanics = CONDITION_MECHANICS[edition][concept]
  if (!mechanics) throw new Error(`Falta la mecánica de «${concept}»`)
  return {
    type: 'estado',
    key: `${concept}_${edition}`,
    source: SOURCE[edition],
    concept,
    data: {
      name: t(nameEs, nameEn),
      activo: true,
      ...(concept === 'cansancio' ? { nivel: 1 } : {}),
      descripcion: t(es.text, en.text)
    },
    mechanics,
    ref: { pages: { en: en.page, es: es.page } }
  }
}

/** Los estados de una edición, con los dos idiomas emparejados por su nombre (los de la lista del sistema) */
export function conditionDocs(edition: Edition): Doc[] {
  const en = new Map(conditionEntries(edition, 'en').map((e) => [e.name, e]))
  const es = new Map(conditionEntries(edition, 'es').map((e) => [e.name, e]))
  return CONDITIONS.map((condition) => {
    const a = en.get(condition[2])
    const b = es.get(condition[1])
    if (!a || !b) throw new Error(`Falta el estado «${condition[2]}» / «${condition[1]}» de ${edition}`)
    return conditionDoc(edition, condition, a, b)
  })
}
