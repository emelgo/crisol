import type { z } from 'zod'

/**
 * Tipo de acción, para los modos de IA: leer es libre; escribir, borrar y lo que afecta a los jugadores pueden
 * esperar la aprobación del máster
 */
export type ActionKind = 'read' | 'write' | 'delete' | 'players'

export interface ActionDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  name: string
  kind: ActionKind
  /** Para el OpenAPI y la descripción de la herramienta MCP */
  description: string
  input: I
  output: O
}

/** Declara una acción: de aquí salen la ruta de la API, el cliente de la web y la herramienta MCP */
export function defineAction<I extends z.ZodType, O extends z.ZodType>(definition: ActionDefinition<I, O>) {
  return definition
}
