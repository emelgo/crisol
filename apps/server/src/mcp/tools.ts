/**
 * Las herramientas MCP salen de los contratos: mismo servicio, misma política, mismo historial que la API. El nombre va
 * en español porque lo ve el máster en claude.ai. Lo que no es leer pasa por el modo de IA de la cuenta (approvals.ts).
 */
import { APPROVAL_WAIT_MS } from '@crisol/domain'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { ActionEnv, Implementation } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'
import { callAsAi } from './approvals.ts'

/** Qué acción del contrato hace la herramienta, y con qué entrada */
type Route = { action: string; input: Record<string, unknown> }

/** Una herramienta: una acción del contrato tal cual, o una de varias según lo que se pida */
export type McpTool =
  | { action: string }
  | {
      description: string
      input: z.ZodObject
      /** Las acciones a las que puede llevar */
      actions: readonly string[]
      route: (input: Record<string, unknown>) => Route
    }

const invitationInput = z.object({
  campaignId: z.uuid(),
  change: z
    .enum(['regenerate', 'open', 'close'])
    .optional()
    .describe(
      'Sin change, solo lo devuelve. regenerate: un enlace nuevo; open o close: abrir o cerrar las invitaciones'
    )
})

const linksInput = z.object({
  pageId: z
    .uuid()
    .optional()
    .describe('Los enlaces de esta página: quién la enlaza, adónde enlaza y dónde se la nombra'),
  worldId: z.uuid().optional().describe('Sin pageId: los enlaces sin resolver de la wiki de este mundo')
})

export const MCP_TOOLS: Record<string, McpTool> = {
  listar_mundos: { action: 'listWorldsWithCampaigns' },
  ver_campana: { action: 'getCampaign' },
  crear_mundo: { action: 'createWorld' },
  cambiar_mundo: { action: 'updateWorld' },
  crear_campana: { action: 'createCampaign' },
  cambiar_campana: { action: 'updateCampaign' },
  enlace_invitacion: {
    description:
      'El enlace de invitación de una campaña y si las invitaciones están abiertas. Con change, lo regenera (el anterior deja de valer) o abre o cierra las invitaciones: eso afecta a los jugadores y puede esperar la aprobación del máster',
    input: invitationInput,
    actions: ['getInvitation', 'regenerateInvitation', 'setInvitationsOpen'],
    route: (input) => {
      const { campaignId, change } = invitationInput.parse(input)
      if (change === 'regenerate') return { action: 'regenerateInvitation', input: { campaignId } }
      if (change) return { action: 'setInvitationsOpen', input: { campaignId, open: change === 'open' } }
      return { action: 'getInvitation', input: { campaignId } }
    }
  },
  ver_historial: { action: 'listHistory' },
  deshacer: { action: 'undoOperation' },
  pendientes: { action: 'listApprovals' },
  ver_arbol: { action: 'listPageTree' },
  paginas_recientes: { action: 'listRecentPages' },
  leer_pagina: { action: 'readPage' },
  crear_paginas: { action: 'createPages' },
  editar_pagina: { action: 'editPage' },
  versiones_pagina: { action: 'listPageVersions' },
  restaurar_version: { action: 'restorePageVersion' },
  enlaces_pagina: {
    description:
      'Con pageId, los enlaces de una página: las que la enlazan (con el trozo), adónde enlaza ella y dónde se la nombra sin enlazar. Con worldId, los enlaces sin resolver de la wiki: páginas que alguien enlaza y aún no existen',
    input: linksInput,
    actions: ['getPageLinks', 'listUnresolvedLinks'],
    route: (input) => {
      const { pageId, worldId } = linksInput.parse(input)
      if (pageId) return { action: 'getPageLinks', input: { pageId } }
      return { action: 'listUnresolvedLinks', input: { worldId } }
    }
  },
  listar_archivos: { action: 'listFiles' },
  buscar_paginas: { action: 'searchWiki' },
  mover_pagina: { action: 'movePage' },
  borrar_pagina: { action: 'deletePage' },
  // Las etiquetas de la cuenta (ADR-0006); las de una página van en sus propiedades
  listar_etiquetas: { action: 'listAccountTags' },
  crear_etiqueta: { action: 'createTag' },
  cambiar_etiqueta: { action: 'updateTag' },
  borrar_etiqueta: { action: 'deleteTag' },
  etiquetar_archivo: { action: 'setFileTags' },
  // Las pestañas de una página y sus mapas con pines (ADR-0007)
  ver_pestanas: { action: 'listPageTabs' },
  crear_pestana: { action: 'createPageTab' },
  cambiar_pestana: { action: 'updatePageTab' },
  borrar_pestana: { action: 'deletePageTab' },
  ver_mapa: { action: 'getMap' },
  cambiar_mapa: { action: 'updateMap' },
  poner_pin: { action: 'createMapPin' },
  cambiar_pin: { action: 'updateMapPin' },
  quitar_pin: { action: 'deleteMapPin' }
}

const INSTRUCTIONS =
  'Crisol: mundos de rol y su mesa virtual. Habla siempre en español. Una organización tiene mundos, y cada mundo, ' +
  'campañas con su máster y sus jugadores; a una campaña se entra con su enlace de invitación. Cada mundo tiene su ' +
  'wiki: páginas con subpáginas, solo del máster, en Markdown de Obsidian (lee una con leer_pagina antes de cambiarla, ' +
  'y lo que solo debe saber el máster va en > [!secreto]). Antes de crear, busca con buscar_paginas para no repetir. ' +
  'Para pasar una wiki entera: crear_paginas de 50 en 50, en cualquier orden (los enlaces se resuelven solos), y al ' +
  'final enlaces_pagina con worldId para ver lo que quede sin resolver; los archivos los sube el máster y se enlazan ' +
  'por su nombre (listar_archivos). Las etiquetas son de toda la cuenta: míralas con listar_etiquetas y usa las que ' +
  'ya hay antes de inventar otras. Una página puede tener pestañas además de su texto, como un mapa (ver_pestanas): ' +
  'sus pines van de 0 a 1 sobre la imagen y llevan a páginas; míralo con ver_mapa antes de poner nada. Lo que cambies queda ' +
  'en el historial de Crisol y el máster puede deshacerlo. Según el modo de IA que elija el máster, algunas acciones ' +
  'esperan su aprobación en Crisol: no las repitas, mira cómo acabaron con pendientes; si rechaza una, no insistas.'

function implementation(name: string): Implementation {
  const impl = implementationsByName.get(name)
  if (!impl) throw new Error(`Una herramienta apunta a una acción que no existe: ${name}`)
  return impl
}

/** Las acciones a las que puede llevar una herramienta */
export const toolActions = (tool: McpTool) => ('route' in tool ? tool.actions : [tool.action]).map(implementation)

/**
 * Lo que se anuncia de una herramienta. Solo las de leer de una sola acción dicen qué devuelven: las demás pueden
 * quedar esperando la aprobación, o devolver cosas distintas según lo que se pida
 */
export function toolConfig(tool: McpTool) {
  if ('route' in tool) return { description: tool.description, inputSchema: tool.input }
  const { description, input, output, kind } = implementation(tool.action).action
  return { description, inputSchema: input, ...(kind === 'read' ? { outputSchema: output } : {}) }
}

/** La acción y su entrada (validada con su contrato) para lo que pide la IA */
export function routeCall(tool: McpTool, input: Record<string, unknown>) {
  const route = 'route' in tool ? tool.route(input) : { action: tool.action, input }
  const impl = implementation(route.action)
  return { impl, input: impl.action.input.parse(route.input) as Record<string, unknown> }
}

/** El servidor MCP de una petición, con las herramientas de la cuenta del token */
export function buildMcpServer(env: ActionEnv, userId: string, options: { approvalWaitMs?: number } = {}): McpServer {
  const server = new McpServer({ name: 'crisol', version: '0.0.0' }, { instructions: INSTRUCTIONS })
  const waitMs = options.approvalWaitMs ?? APPROVAL_WAIT_MS
  for (const [name, tool] of Object.entries(MCP_TOOLS)) {
    server.registerTool(name, toolConfig(tool), (args) =>
      callAsAi(env, { userId, tool: name, ...routeCall(tool, args as Record<string, unknown>), waitMs })
    )
  }
  return server
}
