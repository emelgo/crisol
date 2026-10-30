/** Cómo se ve un mundo: sus iconos (de Lucide, ISC) y sus colores, los fijos y los propios que se recuerdan */
import type { World } from '@crisol/contracts'
import {
  Amphora,
  Anchor,
  Axe,
  Beer,
  Bird,
  Bone,
  BookOpen,
  BowArrow,
  Castle,
  Church,
  CloudLightning,
  Coins,
  Compass,
  Crown,
  Dices,
  Drama,
  Eye,
  Feather,
  Flame,
  FlaskRound,
  Gem,
  Ghost,
  Hammer,
  Hourglass,
  KeyRound,
  Landmark,
  Leaf,
  type LucideIcon,
  Map as MapIcon,
  Moon,
  Mountain,
  MountainSnow,
  Pyramid,
  ScrollText,
  Shield,
  Ship,
  Skull,
  Snowflake,
  Sparkles,
  Sun,
  Sword,
  Swords,
  Tent,
  TreePine,
  Trees,
  WandSparkles,
  Waves
} from 'lucide-react'

export const ICONS: Record<NonNullable<World['icon']>, LucideIcon> = {
  tower: Castle,
  mountain: Mountain,
  peak: MountainSnow,
  sword: Sword,
  swords: Swords,
  axe: Axe,
  bow: BowArrow,
  shield: Shield,
  wand: WandSparkles,
  potion: FlaskRound,
  scroll: ScrollText,
  book: BookOpen,
  map: MapIcon,
  compass: Compass,
  key: KeyRound,
  hourglass: Hourglass,
  crown: Crown,
  gem: Gem,
  coins: Coins,
  skull: Skull,
  bone: Bone,
  ghost: Ghost,
  flame: Flame,
  moon: Moon,
  sun: Sun,
  sparkles: Sparkles,
  storm: CloudLightning,
  snowflake: Snowflake,
  waves: Waves,
  ship: Ship,
  anchor: Anchor,
  tree: TreePine,
  forest: Trees,
  leaf: Leaf,
  temple: Landmark,
  church: Church,
  pyramid: Pyramid,
  tent: Tent,
  bird: Bird,
  feather: Feather,
  eye: Eye,
  dice: Dices,
  beer: Beer,
  hammer: Hammer,
  amphora: Amphora,
  masks: Drama
}

/** Los colores fijos: oscuros y apagados, para que el icono y el texto destaquen */
export const PRESET_COLORS: Record<'wine' | 'moss' | 'slate' | 'ochre' | 'sea' | 'plum', string> = {
  wine: '#4a2a2c',
  moss: '#2e3a33',
  slate: '#2d3440',
  ochre: '#4a3b22',
  sea: '#22394a',
  plum: '#3a2d44'
}

/** El color de verdad (#rrggbb) de un mundo, o null si no tiene */
export function colorHex(color: World['color']): string | null {
  if (!color) return null
  return color.startsWith('#') ? color : PRESET_COLORS[color as keyof typeof PRESET_COLORS]
}

const STORAGE = 'crisol.colores'
const MAX = 10

/** Los colores propios que ha creado la cuenta (en este navegador), el último primero */
export function rememberedColors(email: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(`${STORAGE}.${email}`) ?? '[]') as unknown
    return Array.isArray(value)
      ? value.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
      : []
  } catch {
    return []
  }
}

export function rememberColor(email: string, color: World['color']) {
  if (!color?.startsWith('#')) return
  try {
    const next = [color, ...rememberedColors(email).filter((c) => c.toLowerCase() !== color.toLowerCase())]
    localStorage.setItem(`${STORAGE}.${email}`, JSON.stringify(next.slice(0, MAX)))
  } catch {
    // Sin almacenamiento, no se recuerda: el mundo lo guarda igual
  }
}
