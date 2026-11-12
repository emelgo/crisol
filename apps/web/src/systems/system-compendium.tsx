/**
 * El compendio de un sistema, en su espacio (revisión, tanda 6): el mismo que el de una campaña, sin campaña (todos sus
 * libros; con su propietario, «Entrada nueva»). Y un libro por dentro, con «← {sistema}» arriba para volver: sus
 * capítulos (ADR-0025) y el compendio en ese libro, en dos pestañas. Lo abierto va en la dirección (ver, capitulo, vista)
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { BookTabs, type BookView } from '../books/book-tabs.tsx'
import { BookReader } from '../books/reader.tsx'
import { Compendium, systemScope } from '../campaign/compendium.tsx'
import { PageTitle } from '../components/page-title.tsx'
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
  const { ver, capitulo, vista } = bookRoute.useSearch()
  const navigate = bookRoute.useNavigate()
  const system = useQuery({
    queryKey: ['systemBooks', systemId],
    queryFn: () => api.call('getSystemBooks', { systemId })
  })
  const book = system.data?.books.find((each) => each.key === bookKey)
  // Con capítulos (o quien puede escribirlos), sus dos pestañas; se abre en los capítulos si los tiene
  const withChapters = Boolean(book && (book.chapters > 0 || system.data?.editable))
  const view: BookView = !withChapters ? 'entradas' : (vista ?? (book && book.chapters > 0 ? 'capitulos' : 'entradas'))
  const tabs = withChapters ? (
    <BookTabs
      current={view}
      chapters={{
        to: '/sistemas/$systemId/libros/$bookKey',
        params: { systemId, bookKey },
        search: { vista: 'capitulos' }
      }}
      entries={{
        to: '/sistemas/$systemId/libros/$bookKey',
        params: { systemId, bookKey },
        search: { vista: 'entradas' }
      }}
    />
  ) : undefined
  return (
    <div className={styles.bookPage}>
      {/* La vuelta al Inicio del sistema, arriba a la izquierda (como «‹ Plantillas»), sin empujar el título */}
      <Link to="/sistemas/$systemId" params={{ systemId }} className={styles.back} viewTransition={SECTION}>
        <ArrowLeft aria-hidden="true" size={16} />
        {system.data?.name ?? t('systemBooks.back')}
      </Link>
      {view === 'capitulos' && book ? (
        <BookReader
          key={bookKey}
          systemId={systemId}
          source={bookKey}
          chapterId={capitulo ?? null}
          onChapter={(id) =>
            void navigate({ search: (prev) => ({ ...prev, vista: 'capitulos', capitulo: id ?? undefined }) })
          }
          chapterHref={(id) => `/sistemas/${systemId}/libros/${bookKey}?vista=capitulos&capitulo=${id}`}
          head={
            <>
              <PageTitle>{book.name}</PageTitle>
              {tabs}
            </>
          }
        />
      ) : (
        <Compendium
          key={bookKey}
          worldId=""
          campaignId={systemScope(systemId)}
          ver={ver ?? null}
          onVer={(key) => void navigate({ search: (prev) => ({ ...prev, ver: key ?? undefined }) })}
          initialBook={bookKey}
          {...(book ? { title: book.name } : {})}
          tabs={tabs}
        />
      )}
    </div>
  )
}
