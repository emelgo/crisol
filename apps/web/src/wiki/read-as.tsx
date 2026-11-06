/**
 * Leer las páginas como jugador (ADR-0017): desde qué campaña y, el máster, como qué personaje («Ver como jugador»).
 * Las piezas de la wiki que leen (lo de dentro de una página, sus enlaces, sus tablas) lo añaden a lo que piden, y sus
 * enlaces llevan a la vista de la campaña en lugar de a la del mundo
 */
import { Link } from '@tanstack/react-router'
import { createContext, type ReactNode, useContext } from 'react'

export interface ReadAs {
  campaignId: string
  /** El máster viendo como un personaje (o «campaign»: la campaña, sin excepciones) */
  asCharacterId?: string | undefined
}

const ReadAsContext = createContext<ReadAs | null>(null)

export function ReadAsProvider({ value, children }: { value: ReadAs; children: ReactNode }) {
  return <ReadAsContext.Provider value={value}>{children}</ReadAsContext.Provider>
}

/** Desde dónde se lee: null en la wiki del mundo (el máster, todo) */
export const useReadAs = () => useContext(ReadAsContext)

/** Lo que se añade a lo que se pide a la API */
export const readAsInput = (readAs: ReadAs | null) =>
  readAs
    ? { campaignId: readAs.campaignId, ...(readAs.asCharacterId ? { asCharacterId: readAs.asCharacterId } : {}) }
    : {}

/** Lo que se añade al final de una consulta para no mezclar lo que ve cada uno */
export const readAsKey = (readAs: ReadAs | null) => (readAs ? [readAs.campaignId, readAs.asCharacterId ?? null] : [])

/** Un enlace a una página: a la del mundo o, leyendo como jugador, a la de la campaña */
export function PageLink({
  worldId,
  pageId,
  className,
  onClick,
  children
}: {
  worldId: string
  pageId: string
  className?: string | undefined
  onClick?: (() => void) | undefined
  children: ReactNode
}) {
  const readAs = useReadAs()
  if (readAs) {
    return (
      <Link
        to="/mundos/$worldId/campanas/$campaignId/paginas/$pageId"
        params={{ worldId, campaignId: readAs.campaignId, pageId }}
        search={readAs.asCharacterId ? { como: readAs.asCharacterId } : {}}
        className={className}
        onClick={onClick}
      >
        {children}
      </Link>
    )
  }
  return (
    <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId, pageId }} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}
