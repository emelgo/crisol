/**
 * «Sistemas», en la zona de Mis mundos (docs/specs/sistemas.md): los tuyos, con su engranaje, y los de serie, con su
 * candado y «Copiar». Al pasar por uno, a la izquierda, lo que trae. «Sistema nuevo» va como un recuadro más, tras los
 * tuyos: desde cero, copiando otro o de un archivo (que se valida aquí antes de subirlo)
 */
import type { SystemSummary } from '@crisol/contracts'
import { type Problem, validateFile } from '@crisol/systems'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { CircleAlert, Copy, Download, FileUp, Info, Lock, Plus, ScrollText, Settings } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { saveFile } from '../components/save-file.ts'
import { Tour } from '../components/tour.tsx'
import cards from '../routes/world-card.module.css'
import screen from '../templates/screen.module.css'
import styles from './screen.module.css'

export function useSystems() {
  const api = useApi()
  return useQuery({ queryKey: ['systems'], queryFn: () => api.call('listSystems', {}) })
}

/** Lo que lo describe en su tarjeta: de cuál se copió, de un archivo o, si es de serie, su resumen */
function useOrigin() {
  const { t } = useTranslation()
  return (system: SystemSummary) => {
    if (system.builtIn) return system.summary
    if (!system.basedOn) return t('systems.uploaded')
    return t('systems.copyOf', { name: system.basedOn.name })
  }
}

export function SystemsScreen() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  const systems = useSystems()
  const [hovered, setHovered] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ copyOf: string | null } | null>(null)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const all = systems.data?.systems ?? []
  const mine = all.filter((s) => !s.builtIn)
  const builtIn = all.filter((s) => s.builtIn)
  const preview = all.find((s) => s.id === hovered)
  return (
    <section className={screen.page}>
      <aside className={screen.side} aria-label={t('systems.preview')}>
        {preview && <SystemPreview system={preview} />}
      </aside>
      <div className={screen.center}>
        <PageTitle>{t('systems.title')}</PageTitle>
        {failed(systems) && <LoadError error={systems.error} onRetry={() => systems.refetch()} />}
        {systems.data && (
          <>
            <h2 className={screen.section}>{t('systems.mine')}</h2>
            <ul className={screen.grid} aria-label={t('systems.mine')} data-tour="sistemas-tuyos">
              {mine.map((system) => (
                <SystemCard key={system.id} system={system} onHover={setHovered} />
              ))}
              <li>
                <button
                  type="button"
                  className={screen.newCard}
                  data-tour="sistemas-nuevo"
                  onClick={() => setCreating({ copyOf: null })}
                >
                  <Plus aria-hidden="true" size={22} />
                  {t('systems.new')}
                </button>
              </li>
            </ul>
            <h2 className={screen.section}>{t('systems.builtIn')}</h2>
            <ul className={screen.grid} aria-label={t('systems.builtIn')} data-tour="sistemas-serie">
              {builtIn.map((system) => (
                <SystemCard
                  key={system.id}
                  system={system}
                  onHover={setHovered}
                  onCopy={() => setCreating({ copyOf: system.id })}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      {creating && <NewSystemDialog copyOf={creating.copyOf} onClose={() => setCreating(null)} />}
      {systems.data && (
        <Tour
          id="sistemas"
          steps={[
            { target: '[data-tour="sistemas-nuevo"]', text: t('tour.systems.create') },
            { target: '[data-tour="sistemas-serie"]', text: t('tour.systems.builtIn') }
          ]}
        />
      )}
    </section>
  )
}

function SystemCard({
  system,
  onHover,
  onCopy
}: {
  system: SystemSummary
  onHover: (id: string | null) => void
  onCopy?: () => void
}) {
  const { t } = useTranslation()
  const origin = useOrigin()
  const [settings, setSettings] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  return (
    <li
      className={screen.card}
      onPointerEnter={() => onHover(system.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(system.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onHover(null)
      }}
    >
      {system.builtIn && <Lock className={screen.lock} size={14} role="img" aria-label={t('systems.locked')} />}
      <span className={screen.icon} aria-hidden="true">
        <ScrollText size={24} strokeWidth={1.5} />
      </span>
      <h3 className={screen.name}>
        <Link to="/sistemas/$systemId" params={{ systemId: system.id }} className={screen.open}>
          {system.name}
        </Link>
      </h3>
      <p className={screen.meta}>{origin(system)}</p>
      <div className={`${screen.foot} ${styles.foot}`}>
        <span className={styles.version}>
          {t('systems.version', { version: system.builtIn ? system.release : system.version })}
        </span>
        {system.builtIn ? (
          <button type="button" className={screen.copy} onClick={onCopy}>
            <Copy size={14} aria-hidden="true" />
            {t('systems.copy')}
          </button>
        ) : (
          <button
            ref={gear}
            type="button"
            className={screen.gear}
            aria-label={t('systems.settingsOf', { name: system.name })}
            title={t('systems.settingsOf', { name: system.name })}
            aria-haspopup="dialog"
            onClick={() => setSettings(true)}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {settings && (
        <SystemSettings
          system={system}
          onClose={(gone) => {
            setSettings(false)
            if (!gone) gear.current?.focus()
          }}
        />
      )}
    </li>
  )
}

/** Lo que trae un sistema, a un lado: su resumen, sus tipos, sus tiradas, en qué campañas está y su fuente */
function SystemPreview({ system }: { system: SystemSummary }) {
  const { t } = useTranslation()
  const origin = useOrigin()
  return (
    <div className={screen.preview}>
      <div className={screen.previewTop}>
        <span className={screen.icon} aria-hidden="true">
          <ScrollText size={20} strokeWidth={1.5} />
        </span>
        <div>
          <p className={screen.previewName}>{system.name}</p>
          <p className={screen.meta}>{system.builtIn ? t('systems.builtIn') : origin(system)}</p>
        </div>
      </div>
      {system.summary && <p className={styles.summary}>{system.summary}</p>}
      <p className={screen.label}>{t('systems.types')}</p>
      <ul className={screen.list}>
        {system.types.map((type) => (
          <li key={type.key}>
            {type.label}
            <span>{t('systems.fields', { count: type.fields })}</span>
          </li>
        ))}
      </ul>
      <p className={screen.label}>{t('systems.rolls')}</p>
      <ul className={screen.list}>
        {system.rolls.map((roll) => (
          <li key={roll.key}>{roll.label}</li>
        ))}
        {system.rolls.length === 0 && <li className={screen.none}>{t('systems.none')}</li>}
      </ul>
      <p className={screen.label}>{t('systems.inCampaigns')}</p>
      <ul className={screen.list}>
        {system.campaigns.map((campaign) => (
          <li key={campaign.id}>{campaign.name}</li>
        ))}
        {system.campaigns.length === 0 && <li className={screen.none}>{t('systems.noCampaigns')}</li>}
      </ul>
      <p className={screen.label}>{t('systems.license')}</p>
      <p className={screen.meta}>{system.license ?? t('systems.noLicense')}</p>
    </div>
  )
}

/** Los problemas de un sistema: dónde (por sus nombres), por qué y su ruta, en pequeño */
export function ProblemList({ problems }: { problems: readonly Problem[] }) {
  const { t } = useTranslation()
  return (
    <ul className={styles.problems}>
      {problems.map((p) => (
        <li key={`${p.path}:${p.message}`} className={p.severity === 'warning' ? styles.warning : styles.error}>
          <span className={styles.where}>
            {p.severity === 'warning' ? (
              <Info size={14} aria-hidden="true" />
            ) : (
              <CircleAlert size={14} aria-hidden="true" />
            )}
            <span className={styles.kindWord}>{t(p.severity === 'warning' ? 'systems.warning' : 'systems.error')}</span>
            {p.where}
          </span>
          <span>{p.message}</span>
          {p.path && <span className={styles.path}>{p.path}</span>}
        </li>
      ))}
    </ul>
  )
}

type Mode = 'scratch' | 'copy' | 'file'

/** «Sistema nuevo»: desde cero, copiando otro o de un archivo. Creado, se abre en su editor */
export function NewSystemDialog({ copyOf, onClose }: { copyOf: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const baseId = useId()
  const fileId = useId()
  const systems = useSystems().data?.systems ?? []
  const [mode, setMode] = useState<Mode>(copyOf ? 'copy' : 'scratch')
  const [base, setBase] = useState(copyOf ?? systems[0]?.id ?? 'blank')
  const chosen = systems.find((s) => s.id === base)
  const [name, setName] = useState(chosen && copyOf ? t('systems.copyName', { name: chosen.name }) : '')
  const [file, setFile] = useState<{
    name: string
    content: Record<string, unknown> | null
    problems: Problem[]
  } | null>(null)

  const opened = async (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ['systems'] })
    dialog.current?.close()
    onClose()
    await navigate({ to: '/sistemas/$systemId', params: { systemId: id } })
  }
  const create = useMutation({
    mutationFn: () => api.call('createSystem', { name: name.trim(), from: mode === 'copy' ? base : 'blank' }),
    onSuccess: (created) => opened(created.id)
  })
  const upload = useMutation({
    mutationFn: () => api.call('importSystem', { file: file?.content ?? {} }),
    onSuccess: ({ system }) => opened(system.id)
  })

  /** Leer el archivo y validarlo aquí: si está roto, se dice qué falla sin subir nada */
  const read = async (picked: File | undefined) => {
    if (!picked) return
    let content: unknown
    try {
      content = JSON.parse(await picked.text())
    } catch {
      setFile({
        name: picked.name,
        content: null,
        problems: [{ path: '', where: picked.name, message: t('systems.notJson'), severity: 'error' }]
      })
      return
    }
    const { file: valid, problems } = validateFile(content)
    setFile({ name: picked.name, content: valid ? (content as Record<string, unknown>) : null, problems })
  }
  const errors = file?.problems.filter((p) => p.severity === 'error') ?? []

  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={onClose}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (mode === 'file') {
            if (file?.content) upload.mutate()
          } else if (name.trim()) create.mutate()
        }}
      >
        <h2 id={titleId}>{t('systems.new')}</h2>
        <fieldset className={`${screen.modes} ${styles.modes}`}>
          <legend className={screen.hidden}>{t('systems.how')}</legend>
          {(['scratch', 'copy', 'file'] as const).map((each) => (
            <label key={each} className={screen.mode}>
              <input type="radio" name={`${titleId}-modo`} checked={mode === each} onChange={() => setMode(each)} />
              {each === 'scratch' ? (
                <Plus size={18} aria-hidden="true" />
              ) : each === 'copy' ? (
                <Copy size={18} aria-hidden="true" />
              ) : (
                <FileUp size={18} aria-hidden="true" />
              )}
              {t(each === 'scratch' ? 'systems.fromScratch' : each === 'copy' ? 'systems.copying' : 'systems.fromFile')}
            </label>
          ))}
        </fieldset>
        {mode === 'copy' && (
          <div className={screen.baseField}>
            <label htmlFor={baseId}>{t('systems.copyWhich')}</label>
            <select id={baseId} value={base} onChange={(event) => setBase(event.currentTarget.value)}>
              {systems.map((each) => (
                <option key={each.id} value={each.id}>
                  {each.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {mode === 'file' ? (
          <>
            <fieldset
              className={styles.drop}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                void read(event.dataTransfer.files[0])
              }}
            >
              <legend className={screen.hidden}>{t('systems.file')}</legend>
              <FileUp size={26} aria-hidden="true" strokeWidth={1.5} />
              <span>{t('systems.dropFile')}</span>
              <label htmlFor={fileId} className={styles.pick}>
                {t('systems.pickFile')}
              </label>
              {file && <span className={styles.picked}>{file.name}</span>}
              <input
                id={fileId}
                type="file"
                accept=".json,application/json"
                className={styles.fileInput}
                onChange={(event) => void read(event.currentTarget.files?.[0])}
              />
            </fieldset>
            {errors.length > 0 && (
              <div role="alert">
                <p className={styles.notUploaded}>{t('systems.notUploaded', { count: errors.length })}</p>
                <ProblemList problems={file?.problems ?? []} />
              </div>
            )}
            {errors.length === 0 && (file?.problems.length ?? 0) > 0 && <ProblemList problems={file?.problems ?? []} />}
            <FormError message={upload.error ? errorText(upload.error) : null} />
            <BusyButton type="submit" className={form.button} busy={upload.isPending} disabled={!file?.content}>
              {t('systems.upload')}
            </BusyButton>
          </>
        ) : (
          <>
            <Field
              label={t('systems.name')}
              value={name}
              required
              maxLength={200}
              autoComplete="off"
              data-autofocus=""
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <FormError message={create.error ? errorText(create.error) : null} />
            <BusyButton type="submit" className={form.button} busy={create.isPending}>
              {t('systems.create')}
            </BusyButton>
          </>
        )}
      </form>
    </Modal>
  )
}

/** La ventana de un sistema tuyo: su nombre, su versión, bajarlo, en qué campañas está y borrarlo. onClose(gone): si se borró */
function SystemSettings({ system, onClose }: { system: SystemSummary; onClose: (gone: boolean) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(system.name)
  const changed = name.trim() !== system.name
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['systems'] })
  const save = useMutation({
    mutationFn: async () => {
      await api.call('updateSystem', { systemId: system.id, version: system.version, name: name.trim() })
      await refresh()
    },
    onSuccess: () => dialog.current?.close()
  })
  const download = useMutation({
    mutationFn: async () => {
      const { name: fileName, file } = await api.call('exportSystem', { systemId: system.id })
      saveFile(fileName, new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    }
  })
  const remove = async () => {
    await api.call('deleteSystem', { systemId: system.id })
    gone.current = true
    dialog.current?.close()
    await refresh()
  }
  const inUse = system.campaigns.length > 0
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed && name.trim()) save.mutate()
        }}
      >
        <h2 id={titleId}>{t('systems.settingsOf', { name: system.name })}</h2>
        <Field
          label={t('systems.name')}
          value={name}
          required
          maxLength={200}
          autoComplete="off"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('systems.save')}
          </BusyButton>
          <button type="button" className={dialogStyles.cancel} onClick={() => setName(system.name)}>
            {t('systems.cancel')}
          </button>
        </ChangesBar>
        <dl className={styles.rows}>
          <div>
            <dt>{t('systems.versionLong')}</dt>
            <dd>
              {t('systems.version', { version: system.version })}
              <Link to="/sistemas/$systemId" params={{ systemId: system.id }} className={styles.rowAction}>
                {t('systems.open')}
              </Link>
            </dd>
          </div>
          <div>
            <dt>{t('systems.download')}</dt>
            <dd>
              {t('systems.downloadHint')}
              <BusyButton
                type="button"
                className={styles.rowAction}
                busy={download.isPending}
                onClick={() => download.mutate()}
              >
                <Download size={14} aria-hidden="true" />
                {t('systems.download')}
              </BusyButton>
            </dd>
          </div>
          <div>
            <dt>{t('systems.inCampaigns')}</dt>
            <dd>{inUse ? system.campaigns.map((c) => c.name).join(', ') : t('systems.noCampaigns')}</dd>
          </div>
        </dl>
        <FormError message={download.error ? errorText(download.error) : null} />
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          {inUse ? (
            <p className={styles.inUse}>
              {t('systems.inUse', { names: system.campaigns.map((c) => `«${c.name}»`).join(', ') })}
            </p>
          ) : (
            <ConfirmByName
              name={system.name}
              action={t('systems.delete')}
              title={t('systems.deleteTitle', { name: system.name })}
              warning={t('systems.deleteWarning')}
              label={t('systems.name')}
              onConfirm={remove}
            />
          )}
        </DangerZone>
      </div>
    </Modal>
  )
}
