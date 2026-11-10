/**
 * «Sistemas», en la zona de Mis mundos (docs/specs/sistemas.md): los tuyos y los de serie, con su candado; cada uno abre
 * su ventana. Al pasar por uno, a la izquierda, lo que trae. Se hacen con la IA (no hay editor): «Sistema nuevo» sube
 * su archivo o baja uno vacío
 */
import type { SystemSummary } from '@crisol/contracts'
import { type Problem, validateFile } from '@crisol/systems'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from '@tanstack/react-router'
import { CircleAlert, Download, FileUp, Info, Lock, ScrollText, Settings, Sparkles } from 'lucide-react'
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
import { NewCard } from '../components/new-card.tsx'
import { saveFile } from '../components/save-file.ts'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { ENTER_ITEM, enterItem } from '../components/world-transition.ts'
import cards from '../routes/world-card.module.css'
import screen from '../templates/screen.module.css'
import { FoundryImages } from './foundry-images.tsx'
import { FoundryScenes } from './foundry-scenes.tsx'
import { type FoundryZip, imagesFromZip, readFoundryZip, slimZip, toBase64, type ZipImage } from './foundry-zip.ts'
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

/**
 * Su versión, siempre igual: la de un sistema tuyo es un número que sube con cada cambio; la de uno de serie, la que le
 * pone quien lo hace («1.0»), sin los «.0» del final
 */
function versionOf(system: Pick<SystemSummary, 'builtIn' | 'release' | 'version'>) {
  if (!system.builtIn) return String(system.version)
  return system.release.trim().replace(/(\.0+)+$/, '') || String(system.version)
}

export function SystemsScreen() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  const systems = useSystems()
  const [hovered, setHovered] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const all = systems.data?.systems ?? []
  const mine = all.filter((s) => !s.builtIn)
  const preview = all.find((s) => s.id === hovered)
  return (
    <Screen
      title={t('systems.title')}
      left={preview && <SystemPreview system={preview} />}
      leftLabel={t('systems.preview')}
    >
      {failed(systems) && <LoadError error={systems.error} onRetry={() => systems.refetch()} />}
      {systems.data && (
        <>
          <h2 className={screen.section}>{t('systems.mine')}</h2>
          <ul className={screen.grid} aria-label={t('systems.mine')} data-tour="sistemas-tuyos">
            {mine.map((system) => (
              <SystemCard key={system.id} system={system} onHover={setHovered} />
            ))}
            <li className={screen.newItem}>
              <NewCard label={t('systems.new')} data-tour="sistemas-nuevo" onClick={() => setCreating(true)} />
            </li>
          </ul>
        </>
      )}
      {creating && <NewSystemDialog onClose={() => setCreating(false)} />}
      {systems.data && (
        <Tour id="sistemas" steps={[{ target: '[data-tour="sistemas-nuevo"]', text: t('tour.systems.create') }]} />
      )}
    </Screen>
  )
}

function SystemCard({ system, onHover }: { system: SystemSummary; onHover: (id: string | null) => void }) {
  const { t } = useTranslation()
  const origin = useOrigin()
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)
  return (
    <li
      className={screen.card}
      onPointerEnter={() => onHover(system.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={(event) => {
        // El foco en su ventana no vuelve a sacar la vista previa
        if (!(event.target as Element).closest('dialog')) onHover(system.id)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onHover(null)
      }}
    >
      {system.builtIn && <Lock className={screen.lock} size={14} role="img" aria-label={t('systems.locked')} />}
      <span className={screen.icon} aria-hidden="true" data-elemento="icono">
        <ScrollText size={24} strokeWidth={1.5} />
      </span>
      <h3 className={screen.name}>
        {/* Entrar es entrar: su icono y su nombre viajan al título del sistema, con sus libros (ADR-0021) */}
        <Link
          to="/sistemas/$systemId"
          params={{ systemId: system.id }}
          className={screen.open}
          viewTransition={ENTER_ITEM}
          onClick={(event) => enterItem(system.id, event.currentTarget.closest('li'))}
        >
          <span data-elemento="nombre">{system.name}</span>
        </Link>
      </h3>
      <p className={screen.meta}>{origin(system)}</p>
      <div className={screen.foot}>
        <span className={styles.version}>{t('systems.version', { version: versionOf(system) })}</span>
        {/* Sus acciones, en su engranaje, siempre a la vista (docs/diseno.md) */}
        <button
          ref={opener}
          type="button"
          className={screen.gear}
          aria-label={t('systems.settingsOf', { name: system.name })}
          title={t('systems.settingsOf', { name: system.name })}
          aria-haspopup="dialog"
          onClick={() => {
            // Con su ventana encima, la vista previa de al lado se quita (docs/diseno.md)
            onHover(null)
            setOpen(true)
          }}
        >
          <Settings size={16} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <SystemWindow
          system={system}
          onClose={(gone) => {
            setOpen(false)
            if (!gone) opener.current?.focus()
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

/** «Sistema nuevo»: se hacen con la IA; aquí se sube su archivo (que se valida antes de subirlo) o se baja uno vacío */
export function NewSystemDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const fileId = useId()
  const [file, setFile] = useState<{
    name: string
    content: Record<string, unknown> | null
    problems: Problem[]
  } | null>(null)

  const [foundry, setFoundry] = useState<{
    name: string
    bytes: Uint8Array
    read: FoundryZip
    chosen: string[]
    language: 'es' | 'en'
  } | null>(null)
  // Tras traerlo de Foundry, sus imágenes: se sacan del zip y se suben aparte
  const [images, setImages] = useState<{ systemId: string; images: ZipImage[] } | null>(null)
  // El sistema ya traído del zip: sus escenas buscan en él sus criaturas
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)
  const upload = useMutation({
    mutationFn: async () => {
      if (!foundry) return api.call('importSystem', { file: file?.content ?? {} })
      // Solo lo que hace falta, y en base64: el servidor lo lee y crea el sistema con su compendio
      const zip = toBase64(slimZip(foundry.bytes, foundry.read, foundry.chosen))
      return api.call('importFoundry', { zip, packs: foundry.chosen, language: foundry.language })
    },
    onSuccess: async (out) => {
      await queryClient.invalidateQueries({ queryKey: ['systems'] })
      const named = 'images' in out ? (out.images as { path: string; credit: string | null }[]) : []
      const found = foundry && named.length > 0 ? imagesFromZip(foundry.bytes, foundry.read, named) : []
      setCreated({ id: out.system.id, name: out.system.name })
      if (found.length > 0) setImages({ systemId: out.system.id, images: found })
      // Si el zip trae escenas, el cuadro sigue abierto con ellas
      else if (!foundry?.read.scenePacks.length) dialog.current?.close()
    }
  })
  const blank = useDownload('blank')

  /** Leer el archivo y validarlo aquí: si está roto, se dice qué falla sin subir nada */
  const read = async (picked: File | undefined) => {
    if (!picked) return
    setFoundry(null)
    setCreated(null)
    if (picked.name.toLowerCase().endsWith('.zip')) {
      const bytes = new Uint8Array(await picked.arrayBuffer())
      const found = readFoundryZip(bytes)
      if (!found) {
        setFile({
          name: picked.name,
          content: null,
          problems: [{ path: '', where: picked.name, message: t('systems.notFoundry'), severity: 'error' }]
        })
        return
      }
      setFile(null)
      setFoundry({ name: picked.name, bytes, read: found, chosen: found.packs.map((p) => p.name), language: 'en' })
      return
    }
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
  const onlyScenes = foundry !== null && foundry.read.packs.length === 0 && foundry.read.scenePacks.length > 0

  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={onClose}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (file?.content || (foundry && foundry.chosen.length > 0)) upload.mutate()
        }}
      >
        <h2 id={titleId}>{t('systems.new')}</h2>
        <p className={styles.withAi}>
          <Sparkles size={16} aria-hidden="true" />
          {t('systems.withAi')}
        </p>
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
          {(file ?? foundry) && <span className={styles.picked}>{(file ?? foundry)?.name}</span>}
          <input
            id={fileId}
            type="file"
            accept=".json,application/json,.zip,application/zip"
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
        {/* Un zip solo de escenas no trae nada para un sistema: va directo a sus escenas */}
        {foundry && !onlyScenes && !created && (
          <FoundryChoice
            foundry={foundry.read}
            chosen={foundry.chosen}
            language={foundry.language}
            onChange={(changes) => setFoundry({ ...foundry, ...changes })}
          />
        )}
        <FormError message={upload.error ? errorText(upload.error) : null} />
        {created && !images && foundry && (
          <p className={styles.created} role="status">
            {t('systems.scenes.systemCreated', { name: created.name })}
          </p>
        )}
        {images ? (
          <FoundryImages
            systemId={images.systemId}
            images={images.images}
            onDone={() => {
              if (foundry?.read.scenePacks.length) setImages(null)
              else dialog.current?.close()
            }}
          />
        ) : onlyScenes || created ? null : (
          <BusyButton
            type="submit"
            className={form.button}
            busy={upload.isPending}
            disabled={foundry ? foundry.chosen.length === 0 : !file?.content}
          >
            {foundry ? t('systems.foundryImport') : t('systems.upload')}
          </BusyButton>
        )}
        {foundry && foundry.read.scenePacks.length > 0 && (
          <FoundryScenes
            bytes={foundry.bytes}
            foundry={foundry.read}
            {...(created ? { systemId: created.id } : {})}
            onDone={() => dialog.current?.close()}
          />
        )}
        <p className={styles.blank}>
          <BusyButton type="button" className={styles.rowAction} busy={blank.isPending} onClick={() => blank.mutate()}>
            <Download size={14} aria-hidden="true" />
            {t('systems.blank')}
          </BusyButton>
          {t('systems.blankHint')}
        </p>
        <FormError message={blank.error ? errorText(blank.error) : null} />
      </form>
    </Modal>
  )
}

/** Lo que trae un zip de Foundry: qué es, sus compendios (todos marcados) y el idioma de sus textos */
function FoundryChoice({
  foundry,
  chosen,
  language,
  onChange
}: {
  foundry: FoundryZip
  chosen: string[]
  language: 'es' | 'en'
  onChange: (changes: { chosen?: string[]; language?: 'es' | 'en' }) => void
}) {
  const { t } = useTranslation()
  const languageId = useId()
  return (
    <div className={styles.foundry}>
      <p className={styles.foundryHead}>
        <strong>{t('systems.foundryOf', { title: foundry.title, version: foundry.version })}</strong>
        <span>{t(foundry.kind === 'module' ? 'systems.foundryModule' : 'systems.foundrySystem')}</span>
      </p>
      {foundry.packs.length === 0 ? (
        <p role="alert" className={styles.notUploaded}>
          {t('systems.foundryNone')}
        </p>
      ) : (
        <fieldset className={styles.packs}>
          <legend>{t('systems.foundryPacks')}</legend>
          {foundry.packs.map((pack) => (
            <label key={pack.name} className={styles.pack}>
              <input
                type="checkbox"
                checked={chosen.includes(pack.name)}
                onChange={(event) => {
                  const on = event.currentTarget.checked
                  onChange({ chosen: on ? [...chosen, pack.name] : chosen.filter((each) => each !== pack.name) })
                }}
              />
              <span>{pack.label}</span>
              <span className={styles.packType}>{t(`systems.packType.${pack.type}`, { defaultValue: pack.type })}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className={form.field}>
        <label htmlFor={languageId}>{t('systems.foundryLanguage')}</label>
        <select
          id={languageId}
          value={language}
          onChange={(event) => onChange({ language: event.currentTarget.value as 'es' | 'en' })}
        >
          <option value="en">{t('systems.languageName.en')}</option>
          <option value="es">{t('systems.languageName.es')}</option>
        </select>
      </div>
    </div>
  )
}

/** Bajar un sistema (de serie o tuyo) con su contenido, en un archivo */
function useDownload(systemId: string) {
  const api = useApi()
  return useMutation({
    mutationFn: async () => {
      const { name, file } = await api.call('exportSystem', { systemId })
      saveFile(name, new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }))
    }
  })
}

/**
 * La ventana de un sistema: su versión, bajarlo y en qué campañas está; si es tuyo, también su nombre y borrarlo.
 * onClose(gone): si se borró
 */
function SystemWindow({ system, onClose }: { system: SystemSummary; onClose: (gone: boolean) => void }) {
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
  const download = useDownload(system.id)
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
        <h2 id={titleId}>{system.builtIn ? system.name : t('systems.settingsOf', { name: system.name })}</h2>
        {!system.builtIn && (
          <>
            <Field
              label={t('systems.name')}
              value={name}
              required
              maxLength={200}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
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
          </>
        )}
        <dl className={styles.rows}>
          <div>
            <dt>{t('systems.versionLong')}</dt>
            <dd>{versionOf(system)}</dd>
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
      {!system.builtIn && (
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
      )}
    </Modal>
  )
}
