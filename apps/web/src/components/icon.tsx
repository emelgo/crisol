/**
 * Un icono guardado (de una página, una carpeta, una plantilla…): un emoji, tal cual, o uno de los iconos de rol del
 * paquete («gi:<id>», @crisol/contracts game-icons.ts), que se pinta con el color del texto (su dibujo es una máscara)
 */
import { gameIcon } from '@crisol/contracts'
import type { CSSProperties } from 'react'
import styles from './icon.module.css'

/** La dirección del dibujo de un icono de rol */
export const gameIconUrl = (id: string) => `/iconos/${id}.svg`

export function Icon({ value, size, className }: { value: string; size?: number; className?: string }) {
  const game = gameIcon(value)
  const sized = size ? ({ fontSize: size } as CSSProperties) : undefined
  if (game) {
    return (
      <span
        className={className ? `${styles.game} ${className}` : styles.game}
        style={{ ...sized, '--icono': `url("${gameIconUrl(game.id)}")` } as CSSProperties}
        aria-hidden="true"
      />
    )
  }
  return (
    <span className={className ? `${styles.emoji} ${className}` : styles.emoji} style={sized} aria-hidden="true">
      {value}
    </span>
  )
}

/** Cómo se nombra un icono (en «Cambiar el icono 🐉» o «… Dragón»): el emoji, o el nombre del de rol */
export const iconLabel = (value: string) => gameIcon(value)?.label ?? value
