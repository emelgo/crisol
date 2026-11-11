/**
 * Exportar en Markdown: una página (sola o con sus subpáginas) o la wiki entera, en un .zip que se descarga. Lo que
 * pasa se dice a los lectores de pantalla
 */
import type { ExportInput, Page } from '@crisol/contracts'
import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import list from '../components/list.module.css'
import { MenuGroup, MenuItem } from '../components/menu.tsx'
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

/**
 * «Exportar» de una página, en el menú común: con subpáginas, un desplegable de verdad (con su flecha) para elegir si
 * sola o con ellas; sin ellas, una fila que exporta ya
 */
export function ExportPage({ page }: { page: Page }) {
  const { t } = useTranslation()
  const run = useExport()
  const exportIt = (children: boolean) =>
    run.mutate({ worldId: page.worldId, pageId: page.id, ...(children ? { children: true } : {}) })
  if (!page.hasChildren) {
    return (
      <MenuItem disabled={run.isPending} onClick={() => exportIt(false)}>
        <Download aria-hidden="true" size={15} />
        {t('export.page')}
      </MenuItem>
    )
  }
  return (
    <MenuGroup label={t('export.page')} icon={<Download aria-hidden="true" size={15} />}>
      <MenuItem disabled={run.isPending} onClick={() => exportIt(false)}>
        {t('export.only')}
      </MenuItem>
      <MenuItem disabled={run.isPending} onClick={() => exportIt(true)}>
        {t('export.withChildren')}
      </MenuItem>
    </MenuGroup>
  )
}

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
