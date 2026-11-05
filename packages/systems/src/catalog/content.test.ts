import { describe, expect, it } from 'vitest'
import { prepareAction } from '../actions.ts'
import { resolveConcept, searchContent, visibleContent } from '../content.ts'
import { type DocumentItem, evaluate } from '../evaluate.ts'
import type { ContentItem } from '../file.ts'
import { validateContent } from '../file.ts'
import * as index from '../index.ts'
import type { Mechanics } from '../mechanics.ts'
import { tryRoll } from '../rolls.ts'
import { MEASURED } from './5e/measured.ts'
import { fiveE, SKILLS } from './5e/system.ts'
import { catalogContent } from './content.ts'

// Recorren el contenido entero del 5e (más de 3000 documentos): con la cobertura instrumentada, tardan varios segundos
describe('el contenido de los sistemas de serie', { timeout: 60_000 }, () => {
  it('el del 5e valida, con sus dos idiomas y su página en cada documento', () => {
    const content = catalogContent('5e')
    expect(content.length).toBeGreaterThan(0)
    expect(validateContent(fiveE, content)).toEqual([])
    for (const item of content) {
      expect(item.data.name).toMatchObject({ es: expect.any(String), en: expect.any(String) })
      expect(item.ref?.pages).toMatchObject({ es: expect.any(Number), en: expect.any(Number) })
    }
  })

  it('trae lo medido en los PDF, por tipo y edición', () => {
    const counted: Record<string, Record<string, number>> = {}
    for (const item of catalogContent('5e')) {
      const edition = fiveE.sources?.find((s) => s.key === item.source)?.edition ?? '?'
      counted[item.type] = { ...counted[item.type], [edition]: (counted[item.type]?.[edition] ?? 0) + 1 }
    }
    expect(counted).toEqual(MEASURED)
  })

  it('la mecánica del equipo da lo del SRD: la poción cura 2d4 + 2; el ácido de 2024, con su salvación', () => {
    const carry = (key: string): DocumentItem => {
      const item = catalogContent('5e').find((c) => c.key === key)
      if (!item) throw new Error(key)
      return {
        id: key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: item.data,
        ...(item.mechanics ? { mechanics: item.mechanics } : {})
      }
    }
    const doc = {
      data: { caracteristicas: { des: { puntuacion: 14 } } },
      items: [carry('pocion_de_curacion_2024'), carry('acido_2024'), carry('acido_2014')]
    }
    expect(prepareAction(fiveE, 'personaje', doc, 'pocion_de_curacion_2024', 'beber')).toMatchObject({
      activation: 'bonus',
      heal: { formula: '2d4+2', average: 7 }
    })
    expect(prepareAction(fiveE, 'personaje', doc, 'acido_2024', 'lanzar')).toMatchObject({
      save: { ability: 'des', dc: 12 },
      damage: [{ formula: '2d6', type: 'acido', average: 7 }]
    })
    expect(prepareAction(fiveE, 'personaje', doc, 'acido_2014', 'lanzar')).toMatchObject({ attack: '1d20+2', bonus: 2 })
  })

  it('cada concepto al que apunta algo (lo que concede, lo que se elige) existe en su edición', () => {
    const content = catalogContent('5e')
    const seen = visibleContent(fiveE, content, { sources: ['srd51', 'srd521'], duplicates: 'both' })
    const editionOf = (item: ContentItem) => fiveE.sources?.find((s) => s.key === item.source)?.edition
    const missing: string[] = []
    for (const item of content)
      for (const g of item.mechanics?.grants ?? []) {
        const wanted = [
          ...(g.concept ? [{ concept: g.concept, type: g.type }] : []),
          ...(g.choose?.type ? (g.choose.from ?? []).map((concept) => ({ concept, type: g.choose?.type })) : [])
        ]
        for (const w of wanted) {
          const found = resolveConcept(fiveE, seen, w.concept, {
            ...(w.type ? { type: w.type } : {}),
            edition: editionOf(item)
          })
          if (!found || editionOf(found) !== editionOf(item)) missing.push(`${item.key} → ${w.concept}`)
        }
      }
    expect(missing).toEqual([])
  })

  it('el guerrero de nivel 5 del contenido, con cota de malla y espada larga: CA 16, PG 44 y un ataque de +6', () => {
    const content = catalogContent('5e')
    const carry = (
      key: string,
      extra: Partial<DocumentItem> = {},
      data: Record<string, unknown> = {}
    ): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      const name = item.data.name as { es: string }
      return {
        id: item.concept ?? key,
        type: item.type,
        name: name.es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {}),
        ...extra
      }
    }
    // La clase y lo que concede hasta su nivel 5 (como lo pondrá el creador), con su equipo
    const clase = carry(
      'guerrero_2024',
      { choices: { habilidades: ['atletismo', 'percepcion'] } },
      { nivel: 5, inicial: true }
    )
    const granted = (clase.mechanics?.grants ?? [])
      .filter((g) => g.concept && (g.level ?? 0) <= 5)
      .map((g) => carry(`${g.concept}_2024`, { from: clase.id }))
    const doc = {
      data: { caracteristicas: { fue: { puntuacion: 16 }, des: { puntuacion: 12 }, con: { puntuacion: 14 } } },
      items: [
        clase,
        ...granted,
        carry('cota_de_malla_2024', {}, { equipado: true }),
        carry('espada_larga_2024', {}, { equipado: true })
      ]
    }
    const r = evaluate(fiveE, 'personaje', doc)
    expect(r.values).toMatchObject({ nivel: 5, competencia: 3, ca: 16, pg_max: 44, ataques: 2 })
    expect(r.computed.ca?.terms).toEqual([{ label: 'Cota de malla', value: 16, kind: 'base', origin: 'cota_de_malla' }])
    expect(r.items.espada_larga).toMatchObject({ ataque: 6, dano_bono: 3 })
    const hab = r.values.habilidades as Record<string, { total: number }>
    expect([hab.atletismo?.total, hab.percepcion?.total]).toEqual([6, 3])
    expect(r.resources.find((x) => x.item === 'guerrero_tomar_aliento')).toMatchObject({
      max: 3,
      recovery: 'short',
      amount: '1'
    })
    expect(prepareAction(fiveE, 'personaje', doc, 'guerrero_tomar_aliento', 'usar')).toMatchObject({
      heal: { formula: '1d10+5' }
    })
    expect(tryRoll(fiveE, 'personaje', doc, 'ataque', { element: 'espada_larga', roller: () => 10 }).total).toBe(16)
  })

  it('los estados: envenenado da desventaja; el cansancio, lo de cada nivel con las reglas que elige la campaña', () => {
    const content = catalogContent('5e')
    const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      return {
        id: item.concept ?? key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
      }
    }
    const data = { caracteristicas: { des: { puntuacion: 14 }, con: { puntuacion: 14 } } }
    const clase = carry('guerrero_2024', { nivel: 1, inicial: true })
    const poisoned = evaluate(fiveE, 'personaje', { data, items: [carry('envenenado_2024')] })
    expect(Object.keys(poisoned.advantages).sort()).toEqual(['ataque', 'habilidad', 'iniciativa', 'prueba'])
    expect(poisoned.advantages.ataque).toEqual([{ mode: 'disadvantage', label: 'Envenenado', origin: 'envenenado' }])
    // Desactivado, nada
    const off = evaluate(fiveE, 'personaje', { data, items: [carry('envenenado_2024', { activo: false })] })
    expect(off.advantages).toEqual({})

    const tired = (reglas: string) =>
      evaluate(
        fiveE,
        'personaje',
        { data, items: [clase, carry('cansancio_2024', { nivel: 3 })] },
        { settings: { reglas } }
      )
    // 2014: velocidad a la mitad, desventaja en pruebas, ataques y salvaciones (también contra la muerte)
    const old = tired('e2014')
    expect(old.values).toMatchObject({ cansancio: 3, velocidad: 15, pg_max: 12 })
    expect(Object.keys(old.advantages).sort()).toEqual([
      'ataque',
      'habilidad',
      'iniciativa',
      'prueba',
      'salvacion',
      'salvacion_muerte'
    ])
    expect(
      evaluate(
        fiveE,
        'personaje',
        { data, items: [clase, carry('cansancio_2014', { nivel: 4 })] },
        {
          settings: { reglas: 'e2014' }
        }
      ).values
    ).toMatchObject({ pg_max: 6, velocidad: 15 })
    // A la mitad, hacia abajo: 25 pies son 12
    const slow = evaluate(
      fiveE,
      'personaje',
      { data: { ...data, velocidad: 25 }, items: [carry('cansancio_2014', { nivel: 2 })] },
      { settings: { reglas: 'e2014' } }
    )
    expect(slow.values.velocidad).toBe(12)
    // 2024: 1,5 m menos por nivel y −2 por nivel a las pruebas d20, sin desventajas
    const now = tired('e2024')
    expect(now.values).toMatchObject({ cansancio: 3, velocidad: 15, pg_max: 12 })
    expect(now.advantages).toEqual({})
    const doc = { data, items: [clase, carry('cansancio_2024', { nivel: 3 })] }
    const roll = (key: string) =>
      tryRoll(fiveE, 'personaje', doc, key, { element: 'des', roller: () => 10, settings: { reglas: 'e2024' } }).total
    expect([roll('prueba'), roll('salvacion_muerte')]).toEqual([6, 4])

    const stone = evaluate(fiveE, 'personaje', { data, items: [carry('petrificado_2014')] })
    expect(stone.values).toMatchObject({ velocidad: 0, inmunidades: ['veneno'], inmunidades_estados: ['envenenado'] })
    expect(stone.values.resistencias).toHaveLength(13)
  })

  it('los conjuros: su salvación, su daño y su escalado; la curación con su modificador; Armadura de mago', () => {
    const content = catalogContent('5e')
    const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      return {
        id: item.concept ?? key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
      }
    }
    const data = { caracteristicas: { des: { puntuacion: 14 }, int: { puntuacion: 16 }, sab: { puntuacion: 16 } } }
    const fireball = { data, items: [carry('bola_de_fuego_2014', { caracteristica: 'int' })] }
    expect(prepareAction(fiveE, 'personaje', fireball, 'bola_de_fuego', 'lanzar', { level: 3 })).toMatchObject({
      save: { ability: 'des', dc: 13, success: 'half' },
      damage: [{ formula: '8d6', type: 'fuego' }]
    })
    expect(
      prepareAction(fiveE, 'personaje', fireball, 'bola_de_fuego', 'lanzar', { level: 5 }).damage[0]?.formula
    ).toBe('10d6')
    expect(content.find((c) => c.key === 'bola_de_fuego_2014')?.data.clases).toEqual(['hechicero', 'mago'])
    // Un truco escala con el nivel del personaje
    const bolt = { data, items: [carry('guerrero_2024', { nivel: 5 }), carry('descarga_de_fuego_2024')] }
    expect(prepareAction(fiveE, 'personaje', bolt, 'descarga_de_fuego', 'lanzar')).toMatchObject({
      attack: expect.stringMatching(/^1d20/),
      damage: [{ formula: '2d10', type: 'fuego' }]
    })
    const cure = { data, items: [carry('curar_heridas_2024', { caracteristica: 'sab' })] }
    expect(prepareAction(fiveE, 'personaje', cure, 'curar_heridas', 'lanzar', { level: 2 }).heal).toMatchObject({
      formula: '4d8+3'
    })
    // Sin armadura, 13 + Des; con armadura, la de la armadura
    const mage = (armor: boolean) =>
      evaluate(fiveE, 'personaje', {
        data,
        items: [
          carry('armadura_de_mago_2024', { activo: true }),
          ...(armor ? [carry('cota_de_malla_2024', { equipado: true })] : [])
        ]
      }).values.ca
    expect([mage(false), mage(true)]).toEqual([15, 16])
  })

  it('los objetos mágicos: el Anillo de protección sintonizado da +1 a la CA y a las salvaciones; el Amuleto de salud, Con 19', () => {
    const content = catalogContent('5e')
    const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      return {
        id: item.concept ?? key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
      }
    }
    const data = { caracteristicas: { des: { puntuacion: 14 }, con: { puntuacion: 10 } } }
    const worn = (attuned: boolean) =>
      evaluate(fiveE, 'personaje', {
        data,
        items: [
          carry('anillo_de_proteccion_2014', { sintonizado: attuned }),
          carry('amuleto_de_salud_2024', { sintonizado: attuned })
        ]
      }).values as { ca: number; caracteristicas: Record<string, { puntuacion: number; salvacion: number }> }
    expect(worn(true)).toMatchObject({ ca: 13, caracteristicas: { con: { puntuacion: 19 }, des: { salvacion: 3 } } })
    expect(worn(false)).toMatchObject({ ca: 12, caracteristicas: { con: { puntuacion: 10 }, des: { salvacion: 2 } } })
    expect(content.find((c) => c.key === 'varita_de_bolas_de_fuego_2014')?.mechanics?.resources).toEqual([
      expect.objectContaining({ max: '7', recovery: 'dawn', amount: '1d6+1' })
    ])
  })

  it('las criaturas: sus fórmulas dan lo que dice su perfil (salvaciones, habilidades, pasiva, iniciativa, ataques y CD)', () => {
    const wrong: string[] = []
    let checked = 0
    const num = (text: string) => Number(text.replace('−', '-'))
    const ABBR: Record<string, string> = { str: 'fue', dex: 'des', con: 'con', int: 'int', wis: 'sab', cha: 'car' }
    const SKILL_KEYS: Record<string, string> = Object.fromEntries(SKILLS.map(([key, , en]) => [en.toLowerCase(), key]))
    for (const item of catalogContent('5e').filter((c) => c.type === 'criatura')) {
      const text = (item.data.descripcion as { en: string }).en
      const doc = { data: item.data, items: [], ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {}) }
      const r = evaluate(fiveE, 'criatura', doc)
      const values = r.values as {
        caracteristicas: Record<string, { salvacion: number }>
        habilidades: Record<string, { total: number }>
        percepcion_pasiva: number
        iniciativa: number
      }
      const check = (what: string, got: unknown, want: number) => {
        checked++
        if (got !== want) wrong.push(`${item.key} ${what}: ${String(got)} ≠ ${want}`)
      }
      for (const m of /\*\*Saving Throws\*\* ([^\n]*)/.exec(text)?.[1]?.matchAll(/(\w+) ([+−-]\d+)/g) ?? [])
        check(
          `salvación ${m[1]}`,
          values.caracteristicas[ABBR[(m[1] as string).toLowerCase()] ?? '']?.salvacion,
          num(m[2] as string)
        )
      const saves = text.split('\n').find((l) => /^\| [+−]\d+ \|/.test(l))
      if (saves)
        saves
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
          .forEach((v, i) => {
            check(`salvación ${i}`, Object.values(values.caracteristicas)[i]?.salvacion, num(v))
          })
      for (const m of /\*\*Skills\*\* ([^\n]*)/.exec(text)?.[1]?.matchAll(/([A-Za-z][A-Za-z ]+?) ([+−-]\d+)/g) ?? [])
        check(
          `habilidad ${m[1]}`,
          values.habilidades[SKILL_KEYS[(m[1] as string).trim().toLowerCase()] ?? '']?.total,
          num(m[2] as string)
        )
      const passive = /passive Perception (\d+)/i.exec(text)?.[1]
      if (passive) check('pasiva', values.percepcion_pasiva, Number(passive))
      const initiative = /\*\*Initiative\*\* ([+−-]\d+)/.exec(text)?.[1]
      if (initiative) check('iniciativa', values.iniciativa, num(initiative))
      // Cada ataque y cada CD, lo que dice su texto
      for (const action of (item.mechanics?.actions ?? []) as { key: string; label: { en: string } }[]) {
        const line = text.split('\n').find((l) => l.startsWith(`**${action.label.en}.**`)) ?? ''
        const prepared = prepareAction(fiveE, 'criatura', doc, null, action.key)
        const hit = /Attack(?: Roll)?: \+(\d+)/.exec(line)?.[1]
        if (hit) check(`ataque ${action.key}`, prepared.bonus, Number(hit))
        const dc = /DC (\d+) \w+ saving throw|Saving Throw: DC (\d+)/i.exec(line)
        if (dc) check(`CD ${action.key}`, prepared.save?.dc, Number(dc[1] ?? dc[2]))
      }
    }
    expect(wrong).toEqual([])
    // Las salvaciones de las 330 de 2024 (seis cada una), las pasivas y unos cientos de ataques
    expect(checked).toBeGreaterThan(4000)
  })

  it('las especies, los trasfondos y las dotes: un enano de las colinas con lo que le conceden; Alerta; el acólito', () => {
    const content = catalogContent('5e')
    const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      return {
        id: item.concept ?? key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
      }
    }
    // Lo que concede cada uno (como lo pondrá el creador): sus rasgos y, la subraza, su especie
    const granted = (key: string, edition: string): DocumentItem[] => {
      const item = carry(key)
      return [
        item,
        ...(item.mechanics?.grants ?? [])
          .filter((g) => g.concept)
          .flatMap((g) => granted(`${g.concept}_${edition}`, edition).map((it) => ({ ...it, from: item.id })))
      ]
    }
    const items = [carry('guerrero_2014', { nivel: 3, inicial: true }), ...granted('enano_de_las_colinas_2014', '2014')]
    const data = { caracteristicas: { con: { puntuacion: 14 }, sab: { puntuacion: 10 } } }
    const r = evaluate(fiveE, 'personaje', { data, items })
    expect(r.values).toMatchObject({
      caracteristicas: { con: { puntuacion: 16 }, sab: { puntuacion: 11 } },
      velocidad: 25,
      resistencias: ['veneno']
    })
    // Guerrero de nivel 3: 10 + 2 × 6 de la clase, más 3 × Con (+3) y 3 de la dureza enana
    expect(r.values.pg_max).toBe(34)
    const alert = evaluate(fiveE, 'personaje', { data: {}, items: [carry('alerta_2024')] }).values
    expect(alert.iniciativa).toBe(2)
    const acolyte = carry('acolito_2024')
    expect(acolyte.mechanics?.grants).toEqual([{ concept: 'iniciado_en_la_magia', type: 'dote' }])
    const hab = evaluate(fiveE, 'personaje', { data: {}, items: [acolyte] }).values.habilidades as Record<
      string,
      { total: number }
    >
    expect([hab.perspicacia?.total, hab.religion?.total]).toEqual([2, 2])
  })

  it('las clases: un bárbaro con su furia, el nivel de lanzador de un mago, un paladín y un brujo, el ataque furtivo', () => {
    const content = catalogContent('5e')
    const carry = (key: string, data: Record<string, unknown> = {}): DocumentItem => {
      const item = content.find((c) => c.key === key) as ContentItem
      if (!item) throw new Error(key)
      return {
        id: item.concept ?? key,
        type: item.type,
        name: (item.data.name as { es: string }).es,
        data: { ...item.data, ...data },
        ...(item.mechanics ? { mechanics: item.mechanics as Mechanics } : {})
      }
    }
    // Una clase de un nivel con lo que concede hasta él (como lo pondrá el creador)
    const klass = (
      key: string,
      nivel: number,
      edition: string,
      extra: Record<string, Record<string, unknown>> = {}
    ) => {
      const item = carry(key, { nivel, inicial: true })
      return [
        item,
        ...(item.mechanics?.grants ?? [])
          .filter((g) => g.concept && (g.level ?? 0) <= nivel)
          .map((g) => carry(`${g.concept}_${edition}`, extra[g.concept as string] ?? {}))
          .map((it) => ({ ...it, from: item.id }))
      ]
    }
    const data = { caracteristicas: { fue: { puntuacion: 16 }, des: { puntuacion: 14 }, con: { puntuacion: 16 } } }
    const barbarian = (rage: boolean) =>
      evaluate(fiveE, 'personaje', {
        data,
        items: klass('barbaro_2014', 5, '2014', { barbaro_furia: { activo: rage } })
      })
    const calm = barbarian(false)
    expect(calm.values).toMatchObject({ ca: 15, ataques: 2, bono_dano_fue: 0, resistencias: [] })
    expect(calm.resources.find((r) => r.key === 'furias')).toMatchObject({ max: 3, recovery: 'long' })
    expect(barbarian(true).values).toMatchObject({
      bono_dano_fue: 2,
      resistencias: ['contundente', 'cortante', 'perforante']
    })
    expect(barbarian(true).advantages).toMatchObject({
      'salvacion.fue': [expect.objectContaining({ mode: 'advantage' })]
    })

    const caster = (key: string, nivel: number, edition: string) =>
      evaluate(fiveE, 'personaje', { data: {}, items: klass(key, nivel, edition) }).values as Record<string, unknown>
    expect(caster('mago_2024', 5, '2024')).toMatchObject({ nivel_lanzador: 5, caracteristica_conjuros: 'int' })
    expect([
      caster('paladin_2014', 1, '2014').nivel_lanzador,
      caster('paladin_2014', 5, '2014').nivel_lanzador
    ]).toEqual([0, 3])
    expect(caster('paladin_2024', 1, '2024').nivel_lanzador).toBe(1)
    expect(caster('brujo_2024', 5, '2024')).toMatchObject({ pacto_espacios: 2, pacto_nivel: 3, nivel_lanzador: 0 })

    const rogue = { data, items: klass('picaro_2014', 5, '2014') }
    expect(prepareAction(fiveE, 'personaje', rogue, 'picaro_ataque_furtivo', 'ataque_furtivo').damage[0]?.formula).toBe(
      '3d6'
    )
  })

  it('el texto de las reglas: lo de 2014 con versión de 2024 se esconde con lo más nuevo; se busca en los dos idiomas', () => {
    const content = catalogContent('5e')
    const cover = (duplicates: 'newest' | 'both') =>
      visibleContent(fiveE, content, { sources: ['srd51', 'srd521'], duplicates })
        .filter((s) => s.item.concept === 'regla_cobertura')
        .map((s) => [s.item.key, s.legacy])
    expect(cover('newest')).toEqual([['regla_cobertura_2024', false]])
    expect(cover('both')).toEqual([
      ['regla_cobertura_2024', false],
      ['regla_cobertura_2014', true]
    ])
    const entries = content.map((c) => ({ ...c, name: c.data.name }))
    const found = searchContent(fiveE, entries, { query: 'opportunity attacks', type: 'regla' })
    expect(found.items[0]).toMatchObject({ key: 'regla_ataques_de_oportunidad_2024', name: 'Ataques de oportunidad' })
    const glossary = content.find((c) => c.key === 'regla_ataques_de_oportunidad_2024')
    expect(glossary?.data).toMatchObject({ capitulo: { es: 'Glosario de reglas', en: 'Rules Glossary' } })
  })

  it('el texto de cada documento lleva las mismas tablas en los dos idiomas (salvo las reglas que las parten distinto)', () => {
    // Lo que se cuela de un documento en otro (la tabla de una clase, una columna suelta) se nota así. Estas seis son
    // del texto de las reglas, donde cada PDF parte o junta sus tablas a su manera
    const KNOWN = [
      'regla_convenciones_del_glosario_2024',
      'regla_crear_tu_personaje_2024',
      'regla_encuentros_de_combate_2024',
      'regla_ritmo_de_viaje_2024',
      'regla_terreno_dificil_2024',
      'regla_trampas_2024'
    ]
    const tables = (text: string) => text.match(/^\| ---/gm)?.length ?? 0
    const differ = catalogContent('5e')
      .filter((c) => {
        const text = c.data.descripcion as { es: string; en: string } | undefined
        return text && typeof text === 'object' && tables(text.en) !== tables(text.es)
      })
      .map((c) => c.key)
      .sort()
    expect(differ).toEqual(KNOWN)
  })

  it('se lee una vez; sin contenido, ninguno; no sale en la entrada del paquete (la web no lo lleva)', () => {
    expect(catalogContent('5e')).toBe(catalogContent('5e'))
    expect(catalogContent('blank')).toEqual([])
    expect(catalogContent('nada')).toEqual([])
    expect(Object.keys(index)).not.toContain('catalogContent')
  })

  it('se busca por su nombre en los dos idiomas, sin tildes, por tipo, por edición y con lo que está en las dos', () => {
    const entries = catalogContent('5e').map(({ key, type, source, concept, data, mechanics }) => ({
      key,
      type,
      source,
      concept,
      name: data.name,
      automation: mechanics?.automation ?? null
    }))
    const names = (options: Parameters<typeof searchContent>[2]) =>
      searchContent(fiveE, entries, options).items.map((h) => `${h.name} ${h.edition}${h.legacy ? ' (legado)' : ''}`)
    expect(names({ query: 'espada larga' })).toEqual(['Espada larga 2024', 'Espada larga 2014 (legado)'])
    expect(names({ query: 'espada', type: 'arma' })).toEqual([
      'Espada corta 2024',
      'Espada corta 2014 (legado)',
      'Espada larga 2024',
      'Espada larga 2014 (legado)'
    ])
    expect(names({ query: 'LONGSWORD', language: 'en' })).toEqual(['Longsword 2024', 'Longsword 2014 (legado)'])
    expect(names({ query: 'cota de malla', duplicates: 'newest' })).toEqual(['Cota de malla 2024'])
    expect(names({ type: 'armadura', editions: ['2014'] })).toHaveLength(13)
    expect(names({ type: 'armadura', editions: ['2014'] })).toContain('Cota de malla 2014')
    expect(searchContent(fiveE, entries, { query: 'cota de malla' }).items[1]).toMatchObject({
      key: 'cota_de_malla_2014',
      type: 'armadura',
      source: 'srd51',
      concept: 'cota_de_malla',
      automation: 'full'
    })
    expect(searchContent(fiveE, entries, { limit: 1, offset: 1 })).toMatchObject({ total: entries.length, items: [{}] })
  })
})
