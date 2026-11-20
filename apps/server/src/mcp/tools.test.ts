import { ForbiddenError, NotFoundError } from '@crisol/domain'
import { toFile } from '@crisol/systems'
import { fronteras } from '@crisol/systems/fixtures'
import { describe, expect, it } from 'vitest'
import { UI_ONLY } from '../actions/ai.ts'
import { InvalidRequestError } from '../actions/context.ts'
import { errorText, success } from './approvals.ts'
import { INSTRUCTIONS, MCP_TOOLS, type McpTool, routeCall, toolActions, toolConfig, toolWords } from './tools.ts'

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
      'actividad_campana',
      'aplicar_tirada',
      'asignar_ficha',
      'borrar_calendario',
      'borrar_capitulo',
      'borrar_carpeta_actores',
      'borrar_carpeta_plantillas',
      'borrar_contenido',
      'borrar_cronologia',
      'borrar_encuentro',
      'borrar_escena',
      'borrar_etiqueta',
      'borrar_evento',
      'borrar_instantanea',
      'borrar_libro',
      'borrar_mensaje',
      'borrar_pagina',
      'borrar_personaje',
      'borrar_pestana',
      'borrar_plantilla',
      'borrar_sistema',
      'borrar_tiradas',
      'borrar_widget',
      'buscar_contenido',
      'buscar_libros',
      'buscar_paginas',
      'camara_pantalla',
      'cambiar_calendario',
      'cambiar_campana',
      'cambiar_capa',
      'cambiar_carpeta_plantillas',
      'cambiar_clima',
      'cambiar_cronologia',
      'cambiar_dibujo',
      'cambiar_escena',
      'cambiar_etiqueta',
      'cambiar_evento',
      'cambiar_fecha',
      'cambiar_ficha',
      'cambiar_grupo',
      'cambiar_grupos_eventos',
      'cambiar_libro',
      'cambiar_lista_sonido',
      'cambiar_mapa',
      'cambiar_marcas',
      'cambiar_mundo',
      'cambiar_muros',
      'cambiar_panel',
      'cambiar_personaje',
      'cambiar_pestana',
      'cambiar_pin',
      'cambiar_pizarra',
      'cambiar_plantilla',
      'cambiar_sistema',
      'cambiar_sonido_escena',
      'cambiar_tabla',
      'cambiar_widget',
      'capitulos_libro',
      'compendio_campana',
      'controles_sala',
      'convertir_en_pagina',
      'copiar_contenido',
      'crear_arbol_genealogico',
      'crear_calendario',
      'crear_campana',
      'crear_capa',
      'crear_carpeta_actores',
      'crear_carpeta_plantillas',
      'crear_cronologia',
      'crear_escena',
      'crear_etiqueta',
      'crear_eventos',
      'crear_libro',
      'crear_lista_sonido',
      'crear_mundo',
      'crear_paginas',
      'crear_personaje',
      'crear_pestana',
      'crear_plantilla',
      'crear_sistema',
      'crear_widget',
      'dejar_editar',
      'dejar_volver',
      'describir_fecha',
      'deshacer',
      'dibujar_en_mapa',
      'dibujar_escena',
      'duplicar_pagina',
      'echar_de_la_mesa',
      'editar_arbol_genealogico',
      'editar_pagina',
      'elegir_personaje',
      'empezar_combate',
      'enlace_invitacion',
      'enlaces_pagina',
      'ensenar_imagen',
      'ensenar_pagina',
      'entradas_libro',
      'escribir_en_registro',
      'escribir_iniciativa',
      'escribir_nota',
      'etiquetar_archivo',
      'etiquetar_archivos',
      'fecha_de_hoy',
      'fichas_en_plantilla',
      'formato_sistemas',
      'grafo_mundo',
      'guardar_capitulo',
      'guardar_contenido',
      'guardar_encuentro',
      'guardar_instantanea',
      'imagen_escena',
      'imagen_mapa',
      'leer_capitulo',
      'leer_compendio',
      'leer_contenido',
      'leer_libro',
      'leer_nota',
      'leer_pagina',
      'listar_archivos',
      'listar_calendarios',
      'listar_cronologias',
      'listar_etiquetas',
      'listar_iconos',
      'listar_mundos',
      'listar_personajes',
      'listar_plantillas',
      'listar_sistemas',
      'lo_que_sabe',
      'marcar_conocimiento',
      'medir',
      'medir_mapa',
      'meter_en_combate',
      'monedas_grupo',
      'mover_a_carpeta',
      'mover_archivos',
      'mover_en_grupo',
      'mover_etiqueta',
      'mover_fichas',
      'mover_pagina',
      'mover_plantilla',
      'niebla',
      'ocultar',
      'ocultar_criatura',
      'ocultar_pantalla',
      'ordenar_capitulos',
      'ordenar_subpaginas',
      'origen_contenido',
      'oscuridad',
      'paginas_recientes',
      'parar_sonido',
      'partida_criatura',
      'partida_personaje',
      'pendientes',
      'planear_viaje',
      'poner_en_juego',
      'poner_encuentro',
      'poner_fichas',
      'poner_pin',
      'poner_plantilla',
      'poner_sonido',
      'poner_sonido_escena',
      'presentar_escena',
      'probar_accion',
      'probar_formula',
      'probar_tirada',
      'proponer_contenido',
      'quien_conoce',
      'quitar_capa',
      'quitar_de_juego',
      'quitar_de_la_vista',
      'quitar_dibujo',
      'quitar_fichas',
      'quitar_pin',
      'quitar_sonido_escena',
      'reiniciar_tabla',
      'reiniciar_tabla_compendio',
      'relaciones_pagina',
      'renombrar_carpeta_actores',
      'renombrar_escena',
      'restaurar_personaje',
      'restaurar_version',
      'revelar',
      'sacar_de_combate',
      'siguiente_turno',
      'tirar_accion_compendio',
      'tirar_dados',
      'tirar_en_tabla',
      'tirar_iniciativa',
      'tirar_por_criatura',
      'tirar_por_personaje',
      'tirar_tabla_compendio',
      'traer_original',
      'turno_anterior',
      'vaciar_registro',
      'validar_sistema',
      'ver_a_la_vista',
      'ver_arbol',
      'ver_arbol_genealogico',
      'ver_biblioteca',
      'ver_calendario',
      'ver_campana',
      'ver_carpetas_actores',
      'ver_clima',
      'ver_combate',
      'ver_como_grupo',
      'ver_como_jugador',
      'ver_criatura',
      'ver_cronologia',
      'ver_en_juego',
      'ver_encuentros',
      'ver_escena',
      'ver_escenas',
      'ver_grupo',
      'ver_historial',
      'ver_instantaneas',
      'ver_libros',
      'ver_mapa',
      'ver_marcas',
      'ver_mesa',
      'ver_muros',
      'ver_notas',
      'ver_pendientes',
      'ver_personaje',
      'ver_pestanas',
      'ver_pizarra',
      'ver_plantilla',
      'ver_registro',
      'ver_sala',
      'ver_sistema',
      'ver_sonido',
      'ver_tabla',
      'ver_tiradas',
      'ver_widgets',
      'versiones_pagina',
      'versiones_personaje',
      'volumen_sonido',
      'volver_a_instantanea'
    ])
  })

  it('las instrucciones solo nombran herramientas (o la guía de mapas) que existen, y nada de lo quitado', () => {
    const named = [...INSTRUCTIONS.matchAll(/\b([a-z]+(?:_[a-z]+)+)\b/g)].map((m) => m[1] ?? '')
    const known = new Set([...Object.keys(MCP_TOOLS), 'guia_mapas'])
    expect(named.filter((name) => !known.has(name))).toEqual([])
    // Lo que ya no es verdad: sin editor de sistemas, sistemas o plantillas de serie, tiradas que se pulsan en la wiki
    for (const gone of ['No tiene editor', 'de serie', 'plantillas que trae', 'dice: se pulsa'])
      expect(INSTRUCTIONS).not.toContain(gone)
  })

  it('las descripciones nombran las herramientas que ve la IA, no las acciones de los contratos', () => {
    expect(toolWords('Sin su texto: léelos con getChapter; se cambia con updateSystem')).toBe(
      'Sin su texto: léelos con leer_capitulo; se cambia con cambiar_sistema'
    )
    const capitulos = MCP_TOOLS.capitulos_libro
    if (!capitulos) throw new Error('falta capitulos_libro')
    expect(toolConfig(capitulos).description).toContain('leer_capitulo')
    // Ninguna descripción nombra una acción que tenga herramienta
    const actions = new Set(Object.values(MCP_TOOLS).flatMap((t) => ('route' in t ? t.actions : [t.action])))
    for (const tool of Object.values(MCP_TOOLS))
      for (const word of toolConfig(tool).description.match(/\b[a-z]+[A-Z][A-Za-z]*\b/g) ?? [])
        expect(actions.has(word), word).toBe(false)
  })

  it('dibujar_en_mapa: los píxeles de la imagen que vio, a 0–1, simplificados y pegando a lo cercano', () => {
    const tool = MCP_TOOLS.dibujar_en_mapa as McpTool
    const mapId = crypto.randomUUID()
    const { impl, input } = routeCall(tool, {
      mapId,
      kind: 'region',
      label: 'Reino de Varn',
      view: { width: 1600, height: 1000 },
      geometry: {
        pieces: [
          [
            [160, 100],
            [800, 100],
            [800, 500],
            [480, 500],
            [160, 500]
          ]
        ]
      }
    })
    expect(impl.action.name).toBe('createMapElement')
    expect(input).toMatchObject({
      mapId,
      label: 'Reino de Varn',
      snap: true,
      geometry: {
        pieces: [
          [
            [0.1, 0.1],
            [0.5, 0.1],
            [0.5, 0.5],
            [0.1, 0.5]
          ]
        ]
      }
    })
    // cambiar_dibujo sin forma no la toca (ni pega nada)
    const redraw = routeCall(MCP_TOOLS.cambiar_dibujo as McpTool, { elementId: mapId, label: 'Varn' })
    expect(redraw.input).toEqual({ elementId: mapId, label: 'Varn' })
  })

  it('una imagen en lo que contesta (imagen_mapa) va como imagen, y en lo demás sin sus datos', () => {
    const result = success({
      width: 2,
      height: 1,
      image: { mimeType: 'image/png', data: 'aGVsbG8=' },
      note: 'Mide 2 × 1'
    })
    expect(result.content[0]).toEqual({ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' })
    expect(result.structuredContent).toEqual({
      width: 2,
      height: 1,
      image: { mimeType: 'image/png' },
      note: 'Mide 2 × 1'
    })
    expect(JSON.stringify(result.content[1])).not.toContain('aGVsbG8=')
    expect(success({ a: 1 }).content).toEqual([{ type: 'text', text: '{\n  "a": 1\n}' }])
  })

  it('la IA no puede aprobar lo suyo, ni cambiar su modo, ni quitar conexiones: no hay herramienta para eso', () => {
    for (const tool of Object.values(MCP_TOOLS)) {
      for (const impl of toolActions(tool)) expect(UI_ONLY.has(impl.action.name)).toBe(false)
    }
    expect([...UI_ONLY].sort()).toEqual([
      'approve',
      'createApiToken',
      'deleteApiToken',
      'listApiTokens',
      'reject',
      'removeAiConnection',
      'setAiMode'
    ])
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

  it('cambiar_clima: un día a mano, la zona y la latitud o la capa de la Mesa; planear_viaje: con advance, viajar', () => {
    const { cambiar_clima, planear_viaje } = MCP_TOOLS
    if (!cambiar_clima || !planear_viaje) throw new Error('faltan herramientas del clima')
    const campaignId = crypto.randomUUID()
    const route = (tool: McpTool, input: Record<string, unknown>) => {
      const { impl, input: given } = routeCall(tool, input)
      return [impl.action.name, given]
    }
    const snow = { condition: 'snow', low: -4, high: 0, wind: 'gale', windDirection: 'N' }
    expect(route(cambiar_clima, { campaignId, weather: snow })).toEqual([
      'setDayWeather',
      { campaignId, weather: snow }
    ])
    expect(route(cambiar_clima, { campaignId, date: '1250-Siega-18', weather: null })).toEqual([
      'setDayWeather',
      { campaignId, weather: null, date: '1250-Siega-18' }
    ])
    expect(route(cambiar_clima, { campaignId, zone: 'polar' })).toEqual([
      'setCampaignClimate',
      { campaignId, zone: 'polar' }
    ])
    expect(route(cambiar_clima, { campaignId, layer: { mode: 'none' } })).toEqual([
      'setWeatherLayer',
      { campaignId, layer: { mode: 'none' } }
    ])
    expect(() => route(cambiar_clima, { campaignId })).toThrow()
    const [planned, plan] = route(planear_viaje, { campaignId, distance: 90, medium: 'horse', zone: 'coast' })
    expect(planned).toBe('planTravel')
    expect(plan).toMatchObject({ campaignId, distance: 90, medium: 'horse' })
    expect(plan).not.toHaveProperty('zone')
    const [done, travelled] = route(planear_viaje, { campaignId, distance: 90, advance: true, zone: 'coast' })
    expect([done, travelled]).toMatchObject(['travel', { campaignId, distance: 90, zone: 'coast' }])
    expect(travelled).not.toHaveProperty('advance')
    expect(MCP_TOOLS.fecha_de_hoy && toolConfig(MCP_TOOLS.fecha_de_hoy)).toHaveProperty('outputSchema')
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
