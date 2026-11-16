/**
 * Los enlaces de una página: quién la enlaza (con el trozo donde lo hace) y dónde se la nombra sin enlazar, con
 * «Enlazar» de un clic. Va bajo el cuerpo; su sitio a la derecha llega con el repaso de la interfaz
 */
import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarRange, FileText, Link2 } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { Icon } from '../components/icon.tsx'
import styles from './backlinks.module.css'
import { PageLink, readAsInput, readAsKey, useReadAs } from './read-as.tsx'

/** La consulta de los enlaces de una página (cuelga de ['pages', mundo]: se pone al día con los avisos de páginas) */
export const pageLinksKey = (worldId: string, pageId: string) => ['pages', worldId, 'links', pageId]

export function Backlinks({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const id = useId()
  const readAs = useReadAs()
  const links = useQuery({
    queryKey: [...pageLinksKey(page.worldId, page.id), ...readAsKey(readAs)],
    queryFn: () => api.call('getPageLinks', { pageId: page.id, ...readAsInput(readAs) })
  })
  const link = useMutation({
    mutationFn: (source: { pageId: string; title: string }) =>
      api.call('linkMention', { sourcePageId: source.pageId, targetPageId: page.id }),
    onSuccess: async (result, source) => {
      announce(t(result.linked ? 'backlinks.linked' : 'backlinks.notLinked', { title: source.title }))
      await queryClient.invalidateQueries({ queryKey: pageLinksKey(page.worldId, page.id) })
    },
    onError: (error) => announce(errorText(error))
  })
  const data = links.data
  const pageIcon = (icon: string | null | undefined) => (
    <span aria-hidden="true" className={styles.icon}>
      {icon ? <Icon value={icon} /> : <FileText size={14} />}
    </span>
  )
  // Como en Everlore: «Mencionado en», arriba del panel, una lista corta de páginas; las que la nombran sin enlazarla,
  // debajo, con «Enlazar» al pasar por encima. Los trozos de texto, al dejar el ratón encima (title)
  return (
    <section aria-labelledby={`${id}-title`} className={styles.panel}>
      <h2 id={`${id}-title`} className={styles.title}>
        <Link2 aria-hidden="true" size={12} />
        {t('backlinks.title')}
      </h2>
      {data && data.incoming.length === 0 && data.mentions.length === 0 && !data.events?.length && (
        <p className={styles.empty}>{t('backlinks.none')}</p>
      )}
      {data && data.incoming.length > 0 && (
        <ul aria-labelledby={`${id}-title`} className={styles.list}>
          {data.incoming.map((item) => (
            <li key={item.pageId} className={styles.item} title={item.fragment ?? undefined}>
              <PageLink worldId={page.worldId} pageId={item.pageId}>
                {pageIcon(null)}
                <span className={styles.name}>{item.title}</span>
              </PageLink>
              {item.inSecret && <span className={styles.secret}>{t('backlinks.inSecret')}</span>}
            </li>
          ))}
        </ul>
      )}
      {/* Los eventos de las cronologías enlazados a ella (módulo 8): discretos, para el máster */}
      {data?.events && data.events.length > 0 && (
        <>
          <h3 id={`${id}-events`} className={styles.subtitle}>
            {t('backlinks.events')}
          </h3>
          <ul aria-labelledby={`${id}-events`} className={styles.list}>
            {data.events.map((event) => (
              <li key={event.id} className={styles.item}>
                <Link to="/mundos/$worldId/calendarios" params={{ worldId: page.worldId }}>
                  <span aria-hidden="true" className={styles.icon}>
                    <CalendarRange size={14} />
                  </span>
                  <span className={styles.name}>{event.title}</span>
                </Link>
                {event.text && <span className={styles.secret}>{event.text}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {data && data.mentions.length > 0 && (
        <>
          <h3 id={`${id}-mentions`} className={styles.subtitle}>
            {t('backlinks.mentions')}
          </h3>
          <ul aria-labelledby={`${id}-mentions`} className={styles.list}>
            {data.mentions.map((item) => (
              <li key={item.pageId} className={styles.item} title={item.fragment}>
                <PageLink worldId={page.worldId} pageId={item.pageId}>
                  {pageIcon(null)}
                  <span className={styles.name}>{item.title}</span>
                </PageLink>
                {/* Enlazar es escribir: no leyendo como jugador */}
                {!readAs && (
                  <BusyButton
                    className={styles.linkButton}
                    busy={link.isPending && link.variables?.pageId === item.pageId}
                    aria-label={t('backlinks.linkIn', { title: item.title })}
                    onClick={() => link.mutate({ pageId: item.pageId, title: item.title })}
                  >
                    {t('backlinks.link')}
                  </BusyButton>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Cuántas otras páginas enlazan a esta (para avisar al borrarla); null mientras no se sabe */
export function useLinkedBy(page: Pick<Page, 'id' | 'worldId'>, enabled: boolean) {
  const api = useApi()
  const links = useQuery({
    queryKey: pageLinksKey(page.worldId, page.id),
    queryFn: () => api.call('getPageLinks', { pageId: page.id }),
    enabled
  })
  return links.data ? linkingCount(links.data) : null
}

/** Cuántas páginas la enlazan: desde su texto o desde un campo (como la Facción de un PNJ), cada una una vez */
export function linkingCount(links: {
  incoming: readonly { pageId: string }[]
  fields: readonly { pageId: string }[]
}) {
  return new Set([...links.incoming, ...links.fields].map((link) => link.pageId)).size
}
