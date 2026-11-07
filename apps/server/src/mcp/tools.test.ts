import { ForbiddenError, NotFoundError } from '@crisol/domain'
import { toFile } from '@crisol/systems'
import { fronteras } from '@crisol/systems/fixtures'
import { describe, expect, it } from 'vitest'
import { UI_ONLY } from '../actions/ai.ts'
import { InvalidRequestError } from '../actions/context.ts'
import { errorText } from './approvals.ts'
import { MCP_TOOLS, type McpTool, routeCall, toolActions, toolConfig } from './tools.ts'

describe('herramientas MCP', () => {
  it('cada herramienta lleva a acciones que existen, con nombre en español', () => {
    for (const [name, tool] of Object.entries(MCP_TOOLS)) {
      expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/)
      expect(toolActions(tool).length).toBeGreaterThan(0)
    }
  })

  it('las del módulo 0, las de la wiki, las de las plantillas, las de los dados y las de los sistemas (con su contenido)', () => {
    expect(Object.keys(MCP_TOOLS).sort()).toEqual([
      'abrir_escena',
      'abrir_puerta',
      'acabar_combate',
      'aplicar_tirada',
      'borrar_contenido',
      'borrar_encuentro',
      'borrar_etiqueta',
      'borrar_pagina',
      'borrar_personaje',
      'borrar_pestana',
      'borrar_plantilla',
      'borrar_sistema',
      'buscar_contenido',
      'buscar_libros',
      'buscar_paginas',
      'camara_pantalla',
      'cambiar_campana',
      'cambiar_escena',
      'cambiar_etiqueta',
      'cambiar_ficha',
      'cambiar_grupo',
      'cambiar_mapa',
      'cambiar_mundo',
      'cambiar_muros',
      'cambiar_panel',
      'cambiar_personaje',
      'cambiar_pestana',
      'cambiar_pin',
      'cambiar_plantilla',
      'cambiar_sistema',
      'cambiar_tabla',
      'compendio_campana',
      'copiar_contenido',
      'crear_campana',
      'crear_etiqueta',
      'crear_mundo',
      'crear_paginas',
      'crear_personaje',
      'crear_pestana',
      'crear_plantilla',
      'crear_sistema',
      'dejar_editar',
      'deshacer',
      'dibujar_escena',
      'editar_pagina',
      'elegir_personaje',
      'empezar_combate',
      'enlace_invitacion',
      'enlaces_pagina',
      'escribir_iniciativa',
      'etiquetar_archivo',
      'formato_sistemas',
      'guardar_contenido',
      'guardar_encuentro',
      'imagen_escena',
      'leer_compendio',
      'leer_contenido',
      'leer_libro',
      'leer_pagina',
      'listar_archivos',
      'listar_etiquetas',
      'listar_mundos',
      'listar_personajes',
      'listar_plantillas',
      'listar_sistemas',
      'lo_que_sabe',
      'marcar_conocimiento',
      'meter_en_combate',
      'monedas_grupo',
      'mover_en_grupo',
      'mover_fichas',
      'mover_pagina',
      'niebla',
      'ocultar',
      'ocultar_criatura',
      'ocultar_pantalla',
      'ordenar_subpaginas',
      'origen_contenido',
      'oscuridad',
      'paginas_recientes',
      'partida_criatura',
      'partida_personaje',
      'pendientes',
      'poner_en_juego',
      'poner_encuentro',
      'poner_fichas',
      'poner_pin',
      'presentar_escena',
      'probar_accion',
      'probar_formula',
      'probar_tirada',
      'quien_conoce',
      'quitar_de_juego',
      'quitar_fichas',
      'quitar_pin',
      'reiniciar_tabla',
      'reiniciar_tabla_compendio',
      'restaurar_personaje',
      'restaurar_version',
      'revelar',
      'sacar_de_combate',
      'siguiente_turno',
      'tirar_dados',
      'tirar_en_tabla',
      'tirar_iniciativa',
      'tirar_por_criatura',
      'tirar_por_personaje',
      'tirar_tabla_compendio',
      'traer_original',
      'turno_anterior',
      'validar_sistema',
      'ver_a_la_vista',
      'ver_arbol',
      'ver_biblioteca',
      'ver_campana',
      'ver_combate',
      'ver_como_grupo',
      'ver_como_jugador',
      'ver_criatura',
      'ver_en_juego',
      'ver_encuentros',
      'ver_escena',
      'ver_escenas',
      'ver_grupo',
      'ver_historial',
      'ver_mapa',
      'ver_mesa',
      'ver_muros',
      'ver_personaje',
      'ver_pestanas',
      'ver_plantilla',
      'ver_sistema',
      'ver_tabla',
      'ver_tiradas',
      'versiones_pagina',
      'versiones_personaje'
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

  it('niebla: destapar o tapar una zona, o reiniciarla (las dos, de las que ven los jugadores)', () => {
    const tool = MCP_TOOLS.niebla
    if (!tool) throw new Error('falta niebla')
    const campaignId = crypto.randomUUID()
    const area = { mode: 'reveal', shape: 'area', column: 1, row: 2, columns: 3, rows: 1 }
    const reveal = routeCall(tool, { campaignId, ...area })
    expect([reveal.impl.action.name, reveal.impl.action.kind, reveal.input]).toEqual([
      'changeFog',
      'players',
      { campaignId, ...area }
    ])
    const reset = routeCall(tool, { campaignId, reset: true })
    expect([reset.impl.action.name, reset.input]).toEqual(['resetFog', { campaignId }])
    // Una forma sin sus datos no pasa
    expect(() => routeCall(tool, { campaignId, mode: 'cover', shape: 'rectangle' })).toThrow()
  })

  it('ver_sistema: entero o por partes; crear_sistema: copiando, con su documento o desde un archivo', () => {
    const { ver_sistema, crear_sistema } = MCP_TOOLS
    if (!ver_sistema || !crear_sistema) throw new Error('faltan herramientas de sistemas')
    const route = (tool: McpTool, input: Record<string, unknown>) => {
      const { impl, input: given } = routeCall(tool, input)
      return [impl.action.name, given]
    }
    expect(route(ver_sistema, { systemId: 'blank' })).toEqual(['getSystem', { systemId: 'blank' }])
    expect(route(ver_sistema, { systemId: 'blank', parts: ['dice'] })).toEqual([
      'getSystemParts',
      { systemId: 'blank', parts: ['dice'] }
    ])
    expect(route(crear_sistema, { name: 'Fronteras' })).toEqual(['createSystem', { name: 'Fronteras', from: 'blank' }])
    const [action, input] = route(crear_sistema, { document: fronteras, name: 'Fronteras del norte' })
    expect(action).toBe('createSystem')
    expect(input).toMatchObject({ document: fronteras, name: 'Fronteras del norte' })
    expect(route(crear_sistema, { file: toFile(fronteras, []) })[0]).toBe('importSystem')
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
