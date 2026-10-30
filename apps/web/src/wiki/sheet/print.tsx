/**
 * La ruta de impresión: solo las páginas de la hoja, sin nada de la interfaz, con el papel de la hoja en `@page`. Las
 * notas ocultas no salen nunca y los secretos solo con «Incluir secretos». Al acabar de paginar lo dice
 * (`data-sheet-ready`, para el PDF del servidor) y, si se pidió, abre el diálogo de imprimir del navegador
 */
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { DEFAULT_SHEET } from './controls.tsx'
import styles from './print.module.css'
import { SheetView } from './sheet.tsx'

const route = getRouteApi('/mundos/$worldId/imprimir/$pageId')

export interface PrintParams {
  secretos?: true
  imprimir?: true
}

export const printParams = (search: Record<string, unknown>): PrintParams => ({
  ...(search.secretos === true || search.secretos === '1' || search.secretos === 1 ? { secretos: true } : {}),
  ...(search.imprimir === true || search.imprimir === '1' || search.imprimir === 1 ? { imprimir: true } : {})
})

export function PrintPage() {
  const { t } = useTranslation()
  const api = useApi()
  const { pageId } = route.useParams()
  const { secretos, imprimir } = route.useSearch()
  const page = useQuery({ queryKey: ['print', pageId], queryFn: () => api.call('getPage', { pageId }) })
  useEffect(() => {
    if (page.data) document.title = t('app.pageTitle', { page: page.data.title })
    return () => {
      delete document.body.dataset.sheetReady
    }
  }, [page.data, t])
  const ready = useCallback(() => {
    document.body.dataset.sheetReady = 'true'
    if (imprimir) window.print()
  }, [imprimir])
  if (!page.data) return null
  const settings = page.data.sheet ?? DEFAULT_SHEET
  return (
    <div className={styles.print}>
      <style>{`@page { size: ${settings.paper === 'letter' ? 'letter' : 'A4'}; margin: 0 }`}</style>
      <h1 className={styles.title}>{page.data.title}</h1>
      <SheetView page={page.data} settings={settings} print={{ secrets: secretos === true }} onReady={ready} />
    </div>
  )
}
