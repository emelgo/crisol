/**
 * El editor de un sistema (`/sistemas/:id`, docs/specs/sistemas.md § editor): sus partes a la izquierda (General y sus
 * tipos, con los problemas de cada una), la parte elegida en el centro y «Guardar» y «Cancelar» solo con cambios. Todo el
 * borrador se valida al momento con @crisol/systems (lo mismo que el servidor): con errores no se guarda. Los de serie se
 * abren para leer, con «Copiar para cambiarlo». En el móvil, la parte se elige en un selector
 */
import type { SystemFull } from '@crisol/contracts'
import {
  type Field,
  type LANGUAGES,
  type Problem,
  parseFormula,
  referencesOf,
  type System,
  scopeOf,
  textOf,
  validateSystem
} from '@crisol/systems'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from '@tanstack/react-router'
import { Copy, FlaskConical, GripVertical, Info, Plus } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../../account/context.tsx'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { BusyButton } from '../../components/busy-button.tsx'
import { ChangesBar } from '../../components/changes.tsx'
import dialogStyles from '../../components/dialog.module.css'
import { FormError } from '../../components/field.tsx'
import form from '../../components/form.module.css'
import { failed, LoadError } from '../../components/load-error.tsx'
import { Modal } from '../../components/modal.tsx'
import { ProblemList } from '../screen.tsx'
import styles from './editor.module.css'
import { blankField, FieldEditor, keyFrom } from './field.tsx'
import { TryPanel } from './try.tsx'

type Language = (typeof LANGUAGES)[number]

export function SystemView() {
  const { systemId } = useParams({ from: '/sistemas/$systemId' })
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const system = useQuery({ queryKey: ['systems', systemId], queryFn: () => api.call('getSystem', { systemId }) })
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (failed(system)) return <LoadError error={system.error} onRetry={() => system.refetch()} />
  if (!system.data) return null
  // Con otra versión (guardada aquí o en otra pestaña), el borrador empieza de nuevo
  return <SystemEditor key={`${system.data.id}:${system.data.version}`} data={system.data} />
}

/** Lo que hay que cambiar en el borrador: una copia, cambiada */
type Change = (fn: (draft: System) => void) => void

/** Cambia la clave de una entrada sin moverla de su sitio (el orden de los campos es el de la hoja) */
function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]))
}

function SystemEditor({ data }: { data: SystemFull }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const partId = useId()
  const original = data.document as unknown as System
  const [draft, setDraft] = useState<System>(() => structuredClone(original))
  const [part, setPart] = useState('general')
  const change: Change = (fn) =>
    setDraft((current) => {
      const next = structuredClone(current)
      fn(next)
      return next
    })
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(original), [draft, original])
  const problems = useMemo(() => validateSystem(draft).problems, [draft])
  const errors = problems.filter((p) => p.severity === 'error')
  const readOnly = data.builtIn
  const types = Object.entries(draft.types)

  const save = useMutation({
    mutationFn: () =>
      api.call('updateSystem', {
        systemId: data.id,
        version: data.version,
        document: draft as unknown as Record<string, unknown>
      }),
    onSuccess: ({ system }) => {
      queryClient.setQueryData(['systems', data.id], system)
      void queryClient.invalidateQueries({ queryKey: ['systems'], exact: true })
    }
  })
  const copy = useMutation({
    mutationFn: () =>
      api.call('createSystem', { name: t('systemEditor.copyName', { name: data.name }), from: data.id }),
    onSuccess: async (created) => {
      void queryClient.invalidateQueries({ queryKey: ['systems'], exact: true })
      await navigate({ to: '/sistemas/$systemId', params: { systemId: created.id } })
    }
  })
  const addType = () => {
    const key = keyFrom(t('systemEditor.newTypeName'), Object.keys(draft.types))
    change((d) => {
      d.types[key] = { document: 'item', label: t('systemEditor.newTypeName'), fields: {} }
    })
    setPart(`type:${key}`)
  }
  const inPart = (prefix: string) =>
    problems.filter((p) => p.path === prefix || p.path.startsWith(`${prefix}.`) || p.path.startsWith(`${prefix}[`))
  const generalProblems = problems.filter((p) => !p.path.startsWith('types.'))
  const currentType = part.startsWith('type:') ? part.slice(5) : null
  // Lo que se prueba: el tipo que se está viendo o, si no, el primer personaje
  const [tryChoice, setTryChoice] = useState<string | null>(null)
  const firstActor = types.find(([, type]) => type.document === 'actor')?.[0] ?? types[0]?.[0] ?? null
  const tryType = [tryChoice, currentType, firstActor].find((k) => k && draft.types[k]) ?? null
  const [trying, setTrying] = useState(false)
  const tryId = useId()
  const tryPanel = tryType && (
    <>
      <div className={styles.tryHead}>
        <h2 className={styles.tryTitle}>{t('systemTry.title')}</h2>
        <label htmlFor={tryId} className={styles.hidden}>
          {t('systemTry.type')}
        </label>
        <select
          id={tryId}
          className={styles.trySelect}
          value={tryType}
          onChange={(event) => setTryChoice(event.currentTarget.value)}
        >
          {types.map(([key, type]) => (
            <option key={key} value={key}>
              {textOf(type.label) || key}
            </option>
          ))}
        </select>
      </div>
      <TryPanel key={tryType} system={draft} typeKey={tryType} />
    </>
  )

  const parts = [
    {
      id: 'general',
      label: t('systemEditor.general'),
      count: generalProblems.filter((p) => p.severity === 'error').length,
      fields: null as number | null
    },
    ...types.map(([key, type]) => ({
      id: `type:${key}`,
      label: textOf(type.label) || key,
      count: inPart(`types.${key}`).filter((p) => p.severity === 'error').length,
      fields: Object.keys(type.fields).length
    }))
  ]

  return (
    <section className={styles.page}>
      <aside className={styles.parts} aria-label={t('systemEditor.parts')}>
        <p className={styles.partsHead}>{t('systemEditor.system')}</p>
        <ul className={styles.nav}>
          {parts.slice(0, 1).map((p) => (
            <PartButton key={p.id} part={p} current={part === p.id} onPick={() => setPart(p.id)} />
          ))}
        </ul>
        <p className={styles.partsHead}>{t('systemEditor.types')}</p>
        <ul className={styles.nav}>
          {parts.slice(1).map((p) => (
            <PartButton key={p.id} part={p} current={part === p.id} onPick={() => setPart(p.id)} />
          ))}
          {!readOnly && (
            <li>
              <button type="button" className={styles.navAdd} onClick={addType}>
                <Plus size={14} aria-hidden="true" />
                {t('systemEditor.newType')}
              </button>
            </li>
          )}
        </ul>
      </aside>

      <div className={styles.center}>
        <div className={styles.band}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{textOf(draft.name) || data.name}</h1>
            <span className={styles.kind}>
              {t('systemEditor.kind')} · {t('systems.version', { version: data.builtIn ? data.release : data.version })}
            </span>
          </div>
          <div className={styles.tabs}>
            <label htmlFor={partId} className={styles.hidden}>
              {t('systemEditor.part')}
            </label>
            <select
              id={partId}
              className={styles.partSelect}
              value={part}
              onChange={(event) => setPart(event.currentTarget.value)}
            >
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className={styles.saved} aria-live="polite">
              {readOnly ? '' : dirty ? t('systemEditor.unsaved') : t('systemEditor.saved')}
            </span>
          </div>
        </div>
        {readOnly && (
          <div className={styles.readOnly}>
            <Info size={16} aria-hidden="true" />
            <span>{t('systemEditor.builtIn')}</span>
            <BusyButton type="button" className={styles.copy} busy={copy.isPending} onClick={() => copy.mutate()}>
              <Copy size={14} aria-hidden="true" />
              {t('systemEditor.copyToChange')}
            </BusyButton>
          </div>
        )}
        <div className={styles.body}>
          <ChangesBar shown={dirty && !readOnly}>
            <BusyButton
              type="button"
              className={form.button}
              busy={save.isPending}
              disabled={errors.length > 0}
              onClick={() => save.mutate()}
            >
              {t('systemEditor.save')}
            </BusyButton>
            <button type="button" className={dialogStyles.cancel} onClick={() => setDraft(structuredClone(original))}>
              {t('systemEditor.cancel')}
            </button>
          </ChangesBar>
          {dirty && errors.length > 0 && <p className={styles.cantSave}>{t('systemEditor.cantSave')}</p>}
          <FormError message={save.error ? errorText(save.error) : null} />
          {part === 'general' && (
            <GeneralPart draft={draft} change={change} problems={generalProblems} disabled={readOnly} />
          )}
          {currentType && draft.types[currentType] && (
            <TypePart
              typeKey={currentType}
              draft={draft}
              original={original}
              change={change}
              problems={inPart(`types.${currentType}`)}
              disabled={readOnly}
              onRemove={() => {
                change((d) => {
                  delete d.types[currentType]
                })
                setPart('general')
              }}
              onRenameType={(to) => {
                change((d) => {
                  d.types = renameKey(d.types, currentType, to)
                })
                setPart(`type:${to}`)
              }}
            />
          )}
        </div>
      </div>

      {tryPanel && (
        <aside className={styles.tryCard} aria-label={t('systemTry.title')}>
          {tryPanel}
        </aside>
      )}
      {tryPanel && (
        <button type="button" className={styles.tryButton} aria-haspopup="dialog" onClick={() => setTrying(true)}>
          <FlaskConical size={18} aria-hidden="true" />
          {t('systemTry.open')}
        </button>
      )}
      {trying && tryPanel && (
        <Modal aria-label={t('systemTry.title')} className={styles.trySheet} onClose={() => setTrying(false)}>
          {tryPanel}
        </Modal>
      )}
    </section>
  )
}

function PartButton({
  part,
  current,
  onPick
}: {
  part: { id: string; label: string; count: number; fields: number | null }
  current: boolean
  onPick: () => void
}) {
  const { t } = useTranslation()
  return (
    <li>
      <button
        type="button"
        className={current ? styles.navOn : styles.navItem}
        aria-current={current ? 'true' : undefined}
        onClick={onPick}
      >
        <span className={styles.navLabel}>{part.label}</span>
        {part.count > 0 ? (
          <span className={styles.bad} role="img" aria-label={t('systemEditor.problems', { count: part.count })}>
            {part.count}
          </span>
        ) : (
          part.fields !== null && <span className={styles.count}>{part.fields}</span>
        )}
      </button>
    </li>
  )
}

/** Un texto del sistema (en un idioma o en varios): se cambia el del español, o el único que tenga */
const setText = (current: System['name'] | undefined, value: string): System['name'] =>
  typeof current === 'object' && current !== null ? { ...current, es: value } : value

function GeneralPart({
  draft,
  change,
  problems,
  disabled
}: {
  draft: System
  change: Change
  problems: Problem[]
  disabled: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <fieldset className={styles.part} disabled={disabled}>
      <legend className={styles.partTitle}>{t('systemEditor.general')}</legend>
      <div className={styles.grid2}>
        <div>
          <label className={styles.label} htmlFor={`${id}-name`}>
            {t('systemEditor.name')}
          </label>
          <input
            id={`${id}-name`}
            className={styles.input}
            value={textOf(draft.name)}
            onChange={(event) => {
              const value = event.currentTarget.value
              change((d) => {
                d.name = setText(d.name, value)
              })
            }}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${id}-release`}>
            {t('systemEditor.release')}
          </label>
          <input
            id={`${id}-release`}
            className={styles.input}
            value={draft.version}
            aria-describedby={`${id}-release-hint`}
            onChange={(event) => {
              const value = event.currentTarget.value
              change((d) => {
                d.version = value
              })
            }}
          />
          <p id={`${id}-release-hint`} className={styles.note}>
            {t('systemEditor.releaseHint')}
          </p>
        </div>
        <div className={styles.full}>
          <label className={styles.label} htmlFor={`${id}-summary`}>
            {t('systemEditor.summary')}
          </label>
          <textarea
            id={`${id}-summary`}
            className={styles.input}
            rows={3}
            value={textOf(draft.summary)}
            onChange={(event) => {
              const value = event.currentTarget.value
              change((d) => {
                if (value) d.summary = setText(d.summary, value)
                else delete d.summary
              })
            }}
          />
        </div>
        <fieldset className={`${styles.full} ${styles.checks}`}>
          <legend className={styles.label}>{t('systemEditor.languages')}</legend>
          {(['es', 'en'] as Language[]).map((language) => (
            <label key={language} className={styles.check}>
              <input
                type="checkbox"
                checked={draft.languages.includes(language)}
                onChange={(event) => {
                  const on = event.currentTarget.checked
                  change((d) => {
                    d.languages = on ? [...d.languages, language] : d.languages.filter((l) => l !== language)
                  })
                }}
              />
              {t(`systemEditor.languageNames.${language}`)}
            </label>
          ))}
        </fieldset>
        <div>
          <label className={styles.label} htmlFor={`${id}-lic-name`}>
            {t('systemEditor.licenseName')}
          </label>
          <input
            id={`${id}-lic-name`}
            className={styles.input}
            value={textOf(draft.license?.name)}
            placeholder={t('systemEditor.optional')}
            onChange={(event) => {
              const value = event.currentTarget.value
              change((d) => {
                d.license = {
                  name: value || ' ',
                  license: d.license?.license ?? 'Propia',
                  attribution: d.license?.attribution ?? ' '
                }
                if (!value.trim()) delete d.license
              })
            }}
          />
        </div>
        {draft.license && (
          <>
            <div>
              <label className={styles.label} htmlFor={`${id}-lic`}>
                {t('systemEditor.licenseKind')}
              </label>
              <input
                id={`${id}-lic`}
                className={styles.input}
                value={draft.license.license}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  change((d) => {
                    if (d.license) d.license.license = value
                  })
                }}
              />
            </div>
            <div className={styles.full}>
              <label className={styles.label} htmlFor={`${id}-attr`}>
                {t('systemEditor.attribution')}
              </label>
              <textarea
                id={`${id}-attr`}
                className={styles.input}
                rows={2}
                value={textOf(draft.license.attribution)}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  change((d) => {
                    if (d.license) d.license.attribution = setText(d.license.attribution, value)
                  })
                }}
              />
            </div>
          </>
        )}
      </div>
      {problems.length > 0 && <ProblemList problems={problems} />}
    </fieldset>
  )
}

/** Dónde se usa un campo: las fórmulas de su tipo que lo nombran */
function usersOf(fields: Record<string, Field>, key: string): string[] {
  const found: string[] = []
  for (const [other, field] of Object.entries(fields)) {
    if (other === key || field.kind !== 'derived') continue
    try {
      if (referencesOf(parseFormula(field.formula)).some((ref) => ref.path[0] === key))
        found.push(textOf(field.label) || other)
    } catch {
      // Una fórmula que no se entiende no cuenta
    }
  }
  return found
}

function TypePart({
  typeKey,
  draft,
  original,
  change,
  problems,
  disabled,
  onRemove,
  onRenameType
}: {
  typeKey: string
  draft: System
  original: System
  change: Change
  problems: Problem[]
  disabled: boolean
  onRemove: () => void
  onRenameType: (to: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const type = draft.types[typeKey] as System['types'][string]
  const saved = original.types[typeKey]
  const owner = textOf(type.label) || typeKey
  const context = useMemo(
    () => ({ scope: scopeOf(type.fields, '', owner, draft), dice: false, owner }),
    [type.fields, owner, draft]
  )
  const [open, setOpen] = useState<string | null>(null)
  // Cada fila, con un id que no cambia al cambiar su clave (un campo nuevo no se vuelve a montar ni pierde el foco)
  const rows = useRef(new Map<string, string>())
  const rowId = (key: string) => {
    let found = rows.current.get(key)
    if (!found) {
      found = crypto.randomUUID()
      rows.current.set(key, found)
    }
    return found
  }
  const renameRow = (from: string, to: string) => {
    rows.current.set(to, rowId(from))
    rows.current.delete(from)
  }
  const typeProblems = problems.filter((p) => !p.path.startsWith(`types.${typeKey}.fields.`))
  const fieldProblems = (key: string) => problems.filter((p) => p.path.startsWith(`types.${typeKey}.fields.${key}`))
  const addField = () => {
    const key = keyFrom(t('systemEditor.newFieldName'), Object.keys(type.fields))
    change((d) => {
      ;(d.types[typeKey] as System['types'][string]).fields[key] = blankField(
        'number',
        t('systemEditor.newFieldName'),
        d.types
      )
    })
    setOpen(key)
  }
  return (
    <div className={styles.part}>
      <div className={styles.typeHead}>
        <h2 className={styles.partTitle}>{owner}</h2>
        <span className={styles.typeMeta}>
          {t(`systemEditor.typeKind.${type.document}`)} · {t('systemEditor.key')} <code>{typeKey}</code>
        </span>
      </div>
      <fieldset className={styles.grid2} disabled={disabled}>
        <div>
          <label className={styles.label} htmlFor={`${id}-label`}>
            {t('systemEditor.typeName')}
          </label>
          <input
            id={`${id}-label`}
            className={styles.input}
            value={textOf(type.label)}
            onChange={(event) => {
              const value = event.currentTarget.value
              change((d) => {
                ;(d.types[typeKey] as System['types'][string]).label = value
              })
            }}
          />
        </div>
        <div>
          <label className={styles.label} htmlFor={`${id}-document`}>
            {t('systemEditor.document')}
          </label>
          <select
            id={`${id}-document`}
            className={styles.input}
            value={type.document}
            disabled={Boolean(saved)}
            onChange={(event) => {
              const value = event.currentTarget.value as 'actor' | 'item'
              change((d) => {
                ;(d.types[typeKey] as System['types'][string]).document = value
              })
            }}
          >
            <option value="actor">{t('systemEditor.typeKind.actor')}</option>
            <option value="item">{t('systemEditor.typeKind.item')}</option>
          </select>
        </div>
        {!saved && (
          <div>
            <label className={styles.label} htmlFor={`${id}-key`}>
              {t('systemEditor.key')}
            </label>
            <input
              id={`${id}-key`}
              className={styles.input}
              value={typeKey}
              onChange={(event) => onRenameType(event.currentTarget.value)}
            />
          </div>
        )}
      </fieldset>
      {typeProblems.length > 0 && <ProblemList problems={typeProblems} />}

      <h3 className={styles.sub}>{t('systemEditor.fields')}</h3>
      <ul className={styles.fields}>
        {Object.entries(type.fields).map(([key, field]) => {
          const bad = fieldProblems(key).some((p) => p.severity === 'error')
          return (
            <li key={rowId(key)}>
              <button
                type="button"
                className={open === key ? styles.rowOn : styles.row}
                aria-expanded={open === key}
                onClick={() => setOpen(open === key ? null : key)}
              >
                <GripVertical size={14} aria-hidden="true" className={styles.grip} />
                <span>{textOf(field.label) || key}</span>
                <code className={styles.key}>@{key}</code>
                {bad && (
                  <span className={styles.dot} role="img" aria-label={t('systemEditor.problems', { count: 1 })} />
                )}
                <span className={styles.rowKind}>{t(`systemEditor.kinds.${field.kind}`)}</span>
              </button>
              {open === key && (
                <FieldEditor
                  fieldKey={key}
                  field={field}
                  fixedKey={Boolean(saved?.fields[key])}
                  system={draft}
                  context={context}
                  problems={fieldProblems(key)}
                  usedBy={usersOf(type.fields, key)}
                  disabled={disabled}
                  onKey={(to) => {
                    renameRow(key, to)
                    change((d) => {
                      const target = d.types[typeKey] as System['types'][string]
                      target.fields = renameKey(target.fields, key, to)
                    })
                    setOpen(to)
                  }}
                  onChange={(next) =>
                    change((d) => {
                      ;(d.types[typeKey] as System['types'][string]).fields[key] = next
                    })
                  }
                  onRemove={() => {
                    change((d) => {
                      delete (d.types[typeKey] as System['types'][string]).fields[key]
                    })
                    setOpen(null)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
      {!disabled && (
        <div className={styles.typeFoot}>
          <button type="button" className={styles.add} onClick={addField}>
            <Plus size={14} aria-hidden="true" />
            {t('systemEditor.newField')}
          </button>
          <button type="button" className={styles.danger} onClick={onRemove}>
            {t('systemEditor.removeType')}
          </button>
        </div>
      )}
    </div>
  )
}
