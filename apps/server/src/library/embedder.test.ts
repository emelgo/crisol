import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { modelEmbedder } from './embedder.ts'

const DIR = join(import.meta.dirname, '..', '..', '..', '..', 'datos-locales', 'modelos', 'multilingual-e5-small')
const embedder = modelEmbedder({ dir: DIR, idleMs: 1000 })
const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0)

describe('el modelo de la búsqueda por significado (docs/specs/biblioteca.md)', () => {
  it('sin sus archivos, no hay modelo', () => {
    expect(modelEmbedder({ dir: '/no/existe' })).toBeNull()
  })

  // Con el modelo de verdad (datos-locales/modelos, fuera de git): lo que significa lo mismo, más cerca
  it.skipIf(!embedder)(
    'vectores de 384, normalizados; lo parecido, más cerca; se descarga y se vuelve a cargar',
    async () => {
      if (!embedder) return
      const [query] = await embedder.embed(['¿qué hace la guardia de la ciudad?'], 'query')
      const [near, far] = await embedder.embed(
        [
          'Los vigilantes patrullan las murallas de noche y tocan una campana cada hora.',
          'La receta lleva harina, huevos y una pizca de sal.'
        ],
        'passage'
      )
      if (!query || !near || !far) throw new Error('sin vectores')
      expect(query).toHaveLength(384)
      expect(Math.hypot(...query)).toBeCloseTo(1, 5)
      expect(cosine(query, near)).toBeGreaterThan(cosine(query, far))
      // Tras un rato sin uso, se descarga; pedirle otra vez lo carga
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const [again] = await embedder.embed(['¿qué hace la guardia de la ciudad?'], 'query')
      expect(again?.[0]).toBeCloseTo(query[0] as number, 5)
      await embedder.close()
    },
    60_000
  )
})
