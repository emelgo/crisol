/**
 * Los mandos de la hoja: activarla (el máster), sus ajustes en una fila (papel, tema, numeración y pie) y en qué vista
 * la lee cada cuenta (se recuerda por cuenta y página). En pantallas estrechas se abre la sencilla; en escritorio ancho,
 * la hoja va al lado del editor
 */
import type { Page, SheetSettings } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import list from '../../components/list.module.css'
import { preferencesKey } from '../navigation.tsx'
import styles from './controls.module.css'
import { SheetView, useFollowBlock } from './sheet.tsx'

export const DEFAULT_SHEET: SheetSettings = {
  paper: 'a4',
  theme: 'pergamino',
  numbers: true,
  firstNumber: 1,
  footer: true
}

const useMedia = (query: string) => {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const media = matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
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

/** El botón «Hoja» de las acciones de la página: activa o quita la vista de hoja */
export function SheetToggle({ page }: { page: Page }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const save = useSaveSheet(page)
  return (
    <>
      <BusyButton
        className={list.secondary}
        aria-pressed={page.sheet !== null}
        busy={save.isPending}
        onClick={() => save.mutate(page.sheet ? null : DEFAULT_SHEET)}
      >
        {t('sheet.toggle')}
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
 * La página con hoja: la fila de ajustes y la vista que toque. body es el editor (la vista sencilla). Sin hoja, solo
 * el editor
 */
export function SheetLayout({ page, body }: { page: Page; body: ReactNode }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const narrow = useMedia('(max-width: 760px)')
  const wide = useMedia('(min-width: 1500px)')
  const preferences = useQuery({
    queryKey: preferencesKey(page.worldId),
    queryFn: () => api.call('getWikiPreferences', { worldId: page.worldId })
  })
  // En una pantalla estrecha, la sencilla salvo que se pida la hoja en esta visita
  const [showOnNarrow, setShowOnNarrow] = useState(false)
  const view = useMutation({
    mutationFn: (next: 'sheet' | 'simple') =>
      api.call('setPageView', { worldId: page.worldId, pageId: page.id, view: next }),
    onSuccess: (data) => queryClient.setQueryData(preferencesKey(page.worldId), data)
  })
  const panel = useRef<HTMLDivElement>(null)
  const [cursorBlock, setCursorBlock] = useState<string | null>(null)
  const sheetShown = page.sheet !== null && (narrow ? showOnNarrow : !preferences.data?.simplePages.includes(page.id))
  const sideBySide = sheetShown && wide
  // Con las dos a la vez, el cursor del editor lleva la hoja a su bloque
  useEffect(() => {
    if (!sideBySide) return
    const follow = () => {
      const node = document.getSelection()?.anchorNode
      const element = node instanceof Element ? node : node?.parentElement
      const top = element?.closest('.ProseMirror > [data-id]')
      setCursorBlock(top?.getAttribute('data-id') ?? null)
    }
    document.addEventListener('selectionchange', follow)
    return () => document.removeEventListener('selectionchange', follow)
  }, [sideBySide])
  useFollowBlock(sideBySide ? panel.current : null, cursorBlock)

  if (!page.sheet) return <>{body}</>
  const settings = page.sheet
  const toEditor = (id: string) => {
    if (!sideBySide) return
    document.querySelector(`.ProseMirror > [data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center' })
  }
  const switchView = (next: 'sheet' | 'simple') => {
    if (narrow) setShowOnNarrow(next === 'sheet')
    else view.mutate(next)
  }
  return (
    <>
      <SheetSettingsRow page={page} settings={settings}>
        <PrintButtons page={page} />
        <button type="button" className={list.secondary} onClick={() => switchView(sheetShown ? 'simple' : 'sheet')}>
          {t(sheetShown ? 'sheet.toSimple' : 'sheet.toSheet')}
        </button>
      </SheetSettingsRow>
      {!sheetShown ? (
        body
      ) : sideBySide ? (
        <div className={styles.sideBySide}>
          <div className={styles.editor}>{body}</div>
          <div ref={panel} className={styles.panel}>
            <SheetView page={page} settings={settings} onBlockClick={toEditor} />
          </div>
        </div>
      ) : (
        <div className={styles.scroller}>
          <SheetView page={page} settings={settings} />
        </div>
      )}
    </>
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
