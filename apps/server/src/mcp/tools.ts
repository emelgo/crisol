/**
 * Las herramientas MCP salen de los contratos: mismo servicio, misma política, mismo historial que la API. El nombre va
 * en español porque lo ve el máster en claude.ai.
 */
import { loadMemberships } from '@crisol/db'
import { actorFrom, ForbiddenError, NotFoundError } from '@crisol/domain'
import { McpServer } from '@modelcontextprotocol/server'
import { type ActionEnv, InvalidRequestError } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'

/** Herramienta → acción del contrato */
export const MCP_TOOLS: Record<string, string> = {
  listar_mundos: 'listWorlds'
}

const INSTRUCTIONS =
  'Crisol: mundos de rol y su mesa virtual. Habla siempre en español. Los mundos tienen campañas; ' +
  'lo que cambies queda en el historial de Crisol y el máster puede deshacerlo.'

/** Texto del error para la IA (los códigos son los de la API); un fallo inesperado se relanza */
export function errorText(error: unknown): string {
  if (error instanceof NotFoundError) return 'NOT_FOUND: no existe o no lo puedes ver'
  if (error instanceof ForbiddenError) return 'FORBIDDEN: no tienes permiso'
  if (error instanceof InvalidRequestError) return error.code
  throw error
}

/** El servidor MCP de una petición, con las herramientas de la cuenta del token */
export function buildMcpServer(env: ActionEnv, userId: string): McpServer {
  const { db } = env
  const server = new McpServer({ name: 'crisol', version: '0.0.0' }, { instructions: INSTRUCTIONS })
  for (const [tool, actionName] of Object.entries(MCP_TOOLS)) {
    const impl = implementationsByName.get(actionName)
    if (!impl) throw new Error(`La herramienta ${tool} apunta a una acción que no existe: ${actionName}`)
    server.registerTool(
      tool,
      { description: impl.action.description, inputSchema: impl.action.input, outputSchema: impl.action.output },
      async (args) => {
        // Las pertenencias se leen en cada llamada, como en la API
        const actor = actorFrom(userId, await loadMemberships(db, userId))
        try {
          const output = impl.action.output.parse(
            await impl.handler({ ...env, actor, via: 'ai', tool }, args)
          ) as Record<string, unknown>
          return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output }
        } catch (error) {
          return { isError: true, content: [{ type: 'text', text: errorText(error) }] }
        }
      }
    )
  }
  return server
}
