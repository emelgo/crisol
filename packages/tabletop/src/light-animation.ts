// Portado de packages/mesa/src/nucleo/luz.ts (Crisol actual, commit 3f68f11)
/**
 * Las luces animadas, para pintarlas en el cliente (el servidor no las mira: la animación nunca mueve el radio tenue,
 * donde acaba la luz para las reglas). Antorcha: parpadeo vivo; vela: suave; pulso: sube y baja despacio; mágica: pulso
 * con algo de vida. Puro.
 */

export type LightAnimation = 'none' | 'torch' | 'candle' | 'pulse' | 'magic'

/** Ruido suave en [0, 1] de un tiempo (segundos) y una semilla: dos senos de periodos que no se repiten juntos */
function noise(t: number, seed: number): number {
  const a =
    Math.sin(t * 1.7 + seed * 12.9898) * 0.5 +
    Math.sin(t * 3.1 + seed * 78.233) * 0.3 +
    Math.sin(t * 7.3 + seed * 3.7) * 0.2
  return (a + 1) / 2
}

const seedOf = (id: string): number => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000
  return h / 1000
}

/** Cuánto da una luz animada en el instante `t` (segundos): factores de su intensidad y de su radio brillante */
export function animateLight(animation: LightAnimation, id: string, t: number): { intensity: number; bright: number } {
  const s = seedOf(id)
  switch (animation) {
    case 'torch': {
      const n = noise(t * 4, s)
      return { intensity: 0.82 + 0.18 * n, bright: 0.9 + 0.1 * n }
    }
    case 'candle': {
      const n = noise(t * 6, s)
      return { intensity: 0.9 + 0.1 * n, bright: 0.95 + 0.05 * n }
    }
    case 'pulse': {
      const n = (Math.sin(t * 2 + s * 6.28) + 1) / 2
      return { intensity: 0.75 + 0.25 * n, bright: 0.85 + 0.15 * n }
    }
    case 'magic': {
      const n = (Math.sin(t * 2.6 + s * 6.28) + 1) / 2
      const r = noise(t * 2, s)
      return { intensity: 0.75 + 0.2 * n + 0.05 * r, bright: 0.85 + 0.1 * n + 0.05 * r }
    }
    default:
      return { intensity: 1, bright: 1 }
  }
}

/** Si una luz se anima (hay que repintar con el tiempo) */
export const isAnimated = (animation: LightAnimation): boolean => animation !== 'none'
