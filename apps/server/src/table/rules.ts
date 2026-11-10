/**
 * Las reglas de las puertas y del paso en el servidor (docs/specs/vision.md, ADR-0018 § 3), para cuando muevan los
 * jugadores (módulo 7): el máster puede con todo. Una puerta secreta es un muro para el grupo: ni se abre ni se cruza
 */
import { crossesWall, type DoorStates, movementEdges, type Point, type Wall } from '@crisol/tabletop'

type Sight = { hasPoint(p: Point): boolean }

/** Cuánto se aparta del centro de la puerta, a cada lado, para mirar si se ve (menos que una celda de la niebla) */
const DOOR_SIDE = 6

/**
 * Si el grupo ve una puerta: un poco a un lado o al otro de su centro (el centro mismo cae en la raya, del lado de la
 * celda de enfrente)
 */
export function doorSeen(wall: Pick<Wall, 'a' | 'b'>, visible: Sight): boolean {
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  if (length === 0) return visible.hasPoint(mid)
  const nx = (-(wall.b.y - wall.a.y) / length) * DOOR_SIDE
  const ny = ((wall.b.x - wall.a.x) / length) * DOOR_SIDE
  return visible.hasPoint({ x: mid.x + nx, y: mid.y + ny }) || visible.hasPoint({ x: mid.x - nx, y: mid.y - ny })
}

/** Si un jugador puede abrir o cerrar la puerta: una puerta normal (no secreta), sin llave y que su grupo vea */
export function playerMayUseDoor(wall: Pick<Wall, 'a' | 'b' | 'door' | 'locked'>, visible: Sight): boolean {
  if (wall.door !== 'door' || wall.locked) return false
  return doorSeen(wall, visible)
}

/**
 * Si una ficha puede ir en línea recta de `from` a `to` sin atravesar un muro que para el paso (las puertas cerradas
 * también, las secretas incluidas; las abiertas dejan pasar)
 */
export function moveAllowed(walls: readonly Wall[], doors: DoorStates, from: Point, to: Point): boolean {
  return !crossesWall(from, to, movementEdges(walls, doors))
}
