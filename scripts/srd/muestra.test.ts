import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../packages/systems/src/file.ts'
import { report, sample, seeded } from './muestra.ts'

describe('la muestra para revisar el contenido', () => {
  it('al azar con semilla: siempre la misma, sin repetir', () => {
    expect(sample([1, 2, 3, 4, 5], 3, seeded(7))).toEqual(sample([1, 2, 3, 4, 5], 3, seeded(7)))
    expect(new Set(sample([1, 2, 3, 4, 5], 5, seeded(7))).size).toBe(5)
    expect(sample([1, 2], 5, seeded(1))).toHaveLength(2)
  })

  it('por tipo, cada documento con sus páginas, su automatización y lo primero de su texto', () => {
    const item = (key: string, type: string): ContentItem =>
      ({
        type,
        key,
        source: 'srd521',
        concept: key,
        data: { name: { es: `Nombre ${key}`, en: `Name ${key}` }, descripcion: { es: 'Un texto.', en: 'A text.' } },
        mechanics: { automation: 'full' },
        ref: { pages: { es: 100, en: 92 } }
      }) as ContentItem
    const text = report([item('a', 'arma'), item('b', 'estado')], 20, 1)
    expect(text).toContain('## Arma')
    expect(text).toContain('- [ ] **Nombre a** / Name a — 2024, pág. 100 (es) y 92 (en); full\n  > Un texto.…')
    expect(text).toContain('## Estado')
  })
})
