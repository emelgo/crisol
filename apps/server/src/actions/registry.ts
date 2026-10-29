import type { ActionDefinition } from '@crisol/contracts'
import type { z } from 'zod'
import type { ActionContext, Implementation } from './context.ts'

export type { Implementation }

type Handler<A extends ActionDefinition> = (
  ctx: ActionContext,
  input: z.output<A['input']>
) => Promise<z.input<A['output']>>

/** Une una acción con su servicio; los tipos de entrada y salida salen del contrato */
export function implement<A extends ActionDefinition>(action: A, handler: Handler<A>): Implementation {
  return { action, handler: handler as Implementation['handler'] }
}
