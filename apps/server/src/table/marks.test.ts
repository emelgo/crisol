/** Lo que la pantalla ve de las marcas: solo las que caen enteras en lo que el grupo ve o vio */
import type { tableToolsRepo } from '@crisol/db'
import { describe, expect, it } from 'vitest'
import { type Sight, screenMarksOf } from './marks.ts'

/** El grupo ve o vio la sala de la izquierda (x < 400) */
const room: Sight = { hasPoint: (p) => p.x >= 0 && p.x < 400 && p.y >= 0 && p.y < 400 }

const row = (kind: tableToolsRepo.MarkRow['kind'], data: Record<string, unknown>): tableToolsRepo.MarkRow => ({
  id: crypto.randomUUID(),
  version: 1,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  worldId: crypto.randomUUID(),
  campaignId: crypto.randomUUID(),
  sceneId: crypto.randomUUID(),
  kind,
  hidden: false,
  data: data as tableToolsRepo.MarkRow['data'],
  sort: 0
})

describe('las marcas en la pantalla', () => {
  it('una imagen, un sello o una plantilla que asoman a la niebla no llegan, aunque su centro se vea', () => {
    const marks = [
      row('image', { x: 300, y: 200, width: 400, height: 100, rotation: 0, fileId: crypto.randomUUID() }),
      row('stamp', { x: 350, y: 200, icon: 'skull', size: 200, color: '#ffffff' }),
      row('template', { shape: 'circle', a: { x: 300, y: 200 }, b: { x: 450, y: 200 }, color: '#ff0000' })
    ]
    expect(screenMarksOf(marks, room)).toEqual([])
  })

  it('las que caen enteras dentro, sí', () => {
    const marks = [
      row('image', { x: 200, y: 200, width: 100, height: 100, rotation: 30, fileId: crypto.randomUUID() }),
      row('stamp', { x: 200, y: 200, icon: 'skull', size: 50, color: '#ffffff' }),
      row('template', { shape: 'circle', a: { x: 200, y: 200 }, b: { x: 300, y: 200 }, color: '#ff0000' }),
      row('text', { x: 100, y: 100, text: 'Aquí', color: '#ffffff', size: 24 }),
      row('pin', { x: 50, y: 50, pageId: null, label: 'Cofre', icon: 'treasure' })
    ]
    expect(screenMarksOf(marks, room).map((m) => m.kind)).toEqual(['image', 'stamp', 'template', 'text', 'pin'])
  })
})
