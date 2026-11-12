/**
 * El icono de una carpeta, el mismo en Archivos, su vista previa, su ventana y el selector de archivos: su emoji o, sin
 * él, el dibujo de una carpeta (abierta o cerrada). Con color, el dibujo va de su color, relleno suave; el emoji, sobre
 * un fondo de su color
 */
import type { FolderView } from '@crisol/contracts'
import { Folder, FolderOpen } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Icon as Glyph } from '../components/icon.tsx'
import { colorHex } from '../routes/world-look.ts'
import styles from './folder-glyph.module.css'

export function FolderGlyph({
  folder,
  open = false,
  size = 20,
  strokeWidth = 1.75
}: {
  folder: Pick<FolderView, 'color' | 'icon'>
  open?: boolean
  size?: number
  strokeWidth?: number
}) {
  const hex = colorHex(folder.color)
  const tint = hex ? ({ '--folder-color': hex } as CSSProperties) : undefined
  if (folder.icon) {
    return (
      <span
        className={styles.emoji}
        data-tinted={hex ? '' : undefined}
        style={{ ...tint, '--glyph-size': `${size}px` } as CSSProperties}
        aria-hidden="true"
      >
        <Glyph value={folder.icon} />
      </span>
    )
  }
  const Icon = open ? FolderOpen : Folder
  return (
    <Icon
      aria-hidden="true"
      size={size}
      strokeWidth={strokeWidth}
      className={hex ? styles.tinted : undefined}
      style={tint}
    />
  )
}
