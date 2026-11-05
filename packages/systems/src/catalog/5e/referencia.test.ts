/**
 * Los personajes de referencia (srd-5e, tarea 20): cada clase a nivel 1, 5, 11 y 20 en las dos ediciones da lo que
 * dicen las tablas del SRD (los valores esperados, copiados de ellas a mano, no calculados)
 */
import { describe, expect, it } from 'vitest'
import { prepareAction } from '../../actions.ts'
import { evaluate } from '../../evaluate.ts'
import { catalogContent } from '../content.ts'
import { type Edition, referenceCharacter } from './referencia.ts'
import { fiveE } from './system.ts'

const content = catalogContent('5e')
const LEVELS = [1, 5, 11, 20] as const
const EDITIONS: Edition[] = ['2014', '2024']

/** Los espacios por nivel de lanzador (la tabla del lanzador completo del SRD) */
const FULL: Record<number, number[]> = {
  0: [],
  1: [2],
  3: [4, 2],
  5: [4, 3, 2],
  6: [4, 3, 3],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
}
/** El nivel de lanzador de cada clase a cada nivel de clase (por su tabla: completo, medio de 2014 o de 2024) */
const CASTER: Record<string, Record<Edition, Record<number, number>>> = {
  full: { '2014': { 1: 1, 5: 5, 11: 11, 20: 20 }, '2024': { 1: 1, 5: 5, 11: 11, 20: 20 } },
  half: { '2014': { 1: 0, 5: 3, 11: 6, 20: 10 }, '2024': { 1: 1, 5: 3, 11: 6, 20: 10 } },
  none: { '2014': { 1: 0, 5: 0, 11: 0, 20: 0 }, '2024': { 1: 0, 5: 0, 11: 0, 20: 0 } }
}
const CLASSES: Record<string, { die: number; caster: keyof typeof CASTER; extraAttack: boolean }> = {
  barbaro: { die: 12, caster: 'none', extraAttack: true },
  bardo: { die: 8, caster: 'full', extraAttack: false },
  brujo: { die: 8, caster: 'none', extraAttack: false },
  clerigo: { die: 8, caster: 'full', extraAttack: false },
  druida: { die: 8, caster: 'full', extraAttack: false },
  explorador: { die: 10, caster: 'half', extraAttack: true },
  guerrero: { die: 10, caster: 'none', extraAttack: true },
  hechicero: { die: 6, caster: 'full', extraAttack: false },
  mago: { die: 6, caster: 'full', extraAttack: false },
  monje: { die: 8, caster: 'none', extraAttack: true },
  paladin: { die: 10, caster: 'half', extraAttack: true },
  picaro: { die: 8, caster: 'none', extraAttack: false }
}
/** La competencia por nivel */
const PROFICIENCY: Record<number, number> = { 1: 2, 5: 3, 11: 4, 20: 6 }
/** Los ataques del guerrero (que suma más: 3 a nivel 11, 4 a nivel 20) */
const FIGHTER_ATTACKS: Record<number, number> = { 1: 1, 5: 2, 11: 3, 20: 4 }
/** Lo de cada clase en su tabla: furias, ki, puntos de hechicería, ataque furtivo y la magia de pacto */
const RAGES: Record<Edition, Record<number, number>> = {
  '2014': { 1: 2, 5: 3, 11: 4, 20: 99 },
  '2024': { 1: 2, 5: 3, 11: 4, 20: 6 }
}
const PACT: Record<number, [number, number]> = { 1: [1, 1], 5: [2, 3], 11: [3, 5], 20: [4, 5] }
const SNEAK: Record<number, string> = { 1: '1d6', 5: '3d6', 11: '6d6', 20: '10d6' }

const scores = { fue: 14, des: 14, con: 14, int: 14, sab: 14, car: 14 }

describe('los personajes de referencia: cada clase a nivel 1, 5, 11 y 20, en las dos ediciones', () => {
  for (const edition of EDITIONS)
    for (const [klass, spec] of Object.entries(CLASSES))
      for (const level of LEVELS)
        it(`${klass} ${edition} de nivel ${level}`, () => {
          const doc = referenceCharacter(content, { klass, edition, level, scores })
          const r = evaluate(fiveE, 'personaje', doc)
          const v = r.values as Record<string, unknown> & { espacios: Record<string, { max: number }> }
          expect(r.problems).toEqual([])
          expect(v.nivel).toBe(level)
          expect(v.competencia).toBe(PROFICIENCY[level])
          // Los PG: el dado entero a nivel 1 y su media (la mitad más 1) en cada nivel más, con Con 14 (+2)
          expect(v.pg_max).toBe(spec.die + 2 + (level - 1) * (spec.die / 2 + 1 + 2))
          // Los espacios de conjuro, por su nivel de lanzador
          const caster = CASTER[spec.caster]?.[edition][level] ?? 0
          expect(v.nivel_lanzador).toBe(caster)
          const slots = FULL[caster] ?? []
          for (let n = 1; n <= 9; n++) expect([n, v.espacios[`n${n}`]?.max]).toEqual([n, slots[n - 1] ?? 0])
          // Los ataques por acción de atacar
          const attacks = klass === 'guerrero' ? FIGHTER_ATTACKS[level] : spec.extraAttack && level >= 5 ? 2 : 1
          expect(v.ataques).toBe(attacks)
          const resource = (key: string) => r.resources.find((x) => x.key === key)?.max
          if (klass === 'barbaro') expect(resource('furias')).toBe(RAGES[edition][level])
          if (klass === 'monje') expect(resource('ki')).toBe(level >= 2 ? level : undefined)
          if (klass === 'hechicero') expect(resource('hechiceria')).toBe(level >= 2 ? level : undefined)
          if (klass === 'paladin') expect(resource('imponer_manos')).toBe(5 * level)
          if (klass === 'brujo') expect([v.pacto_espacios, v.pacto_nivel]).toEqual(PACT[level])
          if (klass === 'picaro')
            expect(
              prepareAction(fiveE, 'personaje', doc, 'picaro_ataque_furtivo_1', 'ataque_furtivo').damage[0]?.formula
            ).toBe(SNEAK[level])
        })
})

/**
 * Personajes hechos a mano, de nivel 5 (competencia +3), con su equipo: su CA, el ataque de su arma, su CD de conjuros
 * y sus PG, calculados aparte (no con las fórmulas del sistema)
 */
const HANDMADE: {
  klass: string
  scores: Record<string, number>
  gear: string[]
  weapon: string
  want: { ca: number; ataque: number; cd?: number; pg: number }
}[] = [
  // CA 10 + Des 2 + Con 3 (defensa sin armadura); gran hacha, Fue 3 + 3; d12: 12 + 3 + 4 × (7 + 3)
  {
    klass: 'barbaro',
    scores: { fue: 16, des: 14, con: 16 },
    gear: [],
    weapon: 'hacha_a_dos_manos',
    want: { ca: 15, ataque: 6, pg: 55 }
  },
  // Cuero 11 + Des 2; daga (sutil), Des 2 + 3; CD 8 + 3 + Car 3; d8 con Con 12: 8 + 1 + 4 × (5 + 1)
  {
    klass: 'bardo',
    scores: { des: 14, con: 12, car: 16 },
    gear: ['armadura_de_cuero'],
    weapon: 'daga',
    want: { ca: 13, ataque: 5, cd: 14, pg: 33 }
  },
  // Escamas 14 (Des 0) + escudo 2; maza, Fue 2 + 3; CD 8 + 3 + Sab 3; d8 con Con 14: 8 + 2 + 4 × 7
  {
    klass: 'clerigo',
    scores: { fue: 14, con: 14, sab: 16 },
    gear: ['cota_de_escamas', 'escudo'],
    weapon: 'maza',
    want: { ca: 16, ataque: 5, cd: 14, pg: 38 }
  },
  // Pieles 12 + Des 1 + escudo 2; bastón, Fue 0 + 3; CD 14; 38
  {
    klass: 'druida',
    scores: { des: 12, con: 14, sab: 16 },
    gear: ['armadura_de_pieles', 'escudo'],
    weapon: 'baston',
    want: { ca: 15, ataque: 3, cd: 14, pg: 38 }
  },
  // CA 10 + Des 3 + Sab 2 (defensa sin armadura); daga, Des 3 + 3; 38
  {
    klass: 'monje',
    scores: { des: 16, con: 14, sab: 14 },
    gear: [],
    weapon: 'daga',
    want: { ca: 15, ataque: 6, pg: 38 }
  },
  // Malla 16 + escudo 2; espada larga, Fue 3 + 3; CD 8 + 3 + Car 2; d10: 10 + 2 + 4 × 8
  {
    klass: 'paladin',
    scores: { fue: 16, con: 14, car: 14 },
    gear: ['cota_de_malla', 'escudo'],
    weapon: 'espada_larga',
    want: { ca: 18, ataque: 6, cd: 13, pg: 44 }
  },
  // Cuero tachonado 12 + Des 3; arco largo, Des 3 + 3; CD 8 + 3 + Sab 2; 44
  {
    klass: 'explorador',
    scores: { des: 16, con: 14, sab: 14 },
    gear: ['armadura_de_cuero_tachonado'],
    weapon: 'arco_largo',
    want: { ca: 15, ataque: 6, cd: 13, pg: 44 }
  },
  // Cuero 11 + Des 3; daga, Des 3 + 3; 38
  {
    klass: 'picaro',
    scores: { des: 16, con: 14 },
    gear: ['armadura_de_cuero'],
    weapon: 'daga',
    want: { ca: 14, ataque: 6, pg: 38 }
  },
  // Sin armadura 10 + Des 2; daga 5; CD 8 + 3 + Car 3; d6: 6 + 2 + 4 × (4 + 2)
  {
    klass: 'hechicero',
    scores: { des: 14, con: 14, car: 16 },
    gear: [],
    weapon: 'daga',
    want: { ca: 12, ataque: 5, cd: 14, pg: 32 }
  },
  // Cuero 11 + Des 2; daga 5; CD 14; 38
  {
    klass: 'brujo',
    scores: { des: 14, con: 14, car: 16 },
    gear: ['armadura_de_cuero'],
    weapon: 'daga',
    want: { ca: 13, ataque: 5, cd: 14, pg: 38 }
  },
  // Sin armadura 12; daga 5; CD 8 + 3 + Int 3; 32
  {
    klass: 'mago',
    scores: { des: 14, con: 14, int: 16 },
    gear: [],
    weapon: 'daga',
    want: { ca: 12, ataque: 5, cd: 14, pg: 32 }
  },
  // Malla 16 + escudo 2; espada larga 6; 44
  {
    klass: 'guerrero',
    scores: { fue: 16, con: 14 },
    gear: ['cota_de_malla', 'escudo'],
    weapon: 'espada_larga',
    want: { ca: 18, ataque: 6, pg: 44 }
  }
]

describe('los personajes hechos a mano, con su equipo: su CA, su ataque, su CD y sus PG', () => {
  for (const edition of EDITIONS)
    for (const c of HANDMADE)
      it(`${c.klass} ${edition} de nivel 5`, () => {
        const base = { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 }
        const doc = referenceCharacter(content, {
          klass: c.klass,
          edition,
          level: 5,
          scores: { ...base, ...c.scores },
          gear: [...c.gear, c.weapon].map((g) => `${g}_${edition}`)
        })
        const r = evaluate(fiveE, 'personaje', doc)
        const weapon = r.items[`${c.weapon}_${edition}`] as { ataque?: number } | undefined
        expect({
          ca: r.values.ca,
          ataque: weapon?.ataque,
          pg: r.values.pg_max,
          ...(c.want.cd ? { cd: r.values.cd_conjuros } : {})
        }).toEqual(c.want)
      })
})
