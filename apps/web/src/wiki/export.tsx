/**
 * Exportar en Markdown: una página (sola o con sus subpáginas) o la wiki entera, en un .zip que se descarga. Lo que
 * pasa se dice a los lectores de pantalla
 */
import type { ExportInput, Page } from '@crisol/contracts'
import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import list from '../components/list.module.css'
import { saveFile as save } from '../components/save-file.ts'

export function useExport() {
  const { t } = useTranslation()
  const api = useApi()
  const announce = useAnnounce()
  const errorText = useErrorText()
  return useMutation({
    mutationFn: (input: ExportInput) => api.exportWiki(input),
    onSuccess: ({ name, data }) => {
      save(name, data)
      announce(t('export.done', { name }))
    },
    onError: (error) => announce(errorText(error))
  })
}

/** «Exportar» de una página: con subpáginas, se elige si solas o con ellas */
export function ExportPage({ page }: { page: Page }) {
  const { t } = useTranslation()
  const run = useExport()
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!page.hasChildren) {
    return (
      <BusyButton
        className={list.secondary}
        busy={run.isPending}
        onClick={() => run.mutate({ worldId: page.worldId, pageId: page.id })}
      >
        {t('export.page')}
      </BusyButton>
    )
  }
  return (
    <>
      <button
        type="button"
        className={list.secondary}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {t('export.page')}
      </button>
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: dos botones juntos, no un grupo de campos de un formulario
        <div id={id} role="group" aria-label={t('export.page')} className={list.actions}>
          <BusyButton
            className={list.secondary}
            busy={run.isPending}
            onClick={() => run.mutate({ worldId: page.worldId, pageId: page.id })}
          >
            {t('export.only')}
          </BusyButton>
          <BusyButton
            className={list.secondary}
            busy={run.isPending}
            onClick={() => run.mutate({ worldId: page.worldId, pageId: page.id, children: true })}
          >
            {t('export.withChildren')}
          </BusyButton>
        </div>
      )}
    </>
  )
}

/** «Exportar la wiki»: el mundo entero */
/** «Exportar todas las páginas»: un icono en la esquina de la ficha del árbol */
export function ExportWiki({ worldId, className }: { worldId: string; className?: string | undefined }) {
  const { t } = useTranslation()
  const run = useExport()
  return (
    <BusyButton
      className={className ?? list.secondary}
      busy={run.isPending}
      aria-label={t('export.wiki')}
      title={t('export.wiki')}
      onClick={() => run.mutate({ worldId })}
    >
      <Download aria-hidden="true" size={15} />
    </BusyButton>
  )
}
