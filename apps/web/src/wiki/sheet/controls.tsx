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

/** Toda página es una hoja: sin ajustes propios, estos (una columna y el tema neutro, con la letra de la app) */
export const DEFAULT_SHEET: SheetSettings = {
  paper: 'a4',
  theme: 'neutro',
  numbers: true,
  firstNumber: 1,
  footer: true,
  columns: 1
}

export const sheetOf = (page: Page): SheetSettings => page.sheet ?? DEFAULT_SHEET

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
 * Con la hoja puesta, el texto se escribe ya maquetado en sus páginas (paged.tsx), con los colores y la letra de la
 * app: el papel y la letra del tema son para imprimir y el PDF. Sin hoja, tal cual
 */
export function SheetPaper({ page, children }: { page: Page; children: ReactNode }) {
  return (
    <div className={paper.plain} data-theme={sheetOf(page).theme} data-sheet-paper="">
      {children}
    </div>
  )
}

/** En «⋯»: las columnas de la página y, en su desplegable, imprimir y el PDF con los ajustes de la hoja */
export function SheetMenu({ page }: { page: Page }) {
  const { t } = useTranslation()
  const [printing, setPrinting] = useState(false)
  const id = useId()
  return (
    <SheetSettingsRow page={page} settings={sheetOf(page)}>
      {(row) => (
        <>
          <button
            type="button"
            className={styles.opener}
            aria-expanded={printing}
            aria-controls={id}
            onClick={() => setPrinting(!printing)}
          >
            {t('sheet.printing')}
            <span aria-hidden="true">▸</span>
          </button>
          {printing && (
            <div id={id} className={styles.printing}>
              {row.fields}
              <PrintButtons page={page} />
            </div>
          )}
        </>
      )}
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
      <div className={styles.printActions}>
        <a className={styles.printButton} href={printUrl} target="_blank" rel="noopener">
          {t('sheet.print')}
        </a>
        <BusyButton className={styles.printButton} busy={download.isPending} onClick={() => download.mutate()}>
          {t('sheet.pdf')}
        </BusyButton>
      </div>
      {download.error && (
        <span role="alert" className={styles.error}>
          {errorText(download.error)}
        </span>
      )}
    </>
  )
}

/** Los ajustes de la hoja. Cambian al momento (sin esperar al servidor); si no se guardan, lo dice */
function SheetSettingsRow({
  page,
  settings,
  children
}: {
  page: Page
  settings: SheetSettings
  children: (row: {
    local: SheetSettings
    change: (patch: Partial<SheetSettings>) => void
    fields: ReactNode
  }) => ReactNode
}) {
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
  const fields = (
    <>
      <div className={styles.line}>
        <label htmlFor={ids.paper}>{t('sheet.paper')}</label>
        <select
          id={ids.paper}
          value={local.paper}
          onChange={(e) => change({ paper: e.currentTarget.value as SheetSettings['paper'] })}
        >
          <option value="a4">{t('sheet.papers.a4')}</option>
          <option value="letter">{t('sheet.papers.letter')}</option>
        </select>
      </div>
      <div className={styles.line}>
        <label htmlFor={ids.theme}>{t('sheet.theme')}</label>
        <select
          id={ids.theme}
          value={local.theme}
          onChange={(e) => change({ theme: e.currentTarget.value as SheetSettings['theme'] })}
        >
          <option value="pergamino">{t('sheet.themes.pergamino')}</option>
          <option value="neutro">{t('sheet.themes.neutro')}</option>
        </select>
      </div>
      <div className={styles.line}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={local.numbers}
            onChange={(e) => change({ numbers: e.currentTarget.checked })}
          />
          {t('sheet.numbers')}
        </label>
        {local.numbers && (
          <span className={styles.from}>
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
          </span>
        )}
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={local.footer} onChange={(e) => change({ footer: e.currentTarget.checked })} />
        {t('sheet.footer')}
      </label>
    </>
  )
  return (
    <div className={styles.row}>
      {children({ local, change, fields })}
      {save.error && (
        <span role="alert" className={styles.error}>
          {errorText(save.error)}
        </span>
      )}
    </div>
  )
}
