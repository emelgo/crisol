/** Cómo se pinta cada ficha en la mesa (todo lo del máster) y en la tele (su nombre y su estado en palabras) */
import type { SceneGrid, ScreenToken, TokenView } from '@crisol/contracts'
import type { Point } from '@crisol/tabletop'
import type { DrawToken } from './renderer.ts'
import { initialOf, tokenRadius } from './tokens.ts'

/** Su imagen: la que se le eligió (un archivo del mundo, con su encuadre) o la de su personaje o su criatura */
function imageOf(token: { image: TokenView['image']; img: string | null }): DrawToken['image'] {
  if (token.image?.fileId) return { url: `/api/files/${token.image.fileId}`, ...pick(token.image) }
  if (token.img)
    return { url: token.img, x: token.image?.x ?? 0.5, y: token.image?.y ?? 0.5, zoom: token.image?.zoom ?? 1 }
  return null
}

/**
 * Los colores del disco (claro arriba a la izquierda, oscuro abajo), como los del lienzo de la mesa: los del grupo,
 * de una paleta; los hostiles y los neutrales, de otra
 */
const PALETTES: Record<'group' | 'other', ReadonlyArray<readonly [number, number]>> = {
  group: [
    [0x5f8fc0, 0x1b2f48],
    [0x7a7fd0, 0x23264f],
    [0x3aa497, 0x123b36],
    [0xb07a42, 0x3b2410],
    [0xc07a8a, 0x4a1f2a]
  ],
  other: [
    [0x5b4d77, 0x1a1426],
    [0xa5502e, 0x3a140a],
    [0x7d7668, 0x2c2a24],
    [0x6f8a3e, 0x1e2a10]
  ]
}

/** El color de un nombre: el mismo para las copias de una criatura («Goblin 1», «Goblin 2») */
export function colorsOf(
  name: string,
  faction: 'group' | 'hostile' | 'neutral' = 'hostile'
): readonly [number, number] {
  const base = name.replace(/\s+\d+$/, '').toLocaleLowerCase('es')
  let hash = 0
  for (const char of base) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0
  const palette = PALETTES[faction === 'group' ? 'group' : 'other']
  return palette[hash % palette.length] as readonly [number, number]
}

/** Los mismos colores, para el CSS (un degradado radial) */
export const cssDisc = (name: string, faction: 'group' | 'hostile' | 'neutral') => {
  const [light, dark] = colorsOf(name, faction).map((c) => `#${c.toString(16).padStart(6, '0')}`)
  return `radial-gradient(circle at 35% 30%, ${light}, ${dark})`
}

const pick = (image: NonNullable<TokenView['image']>) => ({ x: image.x, y: image.y, zoom: image.zoom })

/** Una ficha del máster: con su barra de vida, oculta a medias, y la elegida con su aro */
export function masterDraw(token: TokenView, grid: SceneGrid, selected: boolean, at?: Point, turn = false): DrawToken {
  const life = token.actor.life
  return {
    id: token.id,
    x: at?.x ?? token.x,
    y: at?.y ?? token.y,
    radius: tokenRadius(token, grid),
    label: token.label,
    initial: initialOf(token.label),
    faction: token.faction,
    colors: colorsOf(token.actor.name, token.faction),
    image: imageOf({ image: token.image, img: token.actor.img }),
    hidden: token.hidden,
    selected,
    turn,
    life: life && life.max > 0 ? life.value / life.max : null,
    state: null,
    conditions: token.actor.conditions.map((c) => c.name)
  }
}

const TONES = { unhurt: 'ok', hurt: 'hurt', bloodied: 'bad', dying: 'crit', down: 'down' } as const

/** Una ficha de la tele: su nombre, y de las criaturas su estado en palabras (`words` lo traduce) */
export function screenDraw(
  token: ScreenToken,
  grid: SceneGrid,
  words: (state: NonNullable<ScreenToken['state']>) => string,
  at?: Point,
  turn = false
): DrawToken {
  return {
    id: token.id,
    x: at?.x ?? token.x,
    y: at?.y ?? token.y,
    radius: tokenRadius(token, grid),
    label: token.name,
    initial: initialOf(token.label),
    faction: token.faction,
    colors: colorsOf(token.name, token.faction),
    image: imageOf(token),
    hidden: false,
    selected: false,
    turn,
    life: null,
    state: token.state ? { text: words(token.state), tone: TONES[token.state] } : null,
    conditions: token.conditions.map((c) => c.name)
  }
}
