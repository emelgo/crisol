/**
 * Avanzado, en el editor de un sistema: el documento entero en JSON, comprobado al escribirlo, con las líneas que tienen
 * problemas marcadas y, al lado, la lista de problemas, que llevan a su línea. Arriba, bajar el sistema o subir un
 * archivo que lo reemplaza: si tiene un solo error, no se guarda nada
 */
import type { SystemFull } from '@crisol/contracts'
import { fitsFormat, jsonLines, lineOf, type Problem, type System, validateFile, validateSystem } from '@crisol/systems'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, Download, FileJson, Info, Upload } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import dialogStyles from '../../components/dialog.module.css'
import { FormError } from '../../components/field.tsx'
import form from '../../components/form.module.css'
import { Modal } from '../../components/modal.tsx'
import { saveFile } from '../../components/save-file.ts'
import cards from '../../routes/world-card.module.css'
import { ProblemList } from '../screen.tsx'
import styles from './editor.module.css'

/** El alto de cada línea y el margen de arriba del texto, en píxeles (los mismos que en el CSS) */
const LINE = 20
const PAD = 8

interface JsonState {
  text: string
  /** El borrador que da el texto (para saber si el borrador ha cambiado por otro lado: Cancelar) */
  synced: string
  /** El texto no es un JSON (y en qué línea se ve), o no tiene la forma de un sistema (y sus problemas) */
  bad: { line: number | null } | { problems: Problem[] } | null
}

/** La línea de una posición del texto */
function lineAt(text: string, position: number) {
  let line = 1
  for (let i = 0; i < position && i < text.length; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

/**
 * El texto de Avanzado, mientras se ve: empieza con el borrador y, si lo que se escribe tiene la forma de un sistema
 * (aunque algún valor no valga), pasa al borrador. Si no, el borrador se queda como estaba y no se guarda
 */
export function useJsonText(draft: System, setDraft: (system: System) => void, active: boolean) {
  const json = useMemo(() => (active ? JSON.stringify(draft) : ''), [draft, active])
  const [state, setState] = useState<JsonState | null>(null)
  let current = state
  if (!active) {
    if (state) setState(null)
    current = null
  } else if (!state || state.synced !== json) {
    current = { text: JSON.stringify(draft, null, 2), synced: json, bad: null }
    setState(current)
  }
  const write = (text: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      const position = /position (\d+)/.exec(error instanceof Error ? error.message : '')?.[1]
      const line = position ? lineAt(text, Number(position)) : null
      setState((s) => (s ? { ...s, text, bad: { line } } : s))
      return
    }
    if (!fitsFormat(parsed)) {
      setState((s) => (s ? { ...s, text, bad: { problems: validateSystem(parsed).problems } } : s))
      return
    }
    setState({ text, synced: JSON.stringify(parsed), bad: null })
    setDraft(parsed)
  }
  const lines = useMemo(
    () => (current && !(current.bad && 'line' in current.bad) ? jsonLines(current.text) : null),
    [current]
  )
  return {
    text: current?.text ?? '',
    bad: current?.bad ?? null,
    broken: Boolean(current?.bad),
    lines,
    write,
    /** Vuelve a empezar con el borrador (al cancelar) */
    reset: () => setState(null)
  }
}

export type JsonText = ReturnType<typeof useJsonText>

/** Los problemas que se enseñan en Avanzado: los del texto, si no tiene la forma de un sistema; si no, los del borrador */
export const shownProblems = (json: JsonText, problems: Problem[]) =>
  json.bad && 'problems' in json.bad ? json.bad.problems : problems

/** El JSON, con el número de cada línea y las que tienen problemas marcadas. Solo se pintan las líneas que se ven */
export function JsonCode({
  json,
  problems,
  goto,
  readOnly
}: {
  json: JsonText
  problems: Problem[]
  /** Ir a una línea (n cambia cada vez, para volver a la misma) */
  goto: { line: number; n: number } | null
  readOnly: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const area = useRef<HTMLTextAreaElement>(null)
  const [view, setView] = useState({ top: 0, height: 0 })
  const text = useRef(json.text)
  text.current = json.text
  const count = useMemo(() => lineAt(json.text, json.text.length), [json.text])
  const marks = useMemo(() => {
    const found = new Map<number, 'error' | 'warning'>()
    if (json.bad && 'line' in json.bad) {
      if (json.bad.line) found.set(json.bad.line, 'error')
      return found
    }
    if (!json.lines) return found
    for (const p of problems) {
      const line = lineOf(json.lines, p.path)
      if (found.get(line) !== 'error') found.set(line, p.severity)
    }
    return found
  }, [json.bad, json.lines, problems])

  useEffect(() => {
    const element = area.current
    if (!element) return
    setView({ top: element.scrollTop, height: element.clientHeight })
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => setView((v) => ({ ...v, height: element.clientHeight })))
        : null
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])
  // Solo las idas que se piden mientras se ve (al volver a Avanzado, no se salta a la última)
  const handled = useRef(goto?.n)
  useEffect(() => {
    const element = area.current
    if (!goto || !element || goto.n === handled.current) return
    handled.current = goto.n
    let offset = 0
    for (let line = 1; line < goto.line; line++) {
      const next = text.current.indexOf('\n', offset)
      if (next < 0) break
      offset = next + 1
    }
    element.focus()
    element.setSelectionRange(offset, offset)
    element.scrollTop = Math.max(0, (goto.line - 1) * LINE - element.clientHeight / 3)
  }, [goto])

  const height = view.height || 600
  const first = Math.max(1, Math.floor((view.top - PAD) / LINE) - 2)
  const last = Math.min(count, Math.ceil((view.top + height) / LINE) + 2)
  const visible: number[] = []
  for (let n = first; n <= last; n++) visible.push(n)
  const at = (n: number) => PAD + (n - 1) * LINE - view.top
  const state = json.bad
    ? 'line' in json.bad
      ? json.bad.line
        ? t('systemEditor.badJsonAt', { line: json.bad.line })
        : t('systemEditor.badJson')
      : t('systemEditor.badShape')
    : null

  return (
    <div className={styles.jsonWrap}>
      <label htmlFor={`${id}-json`} className={styles.hidden}>
        {t('systemEditor.json')}
      </label>
      <div className={styles.code} style={{ ['--gutter' as string]: `${String(count).length + 2}ch` }}>
        <div className={styles.gutter} aria-hidden="true">
          {visible.map((n) => (
            <span key={n} className={styles.lineNo} data-mark={marks.get(n)} style={{ top: at(n) }}>
              {n}
            </span>
          ))}
        </div>
        <div className={styles.backdrop} aria-hidden="true">
          {[...marks].map(([n, mark]) => (
            <span key={n} className={styles.lineMark} data-mark={mark} style={{ top: at(n) }} />
          ))}
        </div>
        <textarea
          ref={area}
          id={`${id}-json`}
          className={styles.jsonText}
          value={json.text}
          readOnly={readOnly}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={Boolean(json.bad)}
          aria-describedby={`${id}-state`}
          onChange={(event) => json.write(event.currentTarget.value)}
          onScroll={(event) => {
            const { scrollTop, clientHeight } = event.currentTarget
            setView({ top: scrollTop, height: clientHeight })
          }}
        />
      </div>
      <p id={`${id}-state`} className={styles.explainBad} aria-live="polite">
        {state}
      </p>
    </div>
  )
}

/** La lista de problemas de Avanzado: cada uno lleva a su línea */
export function JsonProblems({
  json,
  problems,
  onGo
}: {
  json: JsonText
  problems: Problem[]
  onGo: (line: number) => void
}) {
  const { t } = useTranslation()
  const errors = problems.filter((p) => p.severity === 'error')
  const warnings = problems.filter((p) => p.severity === 'warning')
  const item = (p: Problem) => (
    <li key={`${p.path}:${p.message}`}>
      <button
        type="button"
        className={p.severity === 'error' ? styles.goError : styles.goWarning}
        disabled={!json.lines}
        onClick={() => json.lines && onGo(lineOf(json.lines, p.path))}
      >
        <span className={styles.goWhere}>{p.where}</span>
        {p.path && <span className={styles.goPath}>{p.path}</span>}
        <span className={styles.goWhy}>
          {p.severity === 'error' ? (
            <CircleAlert size={14} aria-hidden="true" />
          ) : (
            <Info size={14} aria-hidden="true" />
          )}
          {p.message}
        </span>
      </button>
    </li>
  )
  return (
    <>
      <div className={styles.tryHead}>
        <h2 className={styles.tryTitle}>{t('systemEditor.problemsTitle')}</h2>
        <span className={styles.count}>{errors.length}</span>
      </div>
      {problems.length === 0 && <p className={styles.note}>{t('systemEditor.noProblems')}</p>}
      {errors.length > 0 && <ul className={styles.goList}>{errors.map(item)}</ul>}
      {warnings.length > 0 && (
        <>
          <p className={styles.partsHead}>{t('systemEditor.warnings')}</p>
          <ul className={styles.goList}>{warnings.map(item)}</ul>
        </>
      )}
    </>
  )
}

/** Bajar el sistema y subir un archivo que lo reemplaza (con la versión que se tiene: si otro lo cambió, no se pisa) */
export function AdvancedTools({ data, dirty }: { data: SystemFull; dirty: boolean }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const input = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const leadId = useId()
  const [refused, setRefused] = useState<{ name: string; size: number; problems: Problem[] } | null>(null)
  const download = useMutation({
    mutationFn: async () => {
      const { name, file } = await api.call('exportSystem', { systemId: data.id })
      saveFile(name, new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    }
  })
  const upload = useMutation({
    mutationFn: (file: Record<string, unknown>) =>
      api.call('importSystem', { file, into: { systemId: data.id, version: data.version } }),
    onSuccess: ({ system }) => {
      queryClient.setQueryData(['systems', data.id], system)
      void queryClient.invalidateQueries({ queryKey: ['systems'], exact: true })
    }
  })
  const pick = async (file: File) => {
    let content: unknown
    try {
      content = JSON.parse(await file.text())
    } catch {
      setRefused({
        name: file.name,
        size: file.size,
        problems: [{ path: '', where: file.name, message: t('systems.notJson'), severity: 'error' }]
      })
      return
    }
    const { file: valid, problems } = validateFile(content)
    if (!valid) {
      setRefused({ name: file.name, size: file.size, problems })
      return
    }
    setRefused(null)
    upload.mutate(content as Record<string, unknown>)
  }
  const refusedErrors = refused?.problems.filter((p) => p.severity === 'error').length ?? 0

  return (
    <>
      <span className={styles.tools}>
        <button type="button" className={styles.tool} onClick={() => download.mutate()} disabled={download.isPending}>
          <Download size={14} aria-hidden="true" />
          {t('systems.download')}
        </button>
        {!data.builtIn && (
          <button
            type="button"
            className={styles.tool}
            disabled={dirty || upload.isPending}
            aria-describedby={dirty ? `${titleId}-dirty` : undefined}
            onClick={() => input.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            {t('systemEditor.uploadOver')}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className={styles.hidden}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void pick(file)
          }}
        />
      </span>
      {dirty && !data.builtIn && (
        <p id={`${titleId}-dirty`} className={styles.note}>
          {t('systemEditor.uploadDirty')}
        </p>
      )}
      <FormError message={download.error ? errorText(download.error) : upload.error ? errorText(upload.error) : null} />
      {refused && (
        <Modal
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={leadId}
          className={cards.dialog}
          onClose={() => setRefused(null)}
        >
          <div className={cards.form}>
            <h2 id={titleId}>{t('systemEditor.notUploadedTitle')}</h2>
            <p className={styles.fileLine}>
              <FileJson size={16} aria-hidden="true" />
              <b>{refused.name}</b> · {t('systemEditor.kb', { count: Math.max(1, Math.round(refused.size / 1024)) })}
            </p>
            <p id={leadId} className={dialogStyles.description}>
              {t('systemEditor.notUploadedLead', { count: refusedErrors, name: data.name })}
            </p>
            <ProblemList problems={refused.problems} />
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={form.button}
                data-autofocus=""
                onClick={() => {
                  setRefused(null)
                  input.current?.click()
                }}
              >
                {t('systemEditor.pickOther')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
