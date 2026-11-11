/**
 * La hoja de una página: el papel donde se escribe (la página se ve y se edita ya maquetada, paged.tsx) y, desde «⋯»,
 * «Imprimir o descargar»: un cuadro que pregunta cómo (con colores, en blanco y negro o en pergamino; el papel, la
 * numeración, el pie y los secretos) y lo recuerda. Las páginas numeradas quedan para imprimir y el PDF (print.tsx)
 */
import type { Page, SheetSettings } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { type ReactNode, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import dialogStyles from '../../components/dialog.module.css'
import { FormError } from '../../components/field.tsx'
import form from '../../components/form.module.css'
import { Modal } from '../../components/modal.tsx'
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

/** El papel donde se escribe: con el tema de la hoja (el pergamino cambia la letra, para que caiga como al imprimir) */
export function SheetPaper({ page, children }: { page: Page; children: ReactNode }) {
  return (
    <div className={paper.plain} data-theme={sheetOf(page).theme} data-sheet-paper="">
      {children}
    </div>
  )
}

/** El aspecto que se eligió la última vez (para las páginas que aún no tienen el suyo) */
const LOOK_KEY = 'crisol.aspecto-impresion'
const LOOKS = ['color', 'neutro', 'pergamino'] as const

function rememberedLook(): SheetSettings['theme'] | null {
  try {
    const stored = localStorage.getItem(LOOK_KEY)
    return LOOKS.find((look) => look === stored) ?? null
  } catch {
    return null
  }
}

/**
 * «Imprimir o descargar»: pregunta cómo (Enrique, 2026-11-11: «que pida versión con los colores o en blanco y negro»).
 * El aspecto es de esta impresión (va en su dirección) y se recuerda como el de siempre; no cambia la página (ni su
 * letra al escribir). El papel, la numeración y el pie, sí: son de la hoja de la página
 */
export function PrintDialog({ page, onClose }: { page: Page; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const ids = { paper: useId(), first: useId(), look: useId() }
  const current = sheetOf(page)
  // De entrada: el de una página hecha para el pergamino; si no, el de la última vez, o con colores
  const [look, setLook] = useState<SheetSettings['theme']>(
    current.theme === 'pergamino' ? 'pergamino' : (rememberedLook() ?? 'color')
  )
  const [settings, setSettings] = useState<SheetSettings>(current)
  const [secrets, setSecrets] = useState(false)
  const change = (patch: Partial<SheetSettings>) => setSettings((current) => ({ ...current, ...patch }))
  /** El aspecto, recordado; el papel, la numeración y el pie, en la página (si cambiaron) */
  const keep = async () => {
    try {
      localStorage.setItem(LOOK_KEY, look)
    } catch {
      // Sin almacenamiento, la próxima vez vuelve «Con colores»
    }
    if (JSON.stringify(settings) === JSON.stringify(current)) return
    await api.call('updatePage', { pageId: page.id, sheet: settings })
    await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
  }
  const printUrl = `/mundos/${page.worldId}/imprimir/${page.id}?imprimir=1&tema=${look}${secrets ? '&secretos=1' : ''}`
  const print = useMutation({
    mutationFn: async () => {
      // La pestaña se abre ya (al pulsar): después de guardar, el navegador la bloquearía
      const tab = window.open('about:blank', '_blank')
      try {
        await keep()
      } catch (error) {
        tab?.close()
        throw error
      }
      if (tab) tab.location.href = printUrl
      else window.location.assign(printUrl)
    },
    onSuccess: () => dialog.current?.close()
  })
  const download = useMutation({
    mutationFn: async () => {
      await keep()
      return api.downloadPdf(page.id, secrets, look)
    },
    onSuccess: ({ name, data }) => {
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      announce(t('sheet.downloaded', { name }))
      dialog.current?.close()
    }
  })
  // «Desde», al escribirlo (con Intro se descarga ya con él); uno que no vale, al salir vuelve al de antes
  const typeFirst = (input: HTMLInputElement) => {
    const value = Number(input.value)
    if (Number.isInteger(value) && value >= 1 && value <= 999) change({ firstNumber: value })
  }
  const failure = print.error ?? download.error
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={`${dialogStyles.dialog} ${styles.dialog}`}
      onClose={onClose}
    >
      <form
        className={dialogStyles.body}
        onSubmit={(event) => {
          event.preventDefault()
          download.mutate()
        }}
      >
        <h2 id={titleId}>{t('sheet.printTitle')}</h2>
        {/* El aspecto, con una muestra de cada uno */}
        <fieldset className={styles.looks}>
          <legend>{t('sheet.look')}</legend>
          {LOOKS.map((each) => (
            <label key={each} className={styles.look}>
              <input type="radio" name={ids.look} checked={look === each} onChange={() => setLook(each)} />
              {/* Su muestra: la letra y los colores de verdad de ese aspecto */}
              <span className={styles.sample} data-look={each} aria-hidden="true">
                <b>Aa</b>
                <span />
                <span />
              </span>
              {t(`sheet.themes.${each}`)}
            </label>
          ))}
        </fieldset>
        <div className={styles.fields}>
          <div className={styles.line}>
            <label htmlFor={ids.paper}>{t('sheet.paper')}</label>
            <select
              id={ids.paper}
              value={settings.paper}
              onChange={(e) => change({ paper: e.currentTarget.value as SheetSettings['paper'] })}
            >
              <option value="a4">{t('sheet.papers.a4')}</option>
              <option value="letter">{t('sheet.papers.letter')}</option>
            </select>
          </div>
          <div className={styles.line}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={settings.numbers}
                onChange={(e) => change({ numbers: e.currentTarget.checked })}
              />
              {t('sheet.numbers')}
            </label>
            {settings.numbers && (
              <span className={styles.from}>
                <label htmlFor={ids.first}>{t('sheet.firstNumber')}</label>
                <input
                  id={ids.first}
                  type="number"
                  min={1}
                  max={999}
                  className={styles.number}
                  defaultValue={settings.firstNumber}
                  onChange={(e) => typeFirst(e.currentTarget)}
                  onBlur={(e) => {
                    e.currentTarget.value = String(settings.firstNumber)
                  }}
                />
              </span>
            )}
          </div>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.footer}
              onChange={(e) => change({ footer: e.currentTarget.checked })}
            />
            {t('sheet.footer')}
          </label>
          <label className={`${styles.check} ${styles.secrets}`}>
            <input type="checkbox" checked={secrets} onChange={(e) => setSecrets(e.currentTarget.checked)} />
            {t('sheet.includeSecrets')}
          </label>
        </div>
        <FormError message={failure ? errorText(failure) : null} />
        <div className={dialogStyles.actions}>
          <BusyButton type="submit" className={form.button} busy={download.isPending}>
            {t('sheet.pdf')}
          </BusyButton>
          {/* La otra acción: secundaria, con su icono (no se confunde con «Cancelar») */}
          <BusyButton type="button" className={styles.secondary} busy={print.isPending} onClick={() => print.mutate()}>
            <Printer aria-hidden="true" size={16} />
            {t('sheet.print')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => dialog.current?.close()}>
            {t('sheet.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
