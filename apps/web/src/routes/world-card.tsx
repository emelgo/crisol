import { type Campaign, type PageCover as Cover, WORLD_COLORS, type World } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
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
import { PageTitle } from '../components/page-title.tsx'
import { ENTER_WORLD, enterWorld, LEAVE_WORLD, worldTransition } from '../components/world-transition.ts'
import { CampaignSystemFields, type SystemDraft } from '../systems/campaign-system.tsx'
import { coverStyle, useWorldFiles } from '../wiki/cover-look.ts'
import styles from './world-card.module.css'
import { CoverDialog, CoverViewer, type LocalImage } from './world-cover.tsx'
import { colorHex, PRESET_COLORS, rememberColor, rememberedColors } from './world-look.ts'

/** Lo que se ve de un mundo o de una campaña: en su tarjeta, en su ventana y en su cabecera */
export interface Look {
  id: string
  name: string
  description: string
  color: World['color']
  cover: Cover | null
  role: 'master' | 'player'
  /** De una campaña: su sistema de reglas y lo que elige de él */
  system?: Campaign['system']
  systemChoices?: Campaign['systemChoices']
  /** De una campaña: si parte de lo que sabe el mundo (ADR-0017) */
  knowsWorld?: boolean
}

type LookPatch = Partial<Pick<Look, 'name' | 'description' | 'color' | 'cover'>> & {
  system?: string | null
  systemChoices?: SystemDraft['choices']
  knowsWorld?: boolean
}

/** Lo que saben los jugadores de una campaña al empezar: lo del mundo, nada o lo de otra campaña (su id) */
type KnowledgeStart = 'world' | 'none' | string

/**
 * Lo que cambia entre mundos y campañas: sus textos (worlds.* o campaigns.*), su lista de tarjetas, de qué mundo son las
 * imágenes de su portada y cómo se crean, se cambian y se borran
 */
export interface LookKind {
  texts: 'worlds' | 'campaigns'
  /** Si se elige su sistema de reglas (las campañas) */
  systems?: boolean
  /** Su lista (la de card-transition) y la consulta que la pone al día */
  list: string
  queryKey: readonly unknown[]
  /** El mundo de las imágenes de su portada; sin él (al crear un mundo, aún sin archivos), solo las comunes */
  worldOf: (look?: Look, place?: string) => string | undefined
  /** Crea uno con ese nombre (en ese mundo, si se elige): su id y el mundo al que subir su portada */
  create: (name: string, place?: string, start?: KnowledgeStart) => Promise<{ id: string; worldId: string }>
  /** Al crear, en qué mundo: se elige entre estos (las campañas desde Mis mundos) */
  places?: readonly { id: string; name: string }[]
  update: (id: string, patch: LookPatch) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
}

export function useWorldKind(): LookKind {
  const api = useApi()
  return {
    texts: 'worlds',
    list: 'mundos',
    queryKey: ['worlds'],
    worldOf: (look) => look?.id,
    create: (name) => api.call('createWorld', { name }).then((world) => ({ id: world.id, worldId: world.id })),
    update: (worldId, patch) => api.call('updateWorld', { worldId, ...patch }),
    remove: (worldId) => api.call('deleteWorld', { worldId })
  }
}

/** Cómo empieza una campaña nueva, para la API (lo del mundo, por defecto, no se manda) */
const knowledgeInput = (start?: KnowledgeStart) =>
  !start || start === 'world'
    ? {}
    : { knowledge: start === 'none' ? { start: 'none' as const } : { start: 'campaign' as const, campaignId: start } }

export function useCampaignKind(worldId: string): LookKind {
  const api = useApi()
  return {
    texts: 'campaigns',
    systems: true,
    list: `campanas-${worldId}`,
    queryKey: ['campaigns', worldId],
    worldOf: () => worldId,
    create: (name, _place, start) =>
      api
        .call('createCampaign', { worldId, name, ...knowledgeInput(start) })
        .then((campaign) => ({ id: campaign.id, worldId })),
    update: (campaignId, patch) => api.call('updateCampaign', { campaignId, ...patch }),
    remove: (campaignId) => api.call('deleteCampaign', { campaignId })
  }
}

/**
 * Las campañas de todos los mundos, desde Mis mundos: al crear una se elige su mundo (de los que dirige la cuenta). Su
 * lista y su consulta son las de todas
 */
export function useAllCampaignsKind(places: readonly { id: string; name: string }[]): LookKind {
  const api = useApi()
  return {
    texts: 'campaigns',
    systems: true,
    list: 'campanas',
    queryKey: ['campaigns'],
    worldOf: (look, place) => (look as (Look & { worldId?: string }) | undefined)?.worldId ?? place,
    create: (name, place, start) =>
      api.call('createCampaign', { worldId: place ?? '', name, ...knowledgeInput(start) }).then((campaign) => ({
        id: campaign.id,
        worldId: campaign.worldId
      })),
    update: (campaignId, patch) => api.call('updateCampaign', { campaignId, ...patch }),
    remove: (campaignId) => api.call('deleteCampaign', { campaignId }),
    places
  }
}

/** Su color (--world-color): tiñe, sutil, el contorno de su tarjeta y el hueco de la portada si no hay imagen */
const tint = (color: World['color']): CSSProperties | undefined => {
  const hex = colorHex(color)
  return hex ? ({ '--world-color': hex } as CSSProperties) : undefined
}

/**
 * La imagen de su portada, si quien mira puede ver las imágenes de su mundo (quien lo dirige); si no, su color. Su
 * dirección sale de su id: se pide al momento, sin esperar a la lista de archivos
 */
function useCoverImage(look: Look) {
  // Quien juega también la ve: es la portada de su mundo o de su campaña (ADR-0017)
  return look.cover ? { url: `/api/files/${look.cover.fileId}` } : undefined
}

/**
 * La tarjeta de un mundo o de una campaña: la portada, el nombre (name: su enlace, que cubre toda la tarjeta salvo sus
 * botones), la descripción y, abajo, el papel y el engranaje de quien lo dirige. fresh: recién creado, se forja (sale
 * del crisol al rojo y se enfría); burning: ya borrado, arde hasta consumirse y entonces onBurnt
 */
function LookCard({
  kind,
  look,
  name,
  style,
  fresh = false,
  burning = false,
  onBurnt,
  onPreview,
  place
}: {
  kind: LookKind
  look: Look
  name: ReactNode
  /** De qué mundo es (una campaña en Mis mundos) */
  place?: string | undefined
  style?: CSSProperties | undefined
  fresh?: boolean
  burning?: boolean
  onBurnt?: () => void
  /** Al pasar el ratón o llegar con el foco (true) y al irse (false): para enseñarlo en el panel de al lado */
  onPreview?: ((shown: boolean) => void) | undefined
}) {
  const { t } = useTranslation()
  const image = useCoverImage(look)
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
  // Con sus ajustes abiertos, sin vista previa; y al cerrarlos tampoco (el foco vuelve a la tarjeta), hasta que el ratón
  // vuelva a entrar en ella
  const quiet = useRef(false)
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
      style={{ ...tint(look.color), ...style }}
      data-card={look.id}
      onPointerEnter={() => {
        quiet.current = false
        onPreview?.(true)
      }}
      onPointerLeave={() => onPreview?.(false)}
      onFocus={() => {
        if (!quiet.current) onPreview?.(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onPreview?.(false)
      }}
    >
      <CoverHeader
        url={image?.url}
        cover={look.cover}
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
        <CoverViewer url={image.url} label={t('cover.of', { name: look.name })} onClose={() => setViewing(false)} />
      )}
      <div className={styles.body}>
        {name}
        {place && <p className={styles.place}>{place}</p>}
        {look.description && <p className={styles.description}>{look.description}</p>}
        <div className={styles.footer}>
          {/* El papel (máster o jugador) es de las campañas, no de los mundos */}
          {kind.texts === 'campaigns' && <span className={styles.role}>{t(`roles.${look.role}`)}</span>}
          {look.role === 'master' && (
            <LookSettings
              kind={kind}
              look={look}
              onOpen={() => {
                quiet.current = true
                onPreview?.(false)
              }}
            />
          )}
        </div>
      </div>
    </li>
  )
}

/** La tarjeta de un mundo: lleva a él, y al entrar se convierte en su cabecera */
export function WorldCard({
  world,
  fresh,
  burning,
  onBurnt,
  onPreview
}: {
  world: World
  fresh?: boolean
  burning?: boolean
  onBurnt?: () => void
  onPreview?: (shown: boolean) => void
}) {
  const kind = useWorldKind()
  const api = useApi()
  const queryClient = useQueryClient()
  // Al acercarse, su portada se pide ya: al entrar, sale sin esperar
  const prefetch = () => {
    if (world.role !== 'master') return
    void queryClient
      .fetchQuery({
        queryKey: ['pages', world.id, 'home'],
        queryFn: () => api.call('getWorldHome', { worldId: world.id }),
        staleTime: 30_000
      })
      .then(({ pageId }) => {
        if (pageId)
          void queryClient.prefetchQuery({
            queryKey: ['pages', world.id, 'page', pageId],
            queryFn: () => api.call('getPage', { pageId }),
            staleTime: 30_000
          })
      })
      .catch(() => undefined)
  }
  return (
    <LookCard
      kind={kind}
      look={world}
      style={worldTransition(world.id)}
      fresh={fresh}
      burning={burning}
      {...(onBurnt ? { onBurnt } : {})}
      onPreview={(shown) => {
        if (shown) prefetch()
        onPreview?.(shown)
      }}
      name={
        <Link
          to="/mundos/$worldId"
          params={{ worldId: world.id }}
          className={styles.name}
          viewTransition={ENTER_WORLD}
          onClick={(event) => enterWorld(world.id, event.currentTarget.closest('li'))}
        >
          {world.name}
        </Link>
      }
    />
  )
}

/** La tarjeta de una campaña: lleva a ella */
export function CampaignCard({
  worldId,
  campaign,
  fresh,
  burning,
  onBurnt,
  kind: given,
  place
}: {
  worldId: string
  campaign: Look
  fresh?: boolean
  burning?: boolean
  onBurnt?: () => void
  /** La de su lista, si no es la de su mundo (Mis mundos) */
  kind?: LookKind
  place?: string
}) {
  const own = useCampaignKind(worldId)
  const kind = given ?? own
  return (
    <LookCard
      kind={kind}
      look={campaign}
      place={place}
      fresh={fresh}
      burning={burning}
      {...(onBurnt ? { onBurnt } : {})}
      name={
        <Link
          to="/mundos/$worldId/campanas/$campaignId"
          params={{ worldId, campaignId: campaign.id }}
          className={styles.name}
        >
          {campaign.name}
        </Link>
      }
    />
  )
}

/**
 * La portada del mundo como portada ancha de su página de portada (Everlore), la misma se llegue por donde se llegue: al
 * entrar en él (su tarjeta se convierte en ella) o desde el árbol
 */
export function WorldBanner({ world }: { world: World }) {
  const kind = useWorldKind()
  const navigate = useNavigate()
  return (
    <LookHeader
      banner
      kind={kind}
      look={world}
      style={worldTransition(world.id)}
      // Borrado desde dentro: a Mis mundos, saliendo de él
      afterDelete={() => void navigate({ to: '/mundos', viewTransition: LEAVE_WORLD })}
    />
  )
}

/**
 * La cabecera de un mundo (la de su Inicio): como su tarjeta, en grande. Al entrar, la tarjeta se convierte en ella.
 * afterDelete: si se borra desde aquí, adónde se va
 */
export function LookHeader({
  kind,
  look,
  style,
  afterDelete,
  banner = false
}: {
  kind: LookKind
  look: Look
  style?: CSSProperties | undefined
  afterDelete: () => void
  /** Como portada ancha de la página de portada del mundo (Everlore): la imagen, con el engranaje encima */
  banner?: boolean
}) {
  const { t } = useTranslation()
  const image = useCoverImage(look)
  const [viewing, setViewing] = useState(false)
  if (banner) {
    return (
      <header className={styles.banner} style={{ ...tint(look.color), ...style }}>
        <CoverHeader
          url={image?.url}
          cover={look.cover}
          hero
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
          <CoverViewer url={image.url} label={t('cover.of', { name: look.name })} onClose={() => setViewing(false)} />
        )}
        {look.role === 'master' && (
          <div className={styles.bannerGear}>
            <LookSettings kind={kind} look={look} afterDelete={afterDelete} />
          </div>
        )}
      </header>
    )
  }
  return (
    <header className={styles.hero} style={{ ...tint(look.color), ...style }}>
      <CoverHeader
        url={image?.url}
        cover={look.cover}
        hero
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
        <CoverViewer url={image.url} label={t('cover.of', { name: look.name })} onClose={() => setViewing(false)} />
      )}
      <div className={styles.heroBody}>
        <div className={styles.heroText}>
          <PageTitle>{look.name}</PageTitle>
          {look.description && <p className={styles.description}>{look.description}</p>}
        </div>
        <div className={styles.footer}>
          {/* El papel (máster o jugador) es de las campañas, no de los mundos */}
          {kind.texts === 'campaigns' && <span className={styles.role}>{t(`roles.${look.role}`)}</span>}
          {look.role === 'master' && <LookSettings kind={kind} look={look} afterDelete={afterDelete} />}
        </div>
      </div>
    </header>
  )
}

/**
 * La portada: la imagen o, sin ella, un hueco con un tinte oscuro de su color. Al pasar el ratón se acerca un poco y
 * salen sus acciones (Ver, Cambiar). large: la de su ventana; hero: la de la cabecera
 */
function CoverHeader({
  url,
  cover,
  large = false,
  hero = false,
  actions
}: {
  url: string | undefined
  cover: Cover | null
  large?: boolean
  hero?: boolean
  actions?: ReactNode
}) {
  const classes = [styles.header, large ? styles.large : '', hero ? styles.heroCover : ''].filter(Boolean)
  return (
    <div className={classes.join(' ')}>
      <div className={styles.frame}>
        <div className={styles.picture}>
          {url && cover && (
            <img
              src={url}
              alt=""
              className={styles.image}
              style={coverStyle(cover)}
              // Si ya no está (en la papelera), queda el hueco con su color
              onError={(event) => {
                event.currentTarget.hidden = true
              }}
            />
          )}
          {/* En su ventana, sin portada: se ve que ahí va una (no un recuadro gris sin más) */}
          {large && !url && <ImagePlus aria-hidden="true" size={28} strokeWidth={1.5} className={styles.noCover} />}
        </div>
      </div>
      {/* Fuera del marco: su recorte las dejaría debajo del enlace que cubre la tarjeta */}
      {actions && <div className={styles.coverActions}>{actions}</div>}
    </div>
  )
}

/**
 * «Nuevo …»: un recuadro como el de una tarjeta, con el borde discontinuo y vacío, tras la última. big: el botón grande
 * de cuando aún no hay ninguna
 */
export function NewLook({ kind, big = false, tour }: { kind: LookKind; big?: boolean; tour?: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const button = (
    <button
      ref={trigger}
      type="button"
      className={big ? `${form.button} ${styles.big}` : styles.newCard}
      data-tour={tour}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      <Plus aria-hidden="true" size={big ? 18 : 28} strokeWidth={big ? 2 : 1.5} />
      {t(big ? `${kind.texts}.createFirst` : `${kind.texts}.newTitle`)}
    </button>
  )
  const dialog = open && (
    <LookDialog
      kind={kind}
      onClose={(created) => {
        setOpen(false)
        // Creado, el cuadro ya se ha ido: ahora la lista, con la tarjeta nueva entrando
        if (created) void queryClient.invalidateQueries({ queryKey: kind.queryKey })
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

/** «Nuevo mundo», tras el último (big: el botón grande de cuando aún no hay ninguno) */
export function NewWorld({ big = false }: { big?: boolean }) {
  return <NewLook kind={useWorldKind()} big={big} tour="nuevo-mundo" />
}

/** El engranaje (para quien lo dirige): abre su ventana */
function LookSettings({
  kind,
  look,
  afterDelete,
  onOpen
}: {
  kind: LookKind
  look: Look
  afterDelete?: () => void
  /** Al abrir su ventana */
  onOpen?: () => void
}) {
  const { t } = useTranslation()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.gear}
        aria-label={t(`${kind.texts}.settingsOf`, { name: look.name })}
        title={t(`${kind.texts}.settingsOf`, { name: look.name })}
        aria-haspopup="dialog"
        data-tour="engranaje"
        onClick={() => {
          onOpen?.()
          setOpen(true)
        }}
      >
        <Settings aria-hidden="true" size={18} />
      </button>
      {open && (
        <LookDialog
          kind={kind}
          look={look}
          {...(afterDelete ? { afterDelete } : {})}
          onClose={(deleted) => {
            setOpen(false)
            if (!deleted) trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

/** Sin las claves que no tienen valor (lo que no se cambia no se manda) */
const withoutUndefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>

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
  system: SystemDraft
  /** De una campaña: al crearla, lo que saben sus jugadores; ya creada, si parte de lo que sabe el mundo */
  start: KnowledgeStart
  knowsWorld: boolean
}

const draftOf = (look?: Look): Draft => ({
  name: look?.name ?? '',
  description: look?.description ?? '',
  color: look?.color ?? null,
  system: { system: look?.system?.id ?? null, choices: (look?.systemChoices ?? {}) as SystemDraft['choices'] },
  start: 'world',
  knowsWorld: look?.knowsWorld ?? true
})

/**
 * La ventana de un mundo o de una campaña, la misma para crearlo y para ajustarlo: la portada arriba (con lo que se va
 * eligiendo), el nombre, la descripción y el color. Al ajustarlo, «Cancelar» (deshace) y «Guardar» solo salen con
 * cambios, la portada se guarda en su cuadro y al final va la zona de peligro. Al crear un mundo, la portada elegida se
 * sube al crearlo. onClose(gone): gone, si se ha creado o borrado (el botón que la abrió ya no tiene el foco que
 * devolver). afterDelete: borrado desde fuera de su lista (su cabecera), en vez de arder en ella
 */
function LookDialog({
  kind,
  look,
  afterDelete,
  onClose
}: {
  kind: LookKind
  look?: Look
  afterDelete?: () => void
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const { account } = useAccounts().useAccount()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [draft, setDraft] = useState(() => draftOf(look))
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const refresh = () => queryClient.invalidateQueries({ queryKey: kind.queryKey })
  const gone = useRef(false)
  const texts = kind.texts
  // Al crear una campaña desde Mis mundos, su mundo
  const placeId = useId()
  const [place, setPlace] = useState(kind.places?.[0]?.id)

  // La portada: al ajustar, la suya (se guarda en su cuadro); al crear, la elegida y, si es propia, su imagen sin subir
  const filesWorld = kind.worldOf(look, place)
  const [newCover, setNewCover] = useState<{ cover: Cover; local: LocalImage | null } | null>(null)
  const files = useWorldFiles(filesWorld ?? '', Boolean(filesWorld) && Boolean(look?.cover || newCover))
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
  // Al crear un mundo, que aún no tiene archivos, se elige entre los comunes
  const common = useQuery({
    queryKey: ['commonFiles'],
    queryFn: () => api.call('listCommonFiles', {}),
    enabled: !filesWorld && Boolean(newCover && !newCover.local)
  })
  const cover = look ? look.cover : (newCover?.cover ?? null)
  const pool = filesWorld ? files.data?.files : common.data?.files
  const coverUrl = newCover?.local?.url ?? pool?.find((f) => f.id === cover?.fileId)?.url
  const [viewing, setViewing] = useState(false)
  const [systemProblem, setSystemProblem] = useState<string | null>(null)
  const [changingCover, setChangingCover] = useState(false)

  // El sistema, solo en las campañas: si cambió el sistema o lo que se elige de él
  const systemChanged = Boolean(kind.systems) && JSON.stringify(draft.system) !== JSON.stringify(draftOf(look).system)
  const systemPatch = systemChanged
    ? { system: draft.system.system, systemChoices: draft.system.system ? draft.system.choices : undefined }
    : {}
  const knowsChanged = Boolean(kind.systems) && Boolean(look) && draft.knowsWorld !== (look?.knowsWorld ?? true)
  const changed = look
    ? draft.name.trim() !== look.name ||
      draft.description.trim() !== look.description ||
      draft.color !== look.color ||
      systemChanged ||
      knowsChanged
    : true
  const createdId = useRef<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const name = draft.name.trim()
      const appearance = { description: draft.description.trim(), color: draft.color }
      if (look) {
        const updated = (await kind.update(look.id, {
          ...(name !== look.name ? { name } : {}),
          ...appearance,
          ...withoutUndefined(systemPatch),
          ...(knowsChanged ? { knowsWorld: draft.knowsWorld } : {})
        })) as Partial<Look> | undefined
        // Lo que se elige del sistema vuelve completo (con sus valores iniciales): el borrador, como quedó
        if (systemChanged && updated)
          set({
            system: {
              system: updated.system?.id ?? null,
              choices: (updated.systemChoices ?? {}) as SystemDraft['choices']
            }
          })
      } else {
        const created = await kind.create(name, place, kind.systems ? draft.start : undefined)
        // No sale en la lista hasta que su transición la enseña, saliendo de esta ventana
        holdCard(created.id)
        createdId.current = created.id
        let chosen: Cover | null = null
        // Una ya subida se usa tal cual; una propia sin subir, se sube ahora a su mundo
        if (newCover?.local) {
          const stored = await api.uploadFile(
            { worldId: created.worldId, name: newCover.local.file.name },
            newCover.local.file
          )
          chosen = { ...newCover.cover, fileId: stored.id }
        } else if (newCover) chosen = newCover.cover
        if (appearance.description || appearance.color || chosen || systemChanged) {
          await kind.update(created.id, {
            ...appearance,
            ...(chosen ? { cover: chosen } : {}),
            ...withoutUndefined(systemPatch)
          })
        }
        // La tarjeta sale ya con su portada: los archivos de su mundo pedidos y la imagen descargada antes de enseñarla
        if (chosen) {
          await queryClient.prefetchQuery({
            queryKey: ['files', created.worldId],
            queryFn: () => api.call('listFiles', { worldId: created.worldId })
          })
          await preload(`/api/files/${chosen.fileId}`)
        }
      }
      if (account) rememberColor(account.email, draft.color)
      if (look) await refresh()
    },
    onSuccess: async () => {
      if (look || !createdId.current) return
      // Creado: esta ventana se encoge en su tarjeta nueva, al rojo
      gone.current = true
      await revealCard(createdId.current, dialog.current, refresh)
    }
  })
  // Borrado, su tarjeta arde y desaparece: el foco, a la siguiente (o al título). Desde su cabecera, a afterDelete
  const remove = async () => {
    if (!look) return
    await kind.remove(look.id)
    gone.current = true
    if (afterDelete) {
      closeAtOnce(dialog.current)
      afterDelete()
      return
    }
    // Se mantiene en su sitio hasta que arde, aunque la lista se ponga al día antes
    const card = document.querySelector(`[data-card="${look.id}"]`)
    keepCard(kind.list, look, card?.parentElement ? [...card.parentElement.children].indexOf(card) : 0)
    const after = focusAfterRemoving(card)
    closeAtOnce(dialog.current)
    await burnCard(look.id, refresh)
    after()
  }

  const title = look ? t(`${texts}.settingsOf`, { name: look.name }) : t(`${texts}.newTitle`)
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
          worldId={filesWorld}
          title={look ? t('cover.of', { name: look.name }) : t('cover.title')}
          cover={cover}
          local={newCover?.local ?? null}
          onSave={async (chosen, local) => {
            if (!look) {
              setNewCover(chosen ? { cover: chosen, local } : null)
              return
            }
            await kind.update(look.id, { cover: chosen })
            await refresh()
          }}
          onClose={() => setChangingCover(false)}
        />
      )}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          // Lo que impide guardar el sistema (sin ninguna edición) ya se dice junto a él
          if (systemProblem) return
          save.mutate()
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <Field
          label={t(`${texts}.name`)}
          value={draft.name}
          required
          maxLength={120}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          data-autofocus={look ? undefined : ''}
          onChange={(event) => set({ name: event.currentTarget.value })}
        />
        {!look && kind.places && (
          <div className={styles.placeField}>
            <label htmlFor={placeId}>{t('campaigns.world')}</label>
            <select
              id={placeId}
              value={place}
              onChange={(event) => {
                setPlace(event.currentTarget.value)
                // La portada es de su mundo: al cambiarlo, se quita
                setNewCover(null)
              }}
            >
              {kind.places.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Field
          label={t('worlds.description')}
          hint={t('worlds.descriptionHint')}
          value={draft.description}
          maxLength={280}
          onChange={(event) => set({ description: event.currentTarget.value })}
        />
        <ColorChoices value={draft.color} onChange={(color) => set({ color })} />
        {kind.systems && (
          <CampaignSystemFields
            value={draft.system}
            onChange={(system) => set({ system })}
            onProblem={setSystemProblem}
          />
        )}
        {kind.systems && (
          <CampaignKnowledgeField worldId={filesWorld} look={look} draft={draft} onChange={(patch) => set(patch)} />
        )}
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t(look ? 'worlds.save' : `${texts}.create`)}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => (look ? setDraft(draftOf(look)) : dialog.current?.close())}
          >
            {t('worlds.cancel')}
          </button>
        </ChangesBar>
      </form>
      {look && (
        // Aparte, al final y fuera del formulario: borrarlo, escribiendo su nombre para confirmarlo
        <div className={styles.dangerArea}>
          <DangerZone>
            <ConfirmByName
              name={look.name}
              action={t(`${texts}.delete`)}
              title={t(`${texts}.deleteTitle`, { name: look.name })}
              warning={t(`${texts}.deleteWarning`, { days: TRASH_DAYS })}
              label={t(`${texts}.name`)}
              onConfirm={remove}
            />
          </DangerZone>
        </div>
      )}
    </Modal>
  )
}

/**
 * Lo que saben los jugadores (ADR-0017): al crear la campaña, «Lo que sabe el mundo», «Nada» o «Lo mismo que» otra del
 * mundo; ya creada, si parte de lo que sabe el mundo
 */
function CampaignKnowledgeField({
  worldId,
  look,
  draft,
  onChange
}: {
  worldId: string | undefined
  look: Look | undefined
  draft: Draft
  onChange: (patch: Partial<Draft>) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const campaigns = useQuery({
    queryKey: ['campaigns', worldId],
    queryFn: () => api.call('listCampaigns', { worldId: worldId ?? '' }),
    enabled: Boolean(worldId) && !look
  })
  if (look) {
    return (
      <label className={form.check}>
        <input
          type="checkbox"
          checked={draft.knowsWorld}
          onChange={(event) => onChange({ knowsWorld: event.currentTarget.checked })}
        />
        {t('campaigns.knowsWorld')}
      </label>
    )
  }
  return (
    <div className={form.field}>
      <label htmlFor={id}>{t('campaigns.start')}</label>
      <select id={id} value={draft.start} onChange={(event) => onChange({ start: event.currentTarget.value })}>
        <option value="world">{t('campaigns.startWorld')}</option>
        <option value="none">{t('campaigns.startNone')}</option>
        {(campaigns.data?.campaigns ?? []).map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {t('campaigns.startSame', { name: campaign.name })}
          </option>
        ))}
      </select>
    </div>
  )
}

/** El color: ninguno, uno de los fijos, uno de los propios que ya se crearon o uno nuevo, con el selector de color */
export function ColorChoices({
  value,
  onChange
}: {
  value: World['color']
  onChange: (color: World['color']) => void
}) {
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

/**
 * El mundo sobre el que está el ratón, en el panel de la izquierda de Mis mundos: su portada, su descripción, sus
 * campañas y cuántos archivos tiene (se entra y se ajusta desde su tarjeta)
 */
export function WorldDetail({ world }: { world: World }) {
  const { t } = useTranslation()
  const api = useApi()
  const master = world.role === 'master'
  const image = useCoverImage(world)
  const campaigns = useQuery({
    queryKey: ['campaigns', world.id],
    queryFn: () => api.call('listCampaigns', { worldId: world.id })
  })
  const files = useWorldFiles(world.id, master)
  const own = files.data?.files.filter((file) => file.worldId !== null).length
  return (
    <div className={styles.detailBody} style={tint(world.color)}>
      <CoverHeader url={image?.url} cover={world.cover} />
      <div className={styles.detailText}>
        <h2 className={styles.detailName}>{world.name}</h2>
        {world.description && <p className={styles.description}>{world.description}</p>}
        <dl className={styles.facts}>
          <dt>{t('campaigns.title')}</dt>
          <dd>
            {campaigns.data
              ? campaigns.data.campaigns.length > 0
                ? campaigns.data.campaigns.map((c) => c.name).join(' · ')
                : t('worlds.noCampaigns')
              : '…'}
          </dd>
          {master && (
            <>
              <dt>{t('files.title')}</dt>
              <dd>
                {own === undefined ? '…' : own > 0 ? t('files.folderFiles', { count: own }) : t('worlds.noFiles')}
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  )
}
