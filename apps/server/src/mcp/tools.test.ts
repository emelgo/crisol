import { ForbiddenError, NotFoundError } from '@crisol/domain'
import { describe, expect, it } from 'vitest'
import { UI_ONLY } from '../actions/ai.ts'
import { InvalidRequestError } from '../actions/context.ts'
import { errorText } from './approvals.ts'
import { MCP_TOOLS, routeCall, toolActions, toolConfig } from './tools.ts'

describe('herramientas MCP', () => {
  it('cada herramienta lleva a acciones que existen, con nombre en español', () => {
    for (const [name, tool] of Object.entries(MCP_TOOLS)) {
      expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/)
      expect(toolActions(tool).length).toBeGreaterThan(0)
    }
  })

  it('las del módulo 0, las de la wiki y las de las plantillas', () => {
    expect(Object.keys(MCP_TOOLS).sort()).toEqual([
      'borrar_etiqueta',
      'borrar_pagina',
      'borrar_pestana',
      'borrar_plantilla',
      'buscar_paginas',
      'cambiar_campana',
      'cambiar_etiqueta',
      'cambiar_mapa',
      'cambiar_mundo',
      'cambiar_panel',
      'cambiar_pestana',
      'cambiar_pin',
      'cambiar_plantilla',
      'crear_campana',
      'crear_etiqueta',
      'crear_mundo',
      'crear_paginas',
      'crear_pestana',
      'crear_plantilla',
      'deshacer',
      'editar_pagina',
      'enlace_invitacion',
      'enlaces_pagina',
      'etiquetar_archivo',
      'leer_pagina',
      'listar_archivos',
      'listar_etiquetas',
      'listar_mundos',
      'listar_plantillas',
      'mover_pagina',
      'ordenar_subpaginas',
      'paginas_recientes',
      'pendientes',
      'poner_pin',
      'quitar_pin',
      'restaurar_version',
      'ver_arbol',
      'ver_campana',
      'ver_historial',
      'ver_mapa',
      'ver_pestanas',
      'ver_plantilla',
      'versiones_pagina'
    ])
  })

  it('la IA no puede aprobar lo suyo ni cambiar su modo: no hay herramienta para eso', () => {
    for (const tool of Object.values(MCP_TOOLS)) {
      for (const impl of toolActions(tool)) expect(UI_ONLY.has(impl.action.name)).toBe(false)
    }
    expect([...UI_ONLY].sort()).toEqual(['approve', 'reject', 'setAiMode'])
  })

  it('solo las de leer anuncian qué devuelven: las demás pueden contestar «esperando la aprobación»', () => {
    const { listar_mundos, crear_campana, enlace_invitacion } = MCP_TOOLS
    if (!listar_mundos || !crear_campana || !enlace_invitacion) throw new Error('faltan herramientas')
    expect(toolConfig(listar_mundos)).toHaveProperty('outputSchema')
    expect(toolConfig(crear_campana)).not.toHaveProperty('outputSchema')
    expect(toolConfig(enlace_invitacion)).not.toHaveProperty('outputSchema')
  })

  it('enlace_invitacion: sin cambio, leer; regenerar, abrir o cerrar, la acción de jugadores que toca', () => {
    const tool = MCP_TOOLS.enlace_invitacion
    if (!tool) throw new Error('falta enlace_invitacion')
    const campaignId = crypto.randomUUID()
    const route = (change?: string) => {
      const { impl, input } = routeCall(tool, change ? { campaignId, change } : { campaignId })
      return [impl.action.name, impl.action.kind, input]
    }
    expect(route()).toEqual(['getInvitation', 'read', { campaignId }])
    expect(route('regenerate')).toEqual(['regenerateInvitation', 'players', { campaignId }])
    expect(route('open')).toEqual(['setInvitationsOpen', 'players', { campaignId, open: true }])
    expect(route('close')).toEqual(['setInvitationsOpen', 'players', { campaignId, open: false }])
    expect(() => route('borrar')).toThrow()
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
