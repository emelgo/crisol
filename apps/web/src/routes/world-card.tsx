import { type PageCover as Cover, WORLD_COLORS, type World } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleOff, ImagePlus, Maximize2, Plus, Settings } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { burnCard, closeAtOnce, holdCard, keepCard, revealCard } from '../components/card-transition.ts'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import { focusAfterRemoving } from '../components/focus.ts'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { ENTER_WORLD, enterWorld, worldTransition } from '../components/world-transition.ts'
import { coverStyle, useWorldFiles } from '../wiki/cover.tsx'
import styles from './world-card.module.css'
import { CoverDialog, CoverViewer, type LocalImage } from './world-cover.tsx'
import { colorHex, PRESET_COLORS, rememberColor, rememberedColors } from './world-look.ts'

/** El color del mundo (--world-color): tiñe, sutil, el contorno de su tarjeta y el hueco de la portada si no hay imagen */
const tint = (color: World['color']): CSSProperties | undefined => {
  const hex = colorHex(color)
  return hex ? ({ '--world-color': hex } as CSSProperties) : undefined
}

/**
 * La tarjeta de un mundo: la portada, el nombre, la descripción y, abajo, el papel y el engranaje de quien lo dirige.
 * Toda la tarjeta lleva al mundo (el enlace del nombre la cubre), salvo sus botones. fresh: recién creado, se forja
 * (sale del crisol al rojo y se enfría); burning: ya borrado, arde hasta consumirse y entonces onBurnt
 */
export function WorldCard({
  world,
  fresh = false,
  burning = false,
  onBurnt
}: {
  world: World
  fresh?: boolean
  burning?: boolean
  onBurnt?: () => void
}) {
  const { t } = useTranslation()
  const master = world.role === 'master'
  // Las imágenes del mundo solo las lista quien lo administra; quien juega ve el color
  const files = useWorldFiles(world.id, master && world.cover !== null)
  const image = world.cover ? files.data?.files.find((f) => f.id === world.cover?.fileId) : undefined
  const [viewing, setViewing] = useState(false)
  // Recién creada, entra animada hasta acabar (aunque la página se vuelva a pintar mientras)
  const [entering, setEntering] = useState(fresh)
  const card = useRef<HTMLLIElement>(null)
  // Ardiendo: se quita al consumirse; sin animaciones (las pruebas), al momento; como mucho, en lo que dura y un poco
  const burnt = useRef(onBurnt)
  burnt.current = onBurnt
  useEffect(() => {
    if (!burning) return
    if (typeof card.current?.getAnimations !== 'function') return burnt.current?.()
    const timer = window.setTimeout(() => burnt.current?.(), 2000)
    return () => window.clearTimeout(timer)
  }, [burning])
  const classes = [styles.card, entering ? styles.entering : '', burning ? styles.burning : ''].filter(Boolean)
  return (
    <li
      ref={card}
      className={classes.join(' ')}
      aria-hidden={burning || undefined}
      inert={burning}
      // Acaba cuando acaba la más larga: el enfriado del contorno, o el fuego
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.animationName.includes('enfria')) setEntering(false)
        if (event.animationName.includes('arde')) burnt.current?.()
      }}
      style={{ ...tint(world.color), ...worldTransition(world.id) }}
      data-world={world.id}
    >
      <CoverHeader
        url={image?.url}
        cover={world.cover}
        actions={
          image && (
            <button type="button" aria-haspopup="dialog" onClick={() => setViewing(true)}>
              <Maximize2 aria-hidden="true" size={14} />
              {t('cover.view')}
            </button>
          )
        }
      />
      {viewing && image && (
        <CoverViewer url={image.url} label={t('cover.of', { name: world.name })} onClose={() => setViewing(false)} />
      )}
      <div className={styles.body}>
        <Link
          to="/mundos/$worldId"
          params={{ worldId: world.id }}
          className={styles.name}
          viewTransition={ENTER_WORLD}
          onClick={(event) => enterWorld(world.id, event.currentTarget.closest('li'))}
        >
          {world.name}
        </Link>
        {world.description && <p className={styles.description}>{world.description}</p>}
        <div className={styles.footer}>
          <span className={styles.role}>{t(`roles.${world.role}`)}</span>
          {master && <WorldSettings world={world} />}
        </div>
      </div>
    </li>
  )
}

/**
 * La portada: la imagen o, sin ella, un hueco con un tinte oscuro del color del mundo. Al pasar el ratón se acerca un
 * poco y salen sus acciones (Ver, Cambiar). large: la de la ventana del mundo
 */
function CoverHeader({
  url,
  cover,
  large = false,
  actions
}: {
  url: string | undefined
  cover: Cover | null
  large?: boolean
  actions?: ReactNode
}) {
  return (
    <div className={large ? `${styles.header} ${styles.large}` : styles.header}>
      <div className={styles.frame}>
        <div className={styles.picture}>
          {url && cover && <img src={url} alt="" className={styles.image} style={coverStyle(cover)} />}
        </div>
        {actions && <div className={styles.coverActions}>{actions}</div>}
      </div>
    </div>
  )
}

/**
 * «Nuevo mundo»: un recuadro como el de un mundo, con el borde discontinuo y vacío, tras el último. big: el botón
 * grande de cuando aún no hay ninguno
 */
export function NewWorld({ big = false }: { big?: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const button = (
    <button
      ref={trigger}
      type="button"
      className={big ? `${form.button} ${styles.big}` : styles.newCard}
      data-tour="nuevo-mundo"
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      <Plus aria-hidden="true" size={big ? 18 : 28} strokeWidth={big ? 2 : 1.5} />
      {t(big ? 'worlds.createFirst' : 'worlds.newTitle')}
    </button>
  )
  const dialog = open && (
    <WorldDialog
      onClose={(created) => {
        setOpen(false)
        // Creado, el cuadro ya se ha ido: ahora la lista, con la tarjeta nueva entrando
        if (created) void queryClient.invalidateQueries({ queryKey: ['worlds'] })
        else trigger.current?.focus()
      }}
    />
  )
  if (big) {
    return (
      <>
        {button}
        {dialog}
      </>
    )
  }
  return (
    <li className={styles.newItem}>
      {button}
      {dialog}
    </li>
  )
}

/** El engranaje de la tarjeta (para quien dirige el mundo): abre su ventana */
function WorldSettings({ world }: { world: World }) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.gear}
        aria-label={t('worlds.settingsOf', { name: world.name })}
        title={t('worlds.settingsOf', { name: world.name })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Settings aria-hidden="true" size={18} />
      </button>
      {open && (
        <WorldDialog
          world={world}
          onClose={(deleted) => {
            setOpen(false)
            if (!deleted) trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/** Descarga una imagen antes de enseñarla (como mucho, un par de segundos) */
function preload(url: string) {
  const image = new Image()
  image.src = url
  const loaded = typeof image.decode === 'function' ? image.decode().catch(() => undefined) : Promise.resolve()
  return Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 2000))])
}

interface Draft {
  name: string
  description: string
  color: World['color']
}

const draftOf = (world?: World): Draft => ({
  name: world?.name ?? '',
  description: world?.description ?? '',
  color: world?.color ?? null
})

/**
 * La ventana de un mundo, la misma para crearlo y para ajustarlo: la portada arriba (con lo que se va eligiendo), el
 * nombre, la descripción y el color. Al ajustarlo, «Cancelar» (deshace) y «Guardar» solo salen con cambios,
 * la portada se guarda en su cuadro y al final va la zona de peligro. Al crearlo, la portada elegida se sube al crear.
 * onClose(gone): gone, si se ha creado o borrado (el botón que la abrió ya no tiene el foco que devolver)
 */
function WorldDialog({ world, onClose }: { world?: World; onClose: (gone: boolean) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const { account } = useAccounts().useAccount()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [draft, setDraft] = useState(() => draftOf(world))
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['worlds'] })
  const gone = useRef(false)

  // La portada: al ajustar, la del mundo (se guarda en su cuadro); al crear, la elegida y su imagen, aún sin subir
  const files = useWorldFiles(world?.id ?? '', Boolean(world?.cover))
  const worldImage = world?.cover ? files.data?.files.find((f) => f.id === world.cover?.fileId) : undefined
  // Al crear: la elegida (una común, o una propia aún sin subir, con su imagen)
  const [newCover, setNewCover] = useState<{ cover: Cover; local: LocalImage | null } | null>(null)
  // La imagen sin subir se suelta cuando deja de usarse (otra o ninguna) y al cerrar
  const shownUrl = useRef<string | null>(null)
  useEffect(() => {
    const url = newCover?.local?.url ?? null
    if (shownUrl.current && shownUrl.current !== url) URL.revokeObjectURL(shownUrl.current)
    shownUrl.current = url
  }, [newCover])
  useEffect(
    () => () => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current)
    },
    []
  )
  const common = useQuery({
    queryKey: ['commonFiles'],
    queryFn: () => api.call('listCommonFiles', {}),
    enabled: !world && Boolean(newCover && !newCover.local)
  })
  const cover = world ? world.cover : (newCover?.cover ?? null)
  const coverUrl = world
    ? worldImage?.url
    : (newCover?.local?.url ?? common.data?.files.find((f) => f.id === newCover?.cover.fileId)?.url)
  const [viewing, setViewing] = useState(false)
  const [changingCover, setChangingCover] = useState(false)

  const changed = world
    ? draft.name.trim() !== world.name || draft.description.trim() !== world.description || draft.color !== world.color
    : true
  const save = useMutation({
    mutationFn: async () => {
      const name = draft.name.trim()
      const look = { description: draft.description.trim(), color: draft.color }
      if (world) {
        if (name !== world.name) await api.call('renameWorld', { worldId: world.id, name })
        await api.call('updateWorld', { worldId: world.id, ...look })
      } else {
        const created = await api.call('createWorld', { name })
        // No sale en la lista hasta que su transición la enseña, saliendo de esta ventana
        holdCard(created.id)
        createdId.current = created.id
        let chosen: Cover | null = null
        // Una común se usa tal cual; una propia se sube ahora, al mundo nuevo
        if (newCover?.local) {
          const stored = await api.uploadFile(
            { worldId: created.id, name: newCover.local.file.name },
            newCover.local.file
          )
          chosen = { ...newCover.cover, fileId: stored.id }
        } else if (newCover) chosen = newCover.cover
        if (look.description || look.color || chosen) {
          await api.call('updateWorld', { worldId: created.id, ...look, ...(chosen ? { cover: chosen } : {}) })
        }
        // La tarjeta sale ya con su portada: sus archivos pedidos y la imagen descargada antes de enseñarla
        if (chosen) {
          await queryClient.prefetchQuery({
            queryKey: ['files', created.id],
            queryFn: () => api.call('listFiles', { worldId: created.id })
          })
          await preload(`/api/files/${chosen.fileId}`)
        }
      }
      if (account) rememberColor(account.email, draft.color)
      if (world) await refresh()
    },
    onSuccess: async () => {
      if (world || !createdId.current) return
      // Creado: esta ventana se encoge en su tarjeta nueva, al rojo
      gone.current = true
      await revealCard(createdId.current, dialog.current, refresh)
    }
  })
  const createdId = useRef<string | null>(null)
  // Borrado, la tarjeta desaparece: el foco, a la siguiente (o al título)
  const remove = async () => {
    if (!world) return
    await api.call('deleteWorld', { worldId: world.id })
    // Se mantiene en su sitio hasta que arde, aunque la lista se ponga al día antes
    const card = document.querySelector(`[data-world="${world.id}"]`)
    keepCard(world, card?.parentElement ? [...card.parentElement.children].indexOf(card) : 0)
    const after = focusAfterRemoving(card)
    gone.current = true
    closeAtOnce(dialog.current)
    await burnCard(world.id, refresh)
    after()
  }

  const title = world ? t('worlds.settingsOf', { name: world.name }) : t('worlds.newTitle')
  return (
    <Modal
      ref={dialog}
      aria-labelledby={titleId}
      className={styles.dialog}
      style={tint(draft.color)}
      onClose={() => onClose(gone.current)}
    >
      <CoverHeader
        url={coverUrl}
        cover={cover}
        large
        actions={
          <>
            {coverUrl && (
              <button type="button" aria-haspopup="dialog" onClick={() => setViewing(true)}>
                <Maximize2 aria-hidden="true" size={14} />
                {t('cover.view')}
              </button>
            )}
            <button type="button" aria-haspopup="dialog" onClick={() => setChangingCover(true)}>
              <ImagePlus aria-hidden="true" size={14} />
              {t(cover ? 'cover.change' : 'cover.add')}
            </button>
          </>
        }
      />
      {viewing && coverUrl && (
        <CoverViewer url={coverUrl} label={t('cover.of', { name: draft.name })} onClose={() => setViewing(false)} />
      )}
      {changingCover && (
        <CoverDialog
          worldId={world?.id}
          title={world ? t('cover.of', { name: world.name }) : t('cover.title')}
          cover={cover}
          local={newCover?.local ?? null}
          onSave={async (chosen, local) => {
            if (!world) {
              setNewCover(chosen ? { cover: chosen, local } : null)
              return
            }
            await api.call('updateWorld', { worldId: world.id, cover: chosen })
            await refresh()
          }}
          onClose={() => setChangingCover(false)}
        />
      )}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <Field
          label={t('worlds.name')}
          value={draft.name}
          required
          maxLength={120}
          autoComplete="off"
          data-autofocus={world ? undefined : ''}
          onChange={(event) => set({ name: event.currentTarget.value })}
        />
        <Field
          label={t('worlds.description')}
          hint={t('worlds.descriptionHint')}
          value={draft.description}
          maxLength={280}
          onChange={(event) => set({ description: event.currentTarget.value })}
        />
        <ColorChoices value={draft.color} onChange={(color) => set({ color })} />
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t(world ? 'worlds.save' : 'worlds.create')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => (world ? setDraft(draftOf(world)) : dialog.current?.close())}
          >
            {t('worlds.cancel')}
          </button>
        </ChangesBar>
      </form>
      {world && (
        // Aparte, al final y fuera del formulario: borrar el mundo, escribiendo su nombre para confirmarlo
        <div className={styles.dangerArea}>
          <DangerZone>
            <ConfirmByName
              name={world.name}
              action={t('worlds.deleteWorld')}
              title={t('worlds.deleteTitle', { name: world.name })}
              warning={t('worlds.deleteWarning', { days: TRASH_DAYS })}
              label={t('worlds.name')}
              onConfirm={remove}
            />
          </DangerZone>
        </div>
      )}
    </Modal>
  )
}

/** El color: ninguno, uno de los fijos, uno de los propios que ya se crearon o uno nuevo, con el selector de color */
function ColorChoices({ value, onChange }: { value: World['color']; onChange: (color: World['color']) => void }) {
  const { t } = useTranslation()
  const { account } = useAccounts().useAccount()
  const name = useId()
  const remembered = account ? rememberedColors(account.email) : []
  // El propio que está puesto, aunque aún no se recuerde (recién elegido)
  const custom =
    value?.startsWith('#') && !remembered.some((c) => c.toLowerCase() === value.toLowerCase())
      ? [value, ...remembered]
      : remembered
  const swatch = (id: string, hex: string, label: string) => (
    <label key={id} className={styles.colorChoice} title={label}>
      <input type="radio" name={name} checked={value === id} onChange={() => onChange(id as World['color'])} />
      <span aria-hidden="true" style={{ background: hex }} />
      <span className={styles.hidden}>{label}</span>
    </label>
  )
  return (
    <fieldset className={styles.choices}>
      <legend>{t('worlds.color')}</legend>
      <label className={styles.colorChoice} title={t('worlds.noColor')}>
        <input type="radio" name={name} checked={value === null} onChange={() => onChange(null)} />
        <CircleOff aria-hidden="true" size={18} strokeWidth={1.5} />
        <span className={styles.hidden}>{t('worlds.noColor')}</span>
      </label>
      {WORLD_COLORS.map((id) => swatch(id, PRESET_COLORS[id], t(`worlds.colors.${id}`)))}
      {custom.map((hex) => swatch(hex, hex, hex))}
      <label className={`${styles.colorChoice} ${styles.newColor}`} title={t('worlds.customColor')}>
        <input
          type="color"
          value={value?.startsWith('#') ? value : '#7a4a8c'}
          onChange={(event) => onChange(event.currentTarget.value as World['color'])}
        />
        <Plus aria-hidden="true" size={18} />
        <span className={styles.hidden}>{t('worlds.customColor')}</span>
      </label>
    </fieldset>
  )
}
