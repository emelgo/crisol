/**
 * El compendio de un sistema, en su espacio (revisión, tanda 6): el mismo que el de una campaña, sin campaña (todos sus
 * libros; con su propietario, «Entrada nueva»). Y un libro por dentro: el compendio en ese libro, con «← {sistema}»
 * arriba para volver. Lo abierto va en la dirección (ver)
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { Compendium, systemScope } from '../campaign/compendium.tsx'
import { SECTION } from '../components/world-transition.ts'
import styles from './system.module.css'

const compendiumRoute = getRouteApi('/sistemas/$systemId/compendio')
const bookRoute = getRouteApi('/sistemas/$systemId/libros/$bookKey')

export function SystemCompendium() {
  const { systemId } = compendiumRoute.useParams()
  const { ver } = compendiumRoute.useSearch()
  const navigate = compendiumRoute.useNavigate()
  return (
    <Compendium
      worldId=""
      campaignId={systemScope(systemId)}
      ver={ver ?? null}
      onVer={(key) => void navigate({ search: (prev) => ({ ...prev, ver: key ?? undefined }) })}
    />
  )
}

export function SystemBook() {
  const { t } = useTranslation()
  const api = useApi()
  const { systemId, bookKey } = bookRoute.useParams()
  const { ver } = bookRoute.useSearch()
  const navigate = bookRoute.useNavigate()
  const system = useQuery({
    queryKey: ['systemBooks', systemId],
    queryFn: () => api.call('getSystemBooks', { systemId })
  })
  return (
    <>
      {/* La vuelta al Inicio del sistema, arriba a la izquierda (como «‹ Plantillas») */}
      <Link to="/sistemas/$systemId" params={{ systemId }} className={styles.back} viewTransition={SECTION}>
        <ArrowLeft aria-hidden="true" size={16} />
        {system.data?.name ?? t('systemBooks.back')}
      </Link>
      <Compendium
        key={bookKey}
        worldId=""
        campaignId={systemScope(systemId)}
        ver={ver ?? null}
        onVer={(key) => void navigate({ search: (prev) => ({ ...prev, ver: key ?? undefined }) })}
        initialBook={bookKey}
      />
    </>
  )
}
