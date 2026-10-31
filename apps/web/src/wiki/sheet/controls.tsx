/**
 * La hoja de una página: el icono que la pone o la quita, el papel donde se escribe (con la hoja puesta, la página se
 * ve y se edita sobre él, a dos columnas) y, en «⋯», sus ajustes, imprimir y el PDF. Las páginas numeradas quedan para
 * imprimir y el PDF (print.tsx)
 */
import type { Page, SheetSettings } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import list from '../../components/list.module.css'
import styles from './controls.module.css'
import '@fontsource/alegreya/400.css'
import '@fontsource/alegreya/400-italic.css'
import '@fontsource/alegreya/700.css'
import paper from './paper.module.css'

export const DEFAULT_SHEET: SheetSettings = {
  paper: 'a4',
  theme: 'pergamino',
  numbers: true,
  firstNumber: 1,
  footer: true
}

/** Guarda la página con otros ajustes de hoja (o sin hoja) */
function useSaveSheet(page: Page) {
  const api = useApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sheet: SheetSettings | null) => api.call('updatePage', { pageId: page.id, sheet }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  })
}

/** El icono «Hoja» de la cabecera de la página: pone o quita la hoja */
export function SheetToggle({ page }: { page: Page }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveSheet(page)
  return (
    <>
      <BusyButton
        className={list.secondary}
        aria-label={t('sheet.toggle')}
        title={t('sheet.toggle')}
        aria-pressed={page.sheet !== null}
        busy={save.isPending}
        onClick={() => save.mutate(page.sheet ? null : DEFAULT_SHEET)}
      >
        <ScrollText aria-hidden="true" size={18} />
      </BusyButton>
      {save.error && (
        <span role="alert" className={styles.error}>
          {errorText(save.error)}
        </span>
      )}
    </>
  )
}

/**
 * Con la hoja puesta, el papel: la página (título, propiedades y texto) se ve y se escribe sobre él, con el tema y la
 * letra de la hoja y a dos columnas (una en el móvil). Sin hoja, tal cual
 */
export function SheetPaper({ page, children }: { page: Page; children: ReactNode }) {
  if (!page.sheet) return <>{children}</>
  return (
    <div className={paper.paper} data-theme={page.sheet.theme} data-sheet-paper="">
      {children}
    </div>
  )
}

/** En «⋯», con la hoja puesta: sus ajustes, imprimir y el PDF */
export function SheetMenu({ page }: { page: Page }) {
  if (!page.sheet) return null
  return (
    <SheetSettingsRow page={page} settings={page.sheet}>
      <PrintButtons page={page} />
    </SheetSettingsRow>
  )
}

/** Imprimir (por el diálogo del navegador) y descargar el PDF que saca el servidor; con o sin secretos */
function PrintButtons({ page }: { page: Page }) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const secretsId = useId()
  const [secrets, setSecrets] = useState(false)
  const download = useMutation({
    mutationFn: () => api.downloadPdf(page.id, secrets),
    onSuccess: ({ name, data }) => {
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      announce(t('sheet.downloaded', { name }))
    }
  })
  const printUrl = `/mundos/${page.worldId}/imprimir/${page.id}?imprimir=1${secrets ? '&secretos=1' : ''}`
  return (
    <>
      <span className={styles.check}>
        <input id={secretsId} type="checkbox" checked={secrets} onChange={(e) => setSecrets(e.currentTarget.checked)} />
        <label htmlFor={secretsId}>{t('sheet.includeSecrets')}</label>
      </span>
      <a className={list.secondary} href={printUrl} target="_blank" rel="noopener">
        {t('sheet.print')}
      </a>
      <BusyButton className={list.secondary} busy={download.isPending} onClick={() => download.mutate()}>
        {t('sheet.pdf')}
      </BusyButton>
      {download.error && (
        <span role="alert" className={styles.error}>
          {errorText(download.error)}
        </span>
      )}
    </>
  )
}

/** Los ajustes de la hoja, en una fila. Cambian al momento (sin esperar al servidor); si no se guardan, lo dice */
function SheetSettingsRow({ page, settings, children }: { page: Page; settings: SheetSettings; children: ReactNode }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveSheet(page)
  const [local, setLocal] = useState(settings)
  useEffect(() => setLocal(settings), [settings])
  const ids = { paper: useId(), theme: useId(), first: useId() }
  const change = (patch: Partial<SheetSettings>) => {
    const next = { ...local, ...patch }
    setLocal(next)
    save.mutate(next, { onError: () => setLocal(settings) })
  }
  const saveFirst = (input: HTMLInputElement) => {
    const value = Number(input.value)
    if (Number.isInteger(value) && value >= 1 && value <= 999) {
      if (value !== local.firstNumber) change({ firstNumber: value })
    } else input.value = String(local.firstNumber)
  }
  return (
    <fieldset className={styles.row}>
      <legend className={styles.legend}>{t('sheet.settings')}</legend>
      <label htmlFor={ids.paper}>{t('sheet.paper')}</label>
      <select
        id={ids.paper}
        value={local.paper}
        onChange={(e) => change({ paper: e.currentTarget.value as SheetSettings['paper'] })}
      >
        <option value="a4">{t('sheet.papers.a4')}</option>
        <option value="letter">{t('sheet.papers.letter')}</option>
      </select>
      <label htmlFor={ids.theme}>{t('sheet.theme')}</label>
      <select
        id={ids.theme}
        value={local.theme}
        onChange={(e) => change({ theme: e.currentTarget.value as SheetSettings['theme'] })}
      >
        <option value="pergamino">{t('sheet.themes.pergamino')}</option>
        <option value="neutro">{t('sheet.themes.neutro')}</option>
      </select>
      <label className={styles.check}>
        <input type="checkbox" checked={local.numbers} onChange={(e) => change({ numbers: e.currentTarget.checked })} />
        {t('sheet.numbers')}
      </label>
      {local.numbers && (
        <>
          <label htmlFor={ids.first}>{t('sheet.firstNumber')}</label>
          <input
            id={ids.first}
            type="number"
            min={1}
            max={999}
            className={styles.number}
            defaultValue={local.firstNumber}
            key={local.firstNumber}
            onBlur={(e) => saveFirst(e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveFirst(e.currentTarget)
            }}
          />
        </>
      )}
      <label className={styles.check}>
        <input type="checkbox" checked={local.footer} onChange={(e) => change({ footer: e.currentTarget.checked })} />
        {t('sheet.footer')}
      </label>
      {children}
      {save.error && (
        <span role="alert" className={styles.error}>
          {errorText(save.error)}
        </span>
      )}
    </fieldset>
  )
}
