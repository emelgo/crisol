import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { type HTMLAttributes, type ReactNode, type RefObject, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Lo que flota junto a un botón (una confirmación): fuera de la página, en el cuerpo, para que ninguna caja lo recorte
 * (las secciones de cristal, que recortan lo suyo, lo harían), y siguiendo al botón si la página se mueve. No empuja nada
 */
export function Floating({
  anchor,
  className,
  children,
  placement = 'bottom-start',
  boxRef,
  ...props
}: {
  anchor: RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
  /** Dónde, respecto al botón (un menú a la derecha de la página, por su borde derecho) */
  placement?: 'bottom-start' | 'bottom-end'
  /** Para quien necesite el panel (cerrarlo al pulsar fuera) */
  boxRef?: RefObject<HTMLDivElement | null>
} & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'>) {
  const own = useRef<HTMLDivElement>(null)
  const box = boxRef ?? own
  useLayoutEffect(() => {
    const reference = anchor.current
    const element = box.current
    if (!reference || !element) return
    return autoUpdate(reference, element, () => {
      void computePosition(reference, element, {
        strategy: 'fixed',
        placement,
        middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })]
      }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [anchor, box, placement])
  // Dentro de una ventana (modal), en ella: fuera, lo de detrás está inerte y no se podría pulsar
  const host = anchor.current?.closest('dialog') ?? document.body
  return createPortal(
    <div ref={box} className={className} {...props}>
      {children}
    </div>,
    host
  )
}
