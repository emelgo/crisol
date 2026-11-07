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
    image: imageOf(token),
    hidden: false,
    selected: false,
    turn,
    life: null,
    state: token.state ? { text: words(token.state), tone: TONES[token.state] } : null,
    conditions: token.conditions.map((c) => c.name)
  }
}
