import { describe, expect, it } from 'vitest'
import { type Row, type RowChange, staleChange, undoBlocker, undoSteps } from './undo.ts'

const world = (version: number, name: string): Row => ({ id: 'w1', name, version })
const member = (version = 1): Row => ({ id: 'm1', campaign_id: 'c1', user_id: 'u2', role: 'player', version })

/** Las filas de ahora, por tabla e id */
const current =
  (rows: Record<string, Row | null>) =>
  (tableName: string, rowId: string): Row | null =>
    rows[`${tableName}/${rowId}`] ?? null

const create: RowChange = { tableName: 'worlds', rowId: 'w1', before: null, after: world(1, 'Eana') }
const rename: RowChange = { tableName: 'worlds', rowId: 'w1', before: world(1, 'Eana'), after: world(2, 'Eana 2') }
const join: RowChange = { tableName: 'campaign_members', rowId: 'm1', before: null, after: member() }
const expel: RowChange = { tableName: 'campaign_members', rowId: 'm1', before: member(), after: null }

describe('deshacer', () => {
  describe('qué se puede deshacer', () => {
    it('lo de una persona o de la IA, si aún no se deshizo', () => {
      expect(undoBlocker({ via: 'ui', undoneById: null })).toBeNull()
      expect(undoBlocker({ via: 'ai', undoneById: null })).toBeNull()
    })

    it('lo ya deshecho no se vuelve a deshacer (se deshace el deshacer)', () => {
      expect(undoBlocker({ via: 'ui', undoneById: 'op-2' })).toBe('ALREADY_UNDONE')
    })

    it('lo del sistema (crear la organización, el propietario) no se deshace', () => {
      expect(undoBlocker({ via: 'system', undoneById: null })).toBe('NOT_UNDOABLE')
    })
  })

  describe('los pasos inversos, del último cambio al primero', () => {
    it('crear se deshace quitando lo creado', () => {
      expect(undoSteps([create, join])).toEqual([
        { kind: 'remove', tableName: 'campaign_members', rowId: 'm1' },
        { kind: 'remove', tableName: 'worlds', rowId: 'w1' }
      ])
    })

    it('renombrar se deshace dejando la fila como estaba, con su versión', () => {
      expect(undoSteps([rename])).toEqual([{ kind: 'restore', tableName: 'worlds', row: world(1, 'Eana') }])
    })

    it('expulsar se deshace volviendo a poner la misma fila, con el mismo id', () => {
      expect(undoSteps([expel])).toEqual([{ kind: 'restore', tableName: 'campaign_members', row: member() }])
    })

    it('deshacer lo deshecho vuelve a aplicarlo: los pasos de un deshacer son los del original', () => {
      // El deshacer de un renombrado cambió la fila de v2 a v1; deshacerlo la deja otra vez en v2
      const undo: RowChange = { tableName: 'worlds', rowId: 'w1', before: world(2, 'Eana 2'), after: world(1, 'Eana') }
      expect(undoSteps([undo])).toEqual([{ kind: 'restore', tableName: 'worlds', row: world(2, 'Eana 2') }])
    })
  })

  describe('conflictos: nunca se pisa lo que se cambió después', () => {
    it('si cada fila está como la dejó la operación, no hay conflicto', () => {
      expect(staleChange([rename], current({ 'worlds/w1': world(2, 'Eana 2') }))).toBeNull()
      expect(staleChange([expel], current({}))).toBeNull()
    })

    it('si otra operación la cambió después (otra versión), ese es el conflicto', () => {
      expect(staleChange([create], current({ 'worlds/w1': world(2, 'Eana 2') }))).toBe(create)
    })

    it('si lo creado ya no está, o lo quitado ha vuelto, también', () => {
      expect(staleChange([join], current({}))).toBe(join)
      expect(staleChange([expel], current({ 'campaign_members/m1': member(1) }))).toBe(expel)
    })

    it('se mira cada fila: basta una cambiada para no tocar nada', () => {
      const other: RowChange = { tableName: 'campaign_members', rowId: 'm1', before: null, after: member() }
      expect(staleChange([create, other], current({ 'worlds/w1': world(1, 'Eana') }))).toBe(other)
    })
  })
})
