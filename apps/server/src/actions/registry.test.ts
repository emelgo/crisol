import { ACTIONS } from '@crisol/contracts'
import { describe, expect, it } from 'vitest'
import { IMPLEMENTATIONS } from './routes.ts'

describe('registro de acciones', () => {
  it('cada acción del contrato tiene su servicio y no hay servicios sin contrato', () => {
    expect(IMPLEMENTATIONS.map((impl) => impl.action.name).sort()).toEqual(ACTIONS.map((a) => a.name).sort())
  })

  it('cada servicio usa la definición del contrato, no una copia', () => {
    for (const impl of IMPLEMENTATIONS) expect(ACTIONS).toContain(impl.action)
  })
})
