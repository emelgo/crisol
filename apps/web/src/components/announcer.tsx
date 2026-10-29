import { createContext, type ReactNode, useCallback, useContext, useState } from 'react'
import styles from './announcer.module.css'

const AnnounceContext = createContext<(message: string) => void>(() => {})

/**
 * La región viva de la web: una sola, fija y oculta a la vista, para que los lectores de pantalla digan lo que pasa
 * («Guardado», «Copiado», un aviso nuevo). Fija porque una región que aparece ya con su texto casi nunca se lee
 */
export function Announcer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState({ text: '', id: 0 })
  const announce = useCallback((text: string) => setMessage((current) => ({ text, id: current.id + 1 })), [])
  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" className={styles.announcer}>
        {/* Cada anuncio, un nodo nuevo: así se lee aunque repita el texto del anterior */}
        {message.text && <p key={message.id}>{message.text}</p>}
      </div>
    </AnnounceContext.Provider>
  )
}

/** Con qué anunciar algo a los lectores de pantalla */
export function useAnnounce() {
  return useContext(AnnounceContext)
}
