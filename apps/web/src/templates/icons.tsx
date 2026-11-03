/** Los iconos de las plantillas (TEMPLATE_ICONS): cada nombre, su dibujo de lucide */
import type { PageTemplate } from '@crisol/contracts'
import {
  BookOpen,
  CalendarCheck,
  Castle,
  Crown,
  Flag,
  Flame,
  Gem,
  Hourglass,
  LayoutTemplate,
  type LucideIcon,
  Map as MapIcon,
  ScrollText,
  Shield,
  Ship,
  Skull,
  Sparkles,
  Swords,
  TreePine,
  UserRound
} from 'lucide-react'

export const TEMPLATE_ICON: Record<PageTemplate['icon'], LucideIcon> = {
  user: UserRound,
  castle: Castle,
  shield: Shield,
  gem: Gem,
  scroll: ScrollText,
  calendar: CalendarCheck,
  hourglass: Hourglass,
  flag: Flag,
  swords: Swords,
  crown: Crown,
  skull: Skull,
  map: MapIcon,
  book: BookOpen,
  flame: Flame,
  tree: TreePine,
  ship: Ship,
  sparkles: Sparkles,
  template: LayoutTemplate
}
