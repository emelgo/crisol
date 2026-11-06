/**
 * Una imagen de un sistema (docs/specs/imagenes.md), por su ruta: el retrato de una criatura, el icono de un objeto. Si
 * no se puede cargar, se queda el icono del tipo (o nada)
 */
import { useState } from 'react'

export const systemImageUrl = (systemId: string, path: string) =>
  `/api/system-images/${systemId}?path=${encodeURIComponent(path)}`

export function SystemImage({
  systemId,
  path,
  className,
  fallback = null
}: {
  systemId: string | null | undefined
  path: string | null | undefined
  className?: string
  fallback?: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)
  if (!systemId || !path || failed) return <>{fallback}</>
  return (
    <img
      src={systemImageUrl(systemId, path)}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
