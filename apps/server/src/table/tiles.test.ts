import { FogGrid } from '@crisol/tabletop'
import { describe, expect, it } from 'vitest'
import { screenTileAllowed } from './routes.ts'

// Un mapa de 3000 × 2000 en teselas de 512: el nivel 0 (6 × 4) y los reducidos hasta caber en 1024
const scene = { width: 3000, height: 2000, tileSize: 512 }

/** Lo explorado: solo un rincón de la primera tesela del nivel 0 */
const corner = () => new FogGrid(3000, 2000, 10).fillRect({ x: 0, y: 0, width: 200, height: 200 })

describe('las teselas que puede cargar la pantalla', () => {
  it('nada de lo que no toca lo explorado', () => {
    expect(screenTileAllowed(corner(), scene, { level: 0, x: 3, y: 2 }, 'whole')).toBe('deny')
  })

  it('con «enteras», la del borde del nivel de más detalle va entera', () => {
    expect(screenTileAllowed(corner(), scene, { level: 0, x: 0, y: 0 }, 'whole')).toBe('whole')
    expect(screenTileAllowed(corner(), scene, { level: 0, x: 0, y: 0 }, 'cropped')).toBe('crop')
  })

  it('las de los niveles reducidos se recortan siempre: si no, la tele tendría el mapa entero en pequeño', () => {
    expect(screenTileAllowed(corner(), scene, { level: 1, x: 0, y: 0 }, 'whole')).toBe('crop')
    expect(screenTileAllowed(corner(), scene, { level: 2, x: 0, y: 0 }, 'whole')).toBe('crop')
  })

  it('lo explorado entero va entero en cualquier nivel', () => {
    const all = new FogGrid(3000, 2000, 10).fill(true)
    expect(screenTileAllowed(all, scene, { level: 2, x: 0, y: 0 }, 'cropped')).toBe('whole')
  })
})
