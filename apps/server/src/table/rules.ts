/**
 * Las reglas de las puertas y del paso en el servidor (docs/specs/vision.md, ADR-0018 § 3), para cuando muevan los
 * jugadores (módulo 7): el máster puede con todo. Una puerta secreta es un muro para el grupo: ni se abre ni se cruza
 */
import { crossesWall, type DoorStates, movementEdges, type Point, type Wall } from '@crisol/tabletop'

type Sight = { hasPoint(p: Point): boolean }

/**
 * Si un jugador puede abrir o cerrar la puerta: una puerta normal (no secreta), sin llave y que su grupo vea (su
 * centro, a la vista)
 */
export function playerMayUseDoor(wall: Pick<Wall, 'a' | 'b' | 'door' | 'locked'>, visible: Sight): boolean {
  if (wall.door !== 'door' || wall.locked) return false
  return visible.hasPoint({ x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 })
}

/**
 * Si una ficha puede ir en línea recta de `from` a `to` sin atravesar un muro que para el paso (las puertas cerradas
 * también, las secretas incluidas; las abiertas dejan pasar)
 */
export function moveAllowed(walls: readonly Wall[], doors: DoorStates, from: Point, to: Point): boolean {
  return !crossesWall(from, to, movementEdges(walls, doors))
}
