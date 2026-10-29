import { ForbiddenError, NotFoundError } from '@crisol/domain'
import { describe, expect, it } from 'vitest'
import { InvalidRequestError } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'
import { errorText, MCP_TOOLS } from './tools.ts'

describe('herramientas MCP', () => {
  it('cada herramienta apunta a una acción que existe, con nombre en español', () => {
    for (const [tool, action] of Object.entries(MCP_TOOLS)) {
      expect(tool).toMatch(/^[a-z]+(_[a-z]+)*$/)
      expect(implementationsByName.has(action)).toBe(true)
    }
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
