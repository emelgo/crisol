/** El círculo de una página fuera del SVG (en la ficha, en la familia del móvil): su icono o sus iniciales */
import type { RelationNode } from '@crisol/contracts'
import { Icon } from '../components/icon.tsx'
import { initials } from './model.ts'
import styles from './relations.module.css'

export function NodeGlyphBox({
  node,
  size = 'normal'
}: {
  node: Pick<RelationNode, 'icon' | 'title'>
  size?: 'normal' | 'small'
}) {
  return (
    <span className={styles.avatar} data-size={size} aria-hidden="true">
      {node.icon ? <Icon value={node.icon} /> : initials(node.title)}
    </span>
  )
}
