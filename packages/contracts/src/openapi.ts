import { z } from 'zod'
import type { ActionDefinition } from './action.ts'

/** Documento OpenAPI de las acciones: POST /api/actions/<name> */
export function openApi(actions: readonly ActionDefinition[]) {
  const paths = Object.fromEntries(
    actions.map((action) => [
      `/api/actions/${action.name}`,
      {
        post: {
          operationId: action.name,
          summary: action.description,
          'x-crisol-kind': action.kind,
          requestBody: { required: true, content: { 'application/json': { schema: z.toJSONSchema(action.input) } } },
          responses: {
            '200': { description: 'Hecho', content: { 'application/json': { schema: z.toJSONSchema(action.output) } } },
            '400': { description: 'Datos no válidos' },
            '401': { description: 'Sin sesión' },
            '403': { description: 'No tiene permiso' },
            '404': { description: 'No existe o no lo puede ver' }
          }
        }
      }
    ])
  )
  return { openapi: '3.1.0', info: { title: 'Crisol', version: '0' }, paths }
}
