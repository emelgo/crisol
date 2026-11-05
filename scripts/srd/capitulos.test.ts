import { describe, expect, it } from 'vitest'
import { type Pair, pairChapter, pairGlossary, type RuleText, ruleDocsOf, split } from './capitulos.ts'
import { CONDITION_MECHANICS, conditionDoc } from './estados.ts'
import { GLOSSARY_PAIRS } from './pares.ts'

const text = (name: string, body = `${name}.`, page = 1, intro?: boolean): RuleText => ({
  name,
  text: body,
  page,
  ...(intro ? { intro } : {})
})
const chapter = { name: { es: 'Combate', en: 'Combat' } }
const pair = (en: RuleText, es: RuleText, c: Pair['chapter'] = chapter.name): Pair => ({ en, es, chapter: c })

describe('las reglas: emparejar, partir y dar sus conceptos', () => {
  it('un capítulo se empareja por su orden, sin las secciones que no van ni las vacías', () => {
    const pairs = pairChapter(
      { ...chapter, skip: /^Tools$/ },
      [text('Cover'), text('Tools'), text('Empty', '')],
      [text('Cobertura'), text('Herramientas'), text('Vacía', '')]
    )
    expect(pairs.map((p) => [p.en.name, p.es.name])).toEqual([['Cover', 'Cobertura']])
    expect(() => pairChapter(chapter, [text('Cover')], [])).toThrow('1 secciones en inglés y 0 en español')
  })

  it('lo que no cabe se parte por sus apartados, con el nombre de la sección delante', () => {
    const long = (title: string, sub: string) => text(title, `Intro.\n\n### ${sub}\n\n${'x'.repeat(30)}`, 254, true)
    const parts = split(pair(long('Monsters', 'Size'), long('Monstruos', 'Tamaño')), 40)
    expect(parts.map((p) => [p.en.name, p.es.name, p.es.text, p.es.intro])).toEqual([
      ['Monsters', 'Monstruos', 'Intro.', true],
      ['Monsters: Size', 'Monstruos: Tamaño', 'x'.repeat(30), false]
    ])
    expect(split(pair(text('Short'), text('Corta')))).toHaveLength(1)
    expect(() => split(pair(long('A', 'B'), text('C', 'x'.repeat(50))), 40)).toThrow(
      '2 apartados en inglés y 1 en español'
    )
  })

  it('el glosario, por la lista revisada: todas las entradas, sin los estados, y ninguna de sobra', () => {
    const pairs = pairGlossary(
      [text('Cover'), text('Blinded [Condition]')],
      [text('Cegado [estado]'), text('Cobertura')],
      { Cover: 'Cobertura' }
    )
    expect(pairs.map((p) => [p.en.name, p.es.name, p.chapter?.es])).toEqual([
      ['Cover', 'Cobertura', 'Glosario de reglas']
    ])
    expect(() => pairGlossary([text('Cover')], [text('Cobertura'), text('Sobra')], { Cover: 'Cobertura' })).toThrow(
      'sin pareja en inglés: Sobra'
    )
    expect(() => pairGlossary([text('Nada')], [], {})).toThrow('«Nada» no tiene pareja')
    // La lista revisada no repite ninguna entrada en español
    expect(new Set(Object.values(GLOSSARY_PAIRS)).size).toBe(Object.keys(GLOSSARY_PAIRS).length)
  })

  it('lo de 2014 con el mismo nombre en inglés (o renombrado) que algo de 2024 lleva su concepto; lo demás, otro', () => {
    const docs = ruleDocsOf({
      '2024': [
        pair(text('Cover'), text('Cobertura')),
        pair(text('Poison'), text('Veneno')),
        pair(text('Attack [Action]'), text('Atacar [acción]')),
        pair(text('Magic Items'), text('Objetos mágicos'), null),
        pair(text('Magic Items', 'Intro.', 204, true), text('Objetos mágicos', 'Intro.', 223, true))
      ],
      '2014': [
        pair(text('Cover'), text('Cobertura')),
        pair(text('Poisons'), text('Venenos')),
        pair(text('Making an Attack'), text('Atacar')),
        pair(text('Magic Items', 'Intro.', 206, true), text('Objetos mágicos', 'Intro.', 221, true))
      ]
    })
    expect(docs.map((d) => d.key)).toEqual([
      'regla_cobertura_2024',
      'regla_veneno_2024',
      'regla_atacar_2024',
      'regla_objetos_magicos_2024',
      'regla_objetos_magicos_2_2024',
      'regla_cobertura_2014',
      'regla_veneno_2014',
      // Otro nombre en inglés: aunque en español se llame igual, no es lo mismo
      'regla_atacar_2_2014',
      // Las dos introducciones van juntas
      'regla_objetos_magicos_2_2014'
    ])
    expect(docs[0]).toMatchObject({
      type: 'regla',
      source: 'srd521',
      concept: 'regla_cobertura',
      data: { name: { es: 'Cobertura', en: 'Cover' }, capitulo: { es: 'Combate', en: 'Combat' } },
      mechanics: { automation: 'text' }
    })
    expect(docs[3]?.data).not.toHaveProperty('capitulo')
  })
})

describe('los estados', () => {
  it('cada estado de cada edición tiene su mecánica; el documento lleva sus dos idiomas y su página', () => {
    for (const edition of ['2014', '2024'] as const) expect(Object.keys(CONDITION_MECHANICS[edition])).toHaveLength(15)
    const doc = conditionDoc(
      '2024',
      ['cansancio', 'Cansancio', 'Exhaustion'],
      { name: 'Exhaustion', text: 'Tired.', page: 181 },
      { name: 'Cansancio', text: 'Cansado.', page: 197 }
    )
    expect(doc).toMatchObject({
      key: 'cansancio_2024',
      source: 'srd521',
      data: { name: { es: 'Cansancio', en: 'Exhaustion' }, activo: true, nivel: 1, descripcion: { es: 'Cansado.' } },
      ref: { pages: { en: 181, es: 197 } }
    })
    expect(() =>
      conditionDoc('2014', ['nada', 'Nada', 'None'], { name: '', text: '', page: 1 }, { name: '', text: '', page: 1 })
    ).toThrow('Falta la mecánica de «nada»')
  })
})
