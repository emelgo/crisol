import type { ActionDefinition } from '@crisol/contracts'
import type { z } from 'zod'
import type { ActionContext } from './context.ts'

type Handler<A extends ActionDefinition> = (
  ctx: ActionContext,
  input: z.output<A['input']>
) => Promise<z.input<A['output']>>

/** Una acción del contrato con su servicio */
export interface Implementation {
  action: ActionDefinition
  handler: (ctx: ActionContext, input: unknown) => Promise<unknown>
}

/** Une una acción con su servicio; los tipos de entrada y salida salen del contrato */
export function implement<A extends ActionDefinition>(action: A, handler: Handler<A>): Implementation {
  return { action, handler: handler as Implementation['handler'] }
}
