import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { PLAYER_WRITES } from './approvals.ts'
import { CAMPAIGN_GUIDE, CAMPAIGN_MASTER_TOOLS, CAMPAIGN_PLAYER_TOOLS, scopedTools, withScope } from './connectors.ts'
import type { CampaignScope } from './scope.ts'
import { MCP_TOOLS, toolActions } from './tools.ts'

const scope = (role: CampaignScope['role']): CampaignScope => ({
  kind: 'campaign',
  campaignId: crypto.randomUUID(),
  worldId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  name: 'La Marca',
  role
})

const tool = (role: CampaignScope['role'], name: string) => {
  const found = scopedTools(scope(role)).find((t) => t.name === name)
  if (!found) throw new Error(`falta ${name}`)
  return found
}

/** Los conectores de IA (ADR-0030): qué ve cada uno */
describe('conectores MCP', () => {
  it('el del máster en su campaña: la Mesa, el registro, revelar, el hoy, las escenas, el combate, el sonido, el grupo y leer el mundo', () => {
    expect(
      scopedTools(scope('master'))
        .map((t) => t.name)
        .sort()
    ).toEqual([
      'abrir_escena',
      'abrir_puerta',
      'acabar_combate',
      'actividad_campana',
      'aplicar_tirada',
      'asignar_ficha',
      'borrar_carpeta_actores',
      'borrar_encuentro',
      'borrar_escena',
      'borrar_instantanea',
      'borrar_mensaje',
      'borrar_personaje',
      'borrar_tiradas',
      'borrar_widget',
      'buscar_contenido',
      'buscar_libros',
      'buscar_paginas',
      'camara_pantalla',
      'cambiar_clima',
      'cambiar_escena',
      'cambiar_fecha',
      'cambiar_ficha',
      'cambiar_grupo',
      'cambiar_lista_sonido',
      'cambiar_marcas',
      'cambiar_muros',
      'cambiar_personaje',
      'cambiar_sonido_escena',
      'cambiar_widget',
      'capitulos_libro',
      'compendio_campana',
      'controles_sala',
      'crear_carpeta_actores',
      'crear_escena',
      'crear_lista_sonido',
      'crear_personaje',
      'crear_widget',
      'dejar_editar',
      'dejar_volver',
      'describir_fecha',
      'dibujar_escena',
      'echar_de_la_mesa',
      'elegir_personaje',
      'empezar_combate',
      'enlaces_pagina',
      'ensenar_imagen',
      'ensenar_pagina',
      'escribir_en_registro',
      'escribir_iniciativa',
      'fecha_de_hoy',
      'fichas_en_plantilla',
      'grafo_mundo',
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
      'listar_personajes',
      'lo_que_sabe',
      'marcar_conocimiento',
      'medir',
      'medir_mapa',
      'meter_en_combate',
      'monedas_grupo',
      'mover_a_carpeta',
      'mover_en_grupo',
      'mover_fichas',
      'niebla',
      'ocultar',
      'ocultar_criatura',
      'ocultar_pantalla',
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
      'poner_plantilla',
      'poner_sonido',
      'poner_sonido_escena',
      'presentar_escena',
      'quien_conoce',
      'quitar_de_juego',
      'quitar_de_la_vista',
      'quitar_fichas',
      'quitar_sonido_escena',
      'reiniciar_tabla',
      'reiniciar_tabla_compendio',
      'relaciones_pagina',
      'renombrar_carpeta_actores',
      'renombrar_escena',
      'restaurar_personaje',
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
      'turno_anterior',
      'vaciar_registro',
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
      'ver_instantaneas',
      'ver_mapa',
      'ver_marcas',
      'ver_mesa',
      'ver_muros',
      'ver_notas',
      'ver_personaje',
      'ver_pestanas',
      'ver_pizarra',
      'ver_registro',
      'ver_sala',
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

  it('el de la jugadora: leer lo que sabe, su personaje, sus tiradas, el registro, sus notas, su página y el hoy', () => {
    expect(
      scopedTools(scope('player'))
        .map((t) => t.name)
        .sort()
    ).toEqual([
      'actividad_campana',
      'buscar_paginas',
      'cambiar_personaje',
      'capitulos_libro',
      'compendio_campana',
      'crear_personaje',
      'describir_fecha',
      'editar_pagina',
      'elegir_personaje',
      'enlaces_pagina',
      'escribir_en_registro',
      'escribir_nota',
      'fecha_de_hoy',
      'grafo_mundo',
      'imagen_mapa',
      'leer_capitulo',
      'leer_compendio',
      'leer_nota',
      'leer_pagina',
      'listar_calendarios',
      'listar_cronologias',
      'listar_personajes',
      'medir_mapa',
      'paginas_recientes',
      'partida_personaje',
      'pendientes',
      'relaciones_pagina',
      'restaurar_personaje',
      'tirar_dados',
      'tirar_por_personaje',
      'ver_a_la_vista',
      'ver_arbol',
      'ver_arbol_genealogico',
      'ver_calendario',
      'ver_campana',
      'ver_cronologia',
      'ver_grupo',
      'ver_mapa',
      'ver_notas',
      'ver_personaje',
      'ver_pestanas',
      'ver_pizarra',
      'ver_registro',
      'ver_tiradas',
      'versiones_personaje'
    ])
  })

  it('Mundos: todas para quien crea mundos; para quien solo juega, solo las de leer', () => {
    expect(scopedTools({ kind: 'worlds', readOnly: false }).map((t) => t.name)).toEqual(Object.keys(MCP_TOOLS))
    const reads = scopedTools({ kind: 'worlds', readOnly: true })
    expect(reads.length).toBeGreaterThan(50)
    for (const { name } of reads) {
      const found = MCP_TOOLS[name]
      if (!found) throw new Error(name)
      expect(
        toolActions(found).every((impl) => impl.action.kind === 'read'),
        name
      ).toBe(true)
    }
    expect(reads.map((t) => t.name)).not.toContain('crear_paginas')
  })

  it('sin repetidas, y todas existen', () => {
    for (const names of [CAMPAIGN_MASTER_TOOLS, CAMPAIGN_PLAYER_TOOLS]) {
      expect(new Set(names).size).toBe(names.length)
      for (const name of names) expect(MCP_TOOLS[name], name).toBeDefined()
    }
  })

  it('en una campaña, la IA no da la campaña ni el mundo: los pone el servidor', () => {
    for (const role of ['master', 'player'] as const) {
      const s = scope(role)
      for (const { name, config } of scopedTools(s)) {
        const keys = Object.keys((config.inputSchema as z.ZodObject).shape)
        expect(keys, name).not.toContain('campaignId')
        expect(keys, name).not.toContain('worldId')
      }
    }
    const s = scope('master')
    const today = tool('master', 'fecha_de_hoy').call({})
    expect(today.input).toEqual({ campaignId: expect.any(String) })
    // Aunque la IA intente otra
    const other = crypto.randomUUID()
    const input = z.object({ campaignId: z.uuid(), worldId: z.uuid(), x: z.int() })
    expect(withScope('x', input, { campaignId: other, worldId: other, x: 1 }, s)).toEqual({
      campaignId: s.campaignId,
      worldId: s.worldId,
      x: 1
    })
    // Un sonido del mapa: en la campaña al encenderlo o apagarlo; sin enabled, el del mundo
    const sound = z.object({ id: z.uuid(), campaignId: z.uuid().optional(), enabled: z.boolean().optional() })
    expect(withScope('cambiar_sonido_escena', sound, { id: other }, s)).toEqual({ id: other })
    expect(withScope('cambiar_sonido_escena', sound, { id: other, enabled: false }, s)).toEqual({
      id: other,
      enabled: false,
      campaignId: s.campaignId
    })
  })

  it('tirar_dados en una campaña, siempre a su registro: la jugadora, a la vista por defecto; el máster, oculta', () => {
    const player = tool('player', 'tirar_dados').call({ formula: '1d20' })
    expect([player.impl.action.name, player.input]).toEqual([
      'rollDice',
      { campaignId: expect.any(String), formula: '1d20', visibility: 'all' }
    ])
    expect(() => tool('player', 'tirar_dados').call({ formula: '1d20', visibility: 'hidden' })).toThrow()
    expect(tool('player', 'tirar_dados').call({ formula: '1d20', visibility: 'self' }).input).toMatchObject({
      visibility: 'self'
    })
    expect(tool('master', 'tirar_dados').call({ formula: '1d20' }).input).toMatchObject({ visibility: 'hidden' })
  })

  it('lo que escribe la jugadora con sus herramientas es lo que la barrera le deja: ninguna falla siempre', () => {
    const writes = new Set<string>()
    for (const name of CAMPAIGN_PLAYER_TOOLS) {
      const found = MCP_TOOLS[name]
      if (!found) throw new Error(name)
      for (const impl of toolActions(found)) if (impl.action.kind !== 'read') writes.add(impl.action.name)
    }
    // tryDice (probar sin campaña) no está: en la campaña, tirar_dados siempre tira en su registro
    expect([...writes].sort()).toEqual([...PLAYER_WRITES].sort())
  })

  it('las instrucciones de cada papel solo nombran sus herramientas', () => {
    for (const role of ['master', 'player'] as const) {
      const known = new Set(role === 'master' ? CAMPAIGN_MASTER_TOOLS : CAMPAIGN_PLAYER_TOOLS)
      const named = [...CAMPAIGN_GUIDE[role].matchAll(/\b([a-z]+(?:_[a-z]+)+)\b/g)].map((m) => m[1] ?? '')
      expect(named.filter((name) => !known.has(name))).toEqual([])
    }
  })
})
