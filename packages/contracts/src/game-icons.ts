import { z } from 'zod'
import { defineAction } from './action.ts'

/**
 * Los iconos de rol que se pueden elegir, además de un emoji (Enrique, 2026-11-12: un paquete de iconos de fantasía de
 * calidad; 2026-11-19: «necesitamos más iconos»). Origen: game-icons.net (https://game-icons.net), licencia CC BY 3.0
 * (Viscious Speed y Zeromancer, CC0): todos los del paquete (4180, sin la carpeta «badges»); sus dibujos, en
 * apps/web/public/iconos/<id>.svg. Se guardan como «gi:<id>». Aquí, lo ligero (el id, los grupos, la comprobación); la
 * lista con sus nombres en español, sus palabras y su grupo, en game-icons-catalog.ts, que se carga aparte (en la web,
 * solo al abrir el buscador o al nombrar un icono). docs/terceros.md
 */

/** Los grupos del buscador, en su orden */
export const GAME_ICON_GROUPS = [
  'gente',
  'criaturas',
  'animales',
  'naturaleza',
  'lugares',
  'edificios',
  'armas',
  'armaduras',
  'objetos',
  'magia',
  'religion',
  'simbolos',
  'transporte',
  'dinero',
  'documentos',
  'comida',
  'cuerpo',
  'combate',
  'ocio',
  'tecnologia'
] as const
export type GameIconGroup = (typeof GAME_ICON_GROUPS)[number]

/** Los autores (las carpetas del paquete), con el nombre con el que se les cita */
export const GAME_ICON_AUTHORS: Record<string, string> = {
  lorc: 'Lorc',
  delapouite: 'Delapouite',
  andymeneely: 'Andy Meneely',
  aussiesim: 'Aussiesim',
  'carl-olsen': 'Carl Olsen',
  'caro-asercion': 'Caro Asercion',
  cathelineau: 'Cathelineau',
  catsu: 'Catsu',
  darkzaitzev: 'DarkZaitzev',
  faithtoken: 'Faithtoken',
  felbrigg: 'Felbrigg',
  generalace135: 'GeneralAce135',
  guard13007: 'Guard13007',
  'heavenly-dog': 'HeavenlyDog',
  irongamer: 'Irongamer',
  'john-colburn': 'John Colburn',
  'john-redman': 'John Redman',
  'kier-heyl': 'Kier Heyl',
  'lord-berandas': 'Lord Berandas',
  lucasms: 'Lucas',
  'pepijn-poolman': 'Pepijn Poolman',
  'pierre-leducq': 'Pierre Leducq',
  priorblue: 'PriorBlue',
  quoting: 'Quoting',
  rihlsul: 'Rihlsul',
  sbed: 'Sbed',
  seregacthtuf: 'SeregaCthtuf',
  skoll: 'Skoll',
  sparker: 'Sparker',
  spencerdub: 'SpencerDub',
  starseeker: 'Starseeker',
  'various-artists': 'Various Artists',
  'viscious-speed': 'Viscious Speed',
  willdabeast: 'Willdabeast',
  zajkonur: 'Zajkonur',
  zeromancer: 'Zeromancer'
}

export interface GameIcon {
  id: string
  /** Su nombre en español */
  label: string
  group: GameIconGroup
  /** Otras palabras por las que se encuentra (en español, sin las de su nombre) */
  words: readonly string[]
  author: string
  /** De la selección de siempre (lo primero que se ve en el buscador) */
  featured: boolean
}

const GAME_ICON_ID = /^gi:([a-z0-9]+(?:-[a-z0-9]+)*)$/

/** El id del icono de rol que dice un valor guardado («gi:dragon-head» → «dragon-head»), o null (un emoji) */
export function gameIconId(value: string | null | undefined): string | null {
  return value ? (GAME_ICON_ID.exec(value)?.[1] ?? null) : null
}

/** Los ids que existen, cuando se ha cargado la lista (game-icons-catalog.ts lo hace al importarse) */
let known: ReadonlySet<string> | null = null

export function registerGameIcons(icons: readonly GameIcon[]) {
  known = new Set(icons.map((icon) => icon.id))
}

/**
 * Si un valor es un icono de rol que existe. Sin la lista cargada (la web, que no comprueba), basta con su forma; el
 * servidor la carga siempre (sus acciones de iconos importan game-icons-catalog.ts)
 */
export function isGameIcon(value: string): boolean {
  const id = gameIconId(value)
  return id !== null && (known === null || known.has(id))
}

export const listGameIcons = defineAction({
  name: 'listGameIcons',
  kind: 'read',
  description:
    'Los iconos de rol que se pueden poner a una página, una carpeta, una plantilla, un sistema o un pin en lugar de un emoji (más de 4000, de game-icons.net): su id (se escribe «gi:<id>», p. ej. gi:dragon-head), su nombre en español y su grupo. Busca con query (en español o en inglés: «espada», «castillo», «dragon») y/o group; sin nada, los destacados. Devuelve como mucho limit (50 si no se dice) y cuántos casan en total',
  input: z.object({
    query: z.string().trim().max(60).optional(),
    group: z.enum(GAME_ICON_GROUPS).optional(),
    limit: z.number().int().min(1).max(500).optional()
  }),
  output: z.object({
    icons: z.array(z.object({ icon: z.string(), label: z.string(), group: z.enum(GAME_ICON_GROUPS) })),
    total: z.number().int()
  })
})
