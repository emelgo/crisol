import { ForbiddenError, NotFoundError } from '@crisol/domain'
import { describe, expect, it } from 'vitest'
import { UI_ONLY } from '../actions/ai.ts'
import { InvalidRequestError } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'
import { errorText } from './approvals.ts'
import { MCP_TOOLS, toolConfig } from './tools.ts'

describe('herramientas MCP', () => {
  it('cada herramienta apunta a una acción que existe, con nombre en español', () => {
    for (const [tool, action] of Object.entries(MCP_TOOLS)) {
      expect(tool).toMatch(/^[a-z]+(_[a-z]+)*$/)
      expect(implementationsByName.has(action)).toBe(true)
    }
  })

  it('la IA no puede aprobar lo suyo ni cambiar su modo: no hay herramienta para eso', () => {
    for (const action of Object.values(MCP_TOOLS)) expect(UI_ONLY.has(action)).toBe(false)
    expect([...UI_ONLY].sort()).toEqual(['approve', 'reject', 'setAiMode'])
  })

  it('solo las de leer anuncian qué devuelven: las demás pueden contestar «esperando la aprobación»', () => {
    const read = implementationsByName.get('listWorlds')
    const write = implementationsByName.get('createCampaign')
    if (!read || !write) throw new Error('faltan acciones')
    expect(toolConfig(read)).toHaveProperty('outputSchema')
    expect(toolConfig(write)).not.toHaveProperty('outputSchema')
  })

  it('a la IA le explica los errores de permisos con el código de la API', () => {
    expect(errorText(new NotFoundError('world'))).toMatch(/^NOT_FOUND/)
    expect(errorText(new ForbiddenError('world.rename'))).toMatch(/^FORBIDDEN/)
    expect(errorText(new InvalidRequestError('ORGANIZATION_REQUIRED'))).toBe('ORGANIZATION_REQUIRED')
  })

  it('un fallo inesperado no se tapa', () => {
    expect(() => errorText(new Error('base de datos caída'))).toThrow('base de datos caída')
  })
})
