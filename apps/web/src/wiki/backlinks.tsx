/**
 * Los enlaces de una página: quién la enlaza (con el trozo donde lo hace) y dónde se la nombra sin enlazar, con
 * «Enlazar» de un clic. Va bajo el cuerpo; su sitio a la derecha llega con el repaso de la interfaz
 */
import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import list from '../components/list.module.css'
import styles from './backlinks.module.css'

/** La consulta de los enlaces de una página (cuelga de ['pages', mundo]: se pone al día con los avisos de páginas) */
export const pageLinksKey = (worldId: string, pageId: string) => ['pages', worldId, 'links', pageId]

export function Backlinks({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const id = useId()
  const links = useQuery({
    queryKey: pageLinksKey(page.worldId, page.id),
    queryFn: () => api.call('getPageLinks', { pageId: page.id })
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
  const where = (path: string[]) => (path.length > 0 ? path.join(' / ') : null)
  return (
    <section aria-labelledby={`${id}-title`} className={styles.panel}>
      <h2 id={`${id}-title`}>{t('backlinks.title')}</h2>
      {/* Sin nada: una sola línea; si no, cada lista con su título */}
      {data && data.incoming.length === 0 && data.mentions.length === 0 && (
        <p className={styles.empty}>{t('backlinks.none')}</p>
      )}
      {data && data.incoming.length > 0 && <h3 id={`${id}-in`}>{t('backlinks.incoming')}</h3>}
      {data && data.incoming.length > 0 && (
        <ul aria-labelledby={`${id}-in`} className={list.list}>
          {data.incoming.map((item) => (
            <li key={item.pageId} className={styles.item}>
              <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId: page.worldId, pageId: item.pageId }}>
                {item.title}
              </Link>
              {where(item.path) && <span className={styles.path}>{where(item.path)}</span>}
              {item.inSecret && <span className={styles.secret}>{t('backlinks.inSecret')}</span>}
              {item.fragment && <p className={styles.fragment}>{item.fragment}</p>}
            </li>
          ))}
        </ul>
      )}
      {data && data.mentions.length > 0 && <h3 id={`${id}-mentions`}>{t('backlinks.mentions')}</h3>}
      {data && data.mentions.length > 0 && (
        <ul aria-labelledby={`${id}-mentions`} className={list.list}>
          {data.mentions.map((item) => (
            <li key={item.pageId} className={styles.item}>
              <Link to="/mundos/$worldId/wiki/$pageId" params={{ worldId: page.worldId, pageId: item.pageId }}>
                {item.title}
              </Link>
              {item.inSecret && <span className={styles.secret}>{t('backlinks.inSecret')}</span>}
              <p className={styles.fragment}>{item.fragment}</p>
              <BusyButton
                className={list.secondary}
                busy={link.isPending && link.variables?.pageId === item.pageId}
                aria-label={t('backlinks.linkIn', { title: item.title })}
                onClick={() => link.mutate({ pageId: item.pageId, title: item.title })}
              >
                {t('backlinks.link')}
              </BusyButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Cuántas otras páginas enlazan a esta (para avisar al borrarla); null mientras no se sabe */
export function useLinkedBy(page: Page, enabled: boolean) {
  const api = useApi()
  const links = useQuery({
    queryKey: pageLinksKey(page.worldId, page.id),
    queryFn: () => api.call('getPageLinks', { pageId: page.id }),
    enabled
  })
  return links.data ? links.data.incoming.length : null
}
