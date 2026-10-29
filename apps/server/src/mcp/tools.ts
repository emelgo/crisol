/**
 * Las herramientas MCP salen de los contratos: mismo servicio, misma política, mismo historial que la API. El nombre va
 * en español porque lo ve el máster en claude.ai. Lo que no es leer pasa por el modo de IA de la cuenta (approvals.ts).
 */
import { APPROVAL_WAIT_MS } from '@crisol/domain'
import { McpServer } from '@modelcontextprotocol/server'
import type { ActionEnv, Implementation } from '../actions/context.ts'
import { implementationsByName } from '../actions/implementations.ts'
import { callAsAi } from './approvals.ts'

/** Herramienta → acción del contrato */
export const MCP_TOOLS: Record<string, string> = {
  listar_mundos: 'listWorlds'
}

const INSTRUCTIONS =
  'Crisol: mundos de rol y su mesa virtual. Habla siempre en español. Los mundos tienen campañas; ' +
  'lo que cambies queda en el historial de Crisol y el máster puede deshacerlo. Según el modo de IA que elija el ' +
  'máster, algunas acciones esperan su aprobación en Crisol; si rechaza una, no insistas.'

/** Lo que se anuncia de una herramienta. Solo las de leer dicen qué devuelven: las demás pueden quedar esperando */
export function toolConfig(impl: Implementation) {
  const { description, input, output, kind } = impl.action
  return { description, inputSchema: input, ...(kind === 'read' ? { outputSchema: output } : {}) }
}

/** El servidor MCP de una petición, con las herramientas de la cuenta del token */
export function buildMcpServer(env: ActionEnv, userId: string, options: { approvalWaitMs?: number } = {}): McpServer {
  const server = new McpServer({ name: 'crisol', version: '0.0.0' }, { instructions: INSTRUCTIONS })
  const waitMs = options.approvalWaitMs ?? APPROVAL_WAIT_MS
  for (const [tool, actionName] of Object.entries(MCP_TOOLS)) {
    const impl = implementationsByName.get(actionName)
    if (!impl) throw new Error(`La herramienta ${tool} apunta a una acción que no existe: ${actionName}`)
    server.registerTool(tool, toolConfig(impl), (input) =>
      callAsAi(env, { userId, tool, impl, input: input as Record<string, unknown>, waitMs })
    )
  }
  return server
}
