import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { focusIsLost } from './focus.ts'

/** Si hay que llevar el foco al título de la página en cuanto aparezca */
type Request = { current: boolean; from?: Element | null }
const FocusRequest = createContext<Request>({ current: false })

/** Por encima de AccountScope: la petición sobrevive a que se vuelva a montar todo al cambiar de cuenta */
export function HeadingFocusProvider({ children }: { children: ReactNode }) {
  const request = useRef<Request>({ current: false }).current
  return <FocusRequest.Provider value={request}>{children}</FocusRequest.Provider>
}

/** La petición, para quien vuelve a montar la página entera (AccountScope): el foco irá al título en cuanto aparezca */
export function useHeadingFocusRequest() {
  return useContext(FocusRequest)
}

/**
 * Lleva el foco al título de la página (tras navegar o cambiar de cuenta): ya, si está; si no, en cuanto aparezca
 * (las páginas lo pintan cuando llegan sus datos)
 */
export function useFocusHeading() {
  const request = useContext(FocusRequest)
  return useCallback(() => {
    const heading = document.querySelector<HTMLElement>('main h1')
    // Si ya está dentro (escribiendo el título, que se puso en edición al llegar), se queda donde está
    if (heading) {
      if (!heading.contains(document.activeElement)) heading.focus()
    } else {
      request.current = true
      // Lo que tenía el foco al pedirlo (el enlace pulsado): si sigue ahí, el título se lo lleva
      request.from = document.activeElement
    }
  }, [request])
}

/** Si el foco no se ha ido a otro sitio desde que se pidió llevarlo al título (o se perdió) */
export function headingMayTakeFocus(request: Request) {
  const from = request.from
  request.from = null
  return focusIsLost() || (from != null && document.activeElement === from)
}

/** El título de la página: su h1, enfocable para llevar ahí el foco, y el de la pestaña («Mis mundos · Crisol») */
export function PageTitle({ children, className }: { children: string; className?: string | undefined }) {
  const { t } = useTranslation()
  const request = useContext(FocusRequest)
  useEffect(() => {
    document.title = children === t('app.name') ? children : t('app.pageTitle', { page: children })
  }, [children, t])
  const ref = useCallback(
    (heading: HTMLHeadingElement | null) => {
      if (!heading || !request.current) return
      request.current = false
      // Si mientras llegaba el título la persona ya está en otro sitio, no se le quita el foco
      if (headingMayTakeFocus(request)) heading.focus()
    },
    [request]
  )
  return (
    <h1 ref={ref} tabIndex={-1} className={className}>
      {children}
    </h1>
  )
}
