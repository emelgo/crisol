/**
 * Los espacios de la barra (revisión, tanda 6): donde la barra cambia y enseña lo suyo, con la llama de vuelta. El
 * mundo (y, dentro, una campaña) y el sistema. Fuera de ellos, la barra de la cuenta (Mundos, Plantillas, Etiquetas,
 * Sistemas y Archivos)
 */

export type Space = { kind: 'world'; id: string; campaignId: string | null } | { kind: 'system'; id: string }

/** El espacio de una dirección (la que se ve: shown-path.ts), o null fuera de ellos */
export function spaceOf(path: string): Space | null {
  const world = /^\/mundos\/([^/]+)(?:\/campanas\/([^/]+))?/.exec(path)
  if (world?.[1]) return { kind: 'world', id: world[1], campaignId: world[2] ?? null }
  const system = /^\/sistemas\/([^/]+)/.exec(path)
  if (system?.[1]) return { kind: 'system', id: system[1] }
  return null
}

/** Adónde vuelve la llama desde cada espacio */
export const SPACE_HOME = { world: '/mundos', system: '/sistemas' } as const
