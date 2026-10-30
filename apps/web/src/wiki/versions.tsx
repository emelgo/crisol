/**
 * Las versiones del texto de la página: quién (una persona o Claude) y cuándo, «Ver» en solo lectura (con sus
 * secretos) y «Restaurar», que es un cambio nuevo y se puede deshacer desde el historial
 */
import type { Page } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/core'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import list from '../components/list.module.css'
import { ContentView } from './content.tsx'
import styles from './versions.module.css'

/** Cuelga de ['pages', mundo, 'content', página]: el aviso de que cambió el texto la vacía */
const versionsKey = (page: Page) => ['pages', page.worldId, 'content', page.id, 'versions']

export function Versions({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const versions = useQuery({
    queryKey: versionsKey(page),
    queryFn: () => api.call('listPageVersions', { pageId: page.id }),
    enabled: open
  })
  const shown = useQuery({
    queryKey: [...versionsKey(page), viewing],
    queryFn: () => api.call('getPageVersion', { pageId: page.id, versionId: viewing ?? '' }),
    enabled: Boolean(viewing)
  })
  const when = (at: string) =>
    new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at))
  const restore = useMutation({
    mutationFn: (version: { id: string; at: string }) =>
      api.call('restorePageVersion', { pageId: page.id, versionId: version.id }),
    onSuccess: async (_, version) => {
      announce(t('versions.restored', { when: when(version.at) }))
      setViewing(null)
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId, 'content', page.id] })
    },
    onError: (error) => announce(errorText(error))
  })
  return (
    <section aria-labelledby={`${id}-title`} className={styles.panel}>
      <h2 id={`${id}-title`}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
          {t('versions.title')}
        </button>
      </h2>
      {open && versions.data && versions.data.versions.length === 0 && (
        <p className={styles.empty}>{t('versions.none')}</p>
      )}
      {open && versions.data && versions.data.versions.length > 0 && (
        <ul className={list.list}>
          {versions.data.versions.map((version) => {
            const who = version.via === 'ai' ? t('versions.claude') : (version.by?.name ?? t('versions.someone'))
            const label = `${when(version.at)} · ${who}`
            return (
              <li key={version.id} className={styles.item}>
                <span>
                  {label}
                  {version.current && <span className={styles.current}> {t('versions.current')}</span>}
                </span>
                <span className={list.actions}>
                  <button
                    type="button"
                    className={list.secondary}
                    aria-expanded={viewing === version.id}
                    aria-label={t('versions.view', { version: label })}
                    onClick={() => setViewing(viewing === version.id ? null : version.id)}
                  >
                    {t('versions.viewShort')}
                  </button>
                  {!version.current && (
                    <BusyButton
                      className={list.secondary}
                      busy={restore.isPending && restore.variables?.id === version.id}
                      aria-label={t('versions.restore', { version: label })}
                      onClick={() => restore.mutate(version)}
                    >
                      {t('versions.restoreShort')}
                    </BusyButton>
                  )}
                </span>
                {viewing === version.id && shown.data && (
                  <section aria-label={t('versions.content', { version: label })} className={styles.content}>
                    <ContentView blocks={shown.data.blocks as JSONContent[]} worldId={page.worldId} />
                  </section>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
