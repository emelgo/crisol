import { describe, expect, it } from 'vitest'
import { fiveE } from './examples/5e/system.ts'
import { exampleContent } from './examples/content.ts'
import type { Mechanics } from './mechanics.ts'
import { formulaText, mechanicsText } from './mechanics-text.ts'

const content = exampleContent('5e')
const of = (key: string) => {
  const item = content.find((i) => i.key === key)
  if (!item) throw new Error(`Falta ${key}`)
  return mechanicsText(fiveE, item.type, item.mechanics as Mechanics, 'es')
}

describe('la mecánica en palabras', () => {
  it('un conjuro: su acción, su salvación con su CD, su daño con su tipo y cómo escala', () => {
    expect(of('bola_de_fuego_2024')).toMatchObject({
      actions: [
        {
          label: 'Bola de fuego',
          parts: ['Acción', 'Salvación de Destreza (CD de salvación), mitad si la supera', '8d6 (fuego)']
        }
      ],
      scaling: 'Con un espacio de más nivel que el 3: +1d6 por cada nivel de más',
      automation: 'partial'
    })
  })

  it('un rasgo: sus usos con su escala por nivel, lo que cambia mientras está activo y que se activa', () => {
    const rage = of('barbaro_furia_2024')
    expect(rage?.resources[0]).toEqual({
      label: 'Furias',
      parts: [
        'Como mucho, 2, 3 desde el 3, 4 desde el 6, 5 desde el 12, 6 desde el 17 (según nivel de su clase)',
        'se recupera con un descanso largo'
      ]
    })
    expect(rage?.effects).toEqual(
      expect.arrayContaining([
        'Bono al daño con Fuerza: +2, 3 desde el 9, 4 desde el 16 (según nivel de su clase) (mientras está activo)',
        'Ventaja en Prueba de característica (Fuerza) (mientras está activo)',
        'Resistencias: añade contundente (mientras está activo)'
      ])
    )
    expect(rage?.toggle).toBe('Se activa y se desactiva (1 minuto)')
  })

  it('una dote que suma; un objeto con cargas que vuelven con dados', () => {
    expect(of('alerta_2024')?.effects).toEqual([expect.stringMatching(/^.+: \+Bonificador por competencia$/)])
    expect(of('varita_de_bolas_de_fuego_2024')?.resources[0]).toEqual({
      label: 'Cargas',
      parts: ['Como mucho, 7', 'se recupera al amanecer', 'vuelven 1d6 + 1']
    })
  })

  it('una criatura, con lo suyo: su ataque y su daño ya calculados', () => {
    const wolf = content.find((i) => i.key === 'lobo_2024')
    if (!wolf) throw new Error('Falta el lobo')
    const text = mechanicsText(fiveE, wolf.type, wolf.mechanics as Mechanics, 'es', { data: wolf.data })
    const bite = text?.actions.find((a) => a.label === 'Mordisco')
    expect(bite?.parts).toContain('Ataque +4')
    expect(bite?.parts.join(' · ')).toMatch(/1d6 ?\+ ?2 \(perforante\)/)
  })

  it('sin mecánica, nada; en inglés, en inglés', () => {
    expect(mechanicsText(fiveE, 'conjuro', undefined)).toBeNull()
    const fireball = content.find((i) => i.key === 'bola_de_fuego_2024')
    expect(mechanicsText(fiveE, 'conjuro', fireball?.mechanics as Mechanics, 'en')?.actions[0]?.parts[0]).toBe('Action')
  })

  it('las fórmulas, con los nombres de sus campos', () => {
    const say = (formula: string) => formulaText(formula, { system: fiveE, type: 'dote', language: 'es' })
    expect(say('@caracteristicas.des.mod + @competencia')).toBe('Modificador de Destreza + Bonificador por competencia')
    expect(say('max(1, @nivel) * 2')).toBe('el mayor de 1, Nivel × 2')
    expect(say('@nivel >= 5 ? 2 : 1')).toBe('2 si Nivel ≥ 5; si no, 1')
    expect(say('@nivel + -1')).toBe('Nivel − 1')
    expect(say('(((')).toBe('(((')
  })
})
