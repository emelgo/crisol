/**
 * La pestaña de mapa de una página (ADR-0007): su imagen, que se mueve y se acerca, con pines que llevan a páginas. El
 * visor es el de Everlore rehecho sobre lo nuestro: durante el gesto el escenario se mueve con `transform` directamente
 * en el DOM (sin pintar React), la rueda acerca hacia el cursor y los pines guardan su tamaño con --inv-k
 */
import type { MapPinView, MapView, Page, PageTabView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ImageIcon, MapPin, Maximize, Minus, Plus } from 'lucide-react'
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client.ts'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { Loading } from '../../components/brand.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import { FormError } from '../../components/field.tsx'
import list from '../../components/list.module.css'
import { failed, LoadError } from '../../components/load-error.tsx'
import { Tour } from '../../components/tour.tsx'
import { useWorldFiles } from '../cover-look.ts'
import { readAsInput, readAsKey, useReadAs } from '../read-as.tsx'
import styles from './map.module.css'
import { PinPanel } from './pin-panel.tsx'
import { PinShape, tipAnchored } from './pin-shape.tsx'

export const mapKey = (worldId: string, tabId: string) => ['pages', worldId, 'map', tabId]

const MIN_SCALE = 0.05
const MAX_SCALE = 8

type View = { x: number; y: number; k: number }

const clampScale = (k: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, k))
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Acercar (o alejar) por un factor sin que se mueva el punto de la pantalla que está en (px, py) */
export function zoomedAt(view: View, factor: number, px: number, py: number): View {
  const k = clampScale(view.k * factor)
  const ratio = k / view.k
  return { k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }
}

/** Lo que mide de verdad una imagen (un SVG sin medidas, uno razonable) */
function naturalSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth || 1600, height: image.naturalHeight || 1200 })
    image.onerror = () => reject(new ApiError('BAD_MAP_IMAGE', 400))
    image.src = url
  })
}

/** El mapa de una pestaña: pide imagen si no la tiene */
export function MapTab({ page, tab }: { page: Page; tab: PageTabView }) {
  const { t } = useTranslation()
  const api = useApi()
  // Leyendo como jugador, el mapa con lo que ve (ADR-0017)
  const readAs = useReadAs()
  const map = useQuery({
    queryKey: [...mapKey(page.worldId, tab.id), ...readAsKey(readAs)],
    queryFn: () => api.call('getMap', { tabId: tab.id, ...readAsInput(readAs) })
  })
  if (!map.data) {
    return failed(map) ? <LoadError error={map.error} onRetry={() => map.refetch()} /> : <Loading />
  }
  if (!map.data.image) {
    return (
      <section className={styles.empty} aria-label={t('map.label', { name: tab.name })}>
        <MapPin aria-hidden="true" size={32} strokeWidth={1.5} />
        <p>{t('map.empty')}</p>
        {!page.locked && <ImageChooser page={page} map={map.data} />}
      </section>
    )
  }
  return <MapViewer page={page} tab={tab} map={map.data} />
}

/** Elegir la imagen del mapa entre las del mundo o subir una */
function ImageChooser({ page, map, onDone }: { page: Page; map: MapView; onDone?: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const files = useWorldFiles(page.worldId)
  const selectId = useId()
  const upload = useRef<HTMLInputElement>(null)
  const images = files.data?.files.filter((file) => file.kind === 'image') ?? []
  const choose = useMutation({
    mutationFn: async (file: { id: string; url: string }) => {
      const size = await naturalSize(file.url)
      return api.call('updateMap', { mapId: map.id, image: { fileId: file.id, ...size } })
    },
    onSuccess: (next) => {
      queryClient.setQueryData(mapKey(page.worldId, map.tabId), next)
      onDone?.()
    }
  })
  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const stored = await api.uploadFile({ worldId: page.worldId, name: file.name }, file)
      if (stored.kind !== 'image') throw new ApiError('BAD_MAP_IMAGE', 400)
      await queryClient.invalidateQueries({ queryKey: ['files', page.worldId] })
      await choose.mutateAsync(stored)
    }
  })
  return (
    <div className={styles.chooser}>
      <label htmlFor={selectId}>{t('map.image')}</label>
      <select
        id={selectId}
        value={map.image?.fileId ?? ''}
        onChange={(event) => {
          const file = images.find((image) => image.id === event.currentTarget.value)
          if (file) choose.mutate(file)
        }}
      >
        <option value="" disabled>
          {t('map.chooseImage')}
        </option>
        {images.map((file) => (
          <option key={file.id} value={file.id}>
            {file.name}
          </option>
        ))}
      </select>
      <BusyButton
        className={list.secondary}
        busy={uploadImage.isPending || choose.isPending}
        onClick={() => upload.current?.click()}
      >
        {t('map.upload')}
      </BusyButton>
      <input
        ref={upload}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (chosen) uploadImage.mutate(chosen)
        }}
      />
      <FormError message={choose.error || uploadImage.error ? errorText(choose.error ?? uploadImage.error) : null} />
    </div>
  )
}

/** Poner, cambiar y quitar pines, con el mapa de la caché al día al momento */
function usePins(page: Page, map: MapView) {
  const api = useApi()
  const queryClient = useQueryClient()
  const key = mapKey(page.worldId, map.tabId)
  const put = (pin: MapPinView) =>
    queryClient.setQueryData<MapView>(key, (current) =>
      current
        ? {
            ...current,
            pins: current.pins.some((other) => other.id === pin.id)
              ? current.pins.map((other) => (other.id === pin.id ? pin : other))
              : [...current.pins, pin]
          }
        : current
    )
  const create = useMutation({
    mutationFn: (input: { x: number; y: number }) => api.call('createMapPin', { mapId: map.id, ...input }),
    onSuccess: put
  })
  const update = useMutation({
    mutationFn: ({ pinId, ...patch }: { pinId: string } & Partial<Omit<MapPinView, 'id' | 'pageTitle'>>) =>
      api.call('updateMapPin', { pinId, ...patch }),
    // Se ve al momento; si falla, vuelve lo del servidor
    onMutate: ({ pinId, ...patch }) => {
      queryClient.setQueryData<MapView>(key, (current) =>
        current
          ? { ...current, pins: current.pins.map((pin) => (pin.id === pinId ? { ...pin, ...patch } : pin)) }
          : current
      )
    },
    onSuccess: put,
    onError: () => queryClient.invalidateQueries({ queryKey: key })
  })
  const remove = useMutation({
    mutationFn: (pinId: string) => api.call('deleteMapPin', { pinId }),
    onSuccess: ({ id }) =>
      queryClient.setQueryData<MapView>(key, (current) =>
        current ? { ...current, pins: current.pins.filter((pin) => pin.id !== id) } : current
      )
  })
  return { create, update, remove }
}

type Gesture = { startX: number; startY: number; view: View; travel: number; pinch: number | null }
type PinDrag = { id: string; startX: number; startY: number; x0: number; y0: number; travel: number }

/** El visor: el escenario (imagen y pines) que se mueve y se acerca, sus herramientas y el panel del pin elegido */
function MapViewer({ page, tab, map }: { page: Page; tab: PageTabView; map: MapView }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const readAs = useReadAs()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const image = map.image as NonNullable<MapView['image']>
  const container = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const view = useRef<View>({ x: 0, y: 0, k: 1 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const pinDrag = useRef<PinDrag | null>(null)
  const dragged = useRef(false)
  const [tool, setTool] = useState<'select' | 'pin'>('select')
  const [selected, setSelected] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ sx: number; sy: number; x: number; y: number } | null>(null)
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null)
  const [newPage, setNewPage] = useState<string | null>(null)
  const [changingImage, setChangingImage] = useState(false)
  const pins = usePins(page, map)
  const editable = !page.locked

  // Mientras se mueve, el escenario va en su capa (fluido); al parar, se suelta para que el navegador lo vuelva a
  // dibujar a la escala de ahora y los pines y la imagen no se vean borrosos
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(settle.current ?? undefined), [])
  const apply = useCallback(() => {
    const element = stage.current
    if (!element) return
    const { x, y, k } = view.current
    element.style.willChange = 'transform'
    element.style.transform = `translate(${x}px, ${y}px) scale(${k})`
    element.style.setProperty('--inv-k', String(1 / k))
    clearTimeout(settle.current ?? undefined)
    settle.current = setTimeout(() => {
      element.style.willChange = 'auto'
    }, 200)
  }, [])

  const fit = useCallback(() => {
    const element = container.current
    if (!element) return
    const width = element.clientWidth
    const height = element.clientHeight
    const k = clampScale(Math.min(width / image.width, height / image.height, 1))
    view.current = { k, x: (width - image.width * k) / 2, y: (height - image.height * k) / 2 }
    apply()
  }, [apply, image.width, image.height])

  useLayoutEffect(() => fit(), [fit])

  const zoomCenter = (factor: number) => {
    const element = container.current
    if (!element) return
    view.current = zoomedAt(view.current, factor, element.clientWidth / 2, element.clientHeight / 2)
    apply()
  }

  // La rueda acerca hacia el cursor: escucha nativa (no pasiva, para que la página no se desplace), un paso por fotograma
  useEffect(() => {
    const element = container.current
    if (!element) return
    let frame = 0
    let delta = 0
    let point = { x: 0, y: 0 }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      delta += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        view.current = zoomedAt(view.current, Math.exp(-delta * 0.0015), point.x, point.y)
        delta = 0
        apply()
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame)
    }
  }, [apply])

  /** De un punto de la pantalla a coordenadas del mapa (de 0 a 1) */
  const toMap = (clientX: number, clientY: number) => {
    const rect = container.current?.getBoundingClientRect()
    const { x, y, k } = view.current
    return {
      x: clamp01((clientX - (rect?.left ?? 0) - x) / (k * image.width)),
      y: clamp01((clientY - (rect?.top ?? 0) - y) / (k * image.height))
    }
  }

  const placePin = (point: { x: number; y: number }, withPage = false) => {
    pins.create.mutate(point, {
      onSuccess: (pin) => {
        setSelected(pin.id)
        setNewPage(withPage ? pin.id : null)
      }
    })
    setTool('select')
  }

  // El fondo: arrastrar mueve el mapa; dos dedos lo acercan; pulsar sin moverse pone un pin (con «Poner un pin») o
  // suelta el elegido
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    setMenu(null)
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1) {
      gesture.current = { startX: event.clientX, startY: event.clientY, view: view.current, travel: 0, pinch: null }
    } else if (gesture.current) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.travel = Number.POSITIVE_INFINITY
      gesture.current.pinch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const current = gesture.current
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b || current.pinch === null) return
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = event.currentTarget.getBoundingClientRect()
      view.current = zoomedAt(
        view.current,
        distance / current.pinch,
        (a.x + b.x) / 2 - rect.left,
        (a.y + b.y) / 2 - rect.top
      )
      current.pinch = distance
      apply()
      return
    }
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    current.travel = Math.max(current.travel, Math.hypot(dx, dy))
    view.current = { ...current.view, x: current.view.x + dx, y: current.view.y + dy }
    apply()
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    const current = gesture.current
    if (pointers.current.size > 0 || !current) return
    gesture.current = null
    if (current.travel > 4 || event.type === 'pointercancel') return
    if (tool === 'pin' && editable) placePin(toMap(event.clientX, event.clientY))
    else setSelected(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const step = 80
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step]
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      view.current = { ...view.current, x: view.current.x + move[0], y: view.current.y + move[1] }
      apply()
    } else if (event.key === '+' || event.key === '=') zoomCenter(1.25)
    else if (event.key === '-') zoomCenter(0.8)
    else if (event.key === '0') fit()
    else if (event.key === 'Escape') {
      setTool('select')
      setMenu(null)
    }
  }

  // Un pin: arrastrarlo lo mueve (si no está bloqueado); pulsarlo lo elige; doble clic abre su página
  const onPinPointerDown = (event: PointerEvent<HTMLButtonElement>, pin: MapPinView) => {
    event.stopPropagation()
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragged.current = false
    if (!editable || pin.locked) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pinDrag.current = { id: pin.id, startX: event.clientX, startY: event.clientY, x0: pin.x, y0: pin.y, travel: 0 }
  }

  const onPinPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pinDrag.current
    if (!drag) return
    event.stopPropagation()
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    drag.travel = Math.max(drag.travel, Math.hypot(dx, dy))
    if (drag.travel < 4) return
    const { k } = view.current
    setMoving({
      id: drag.id,
      x: clamp01(drag.x0 + dx / (k * image.width)),
      y: clamp01(drag.y0 + dy / (k * image.height))
    })
  }

  const onPinPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = pinDrag.current
    pinDrag.current = null
    if (!drag) return
    event.stopPropagation()
    if (drag.travel < 4 || !moving) return
    dragged.current = true
    const { id, x, y } = moving
    pins.update.mutate({ pinId: id, x, y }, { onSettled: () => setMoving(null) })
  }

  const shown = map.pins.map((pin) => (moving?.id === pin.id ? { ...pin, x: moving.x, y: moving.y } : pin))
  const current = shown.find((pin) => pin.id === selected) ?? null
  const error = pins.create.error ?? pins.update.error ?? pins.remove.error

  return (
    <div className={styles.wrapper}>
      {/* Un control propio: se mueve con las flechas y se acerca con + y - */}
      <div
        ref={container}
        className={styles.viewer}
        data-tool={tool}
        role="application"
        aria-roledescription={t('map.roleDescription')}
        aria-label={t('map.label', { name: tab.name })}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: es un control propio (role application), no un contenedor
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          event.preventDefault()
          if (!editable) return
          const rect = event.currentTarget.getBoundingClientRect()
          setMenu({
            sx: event.clientX - rect.left,
            sy: event.clientY - rect.top,
            ...toMap(event.clientX, event.clientY)
          })
        }}
      >
        <div ref={stage} className={styles.stage} style={{ inlineSize: image.width, blockSize: image.height }}>
          <img src={image.url} alt="" width={image.width} height={image.height} draggable={false} />
          <ul className={styles.pins} aria-label={t('map.pins')}>
            {shown.map((pin, index) => {
              const name = pin.label ?? pin.pageTitle ?? t('map.untitledPin')
              return (
                <li key={pin.id}>
                  <button
                    type="button"
                    className={styles.pin}
                    data-hidden={pin.hidden || undefined}
                    data-tour={index === 0 ? 'mapa-pin' : undefined}
                    data-anchor={tipAnchored(pin) ? 'tip' : 'center'}
                    data-display={pin.display}
                    data-variant={pin.variant}
                    aria-pressed={pin.id === selected}
                    aria-label={name}
                    style={{ insetInlineStart: `${pin.x * 100}%`, insetBlockStart: `${pin.y * 100}%` }}
                    onPointerDown={(event) => onPinPointerDown(event, pin)}
                    onPointerMove={onPinPointerMove}
                    onPointerUp={onPinPointerUp}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (dragged.current) {
                        dragged.current = false
                        return
                      }
                      setMenu(null)
                      setSelected(pin.id)
                    }}
                    onDoubleClick={() => {
                      if (!pin.pageId || !pin.pageTitle) return
                      if (readAs)
                        void navigate({
                          to: '/mundos/$worldId/campanas/$campaignId/paginas/$pageId',
                          params: { worldId: page.worldId, campaignId: readAs.campaignId, pageId: pin.pageId },
                          search: readAs.asCharacterId ? { como: readAs.asCharacterId } : {}
                        })
                      else
                        void navigate({
                          to: '/mundos/$worldId/wiki/$pageId',
                          params: { worldId: page.worldId, pageId: pin.pageId }
                        })
                    }}
                  >
                    {pin.variant === 2 ? (
                      <span className={styles.iconOnly} aria-hidden="true">
                        {pin.icon ?? '•'}
                      </span>
                    ) : (
                      <PinShape
                        shape={pin.shape}
                        color={pin.color}
                        icon={pin.icon}
                        size={pin.variant === 1 ? 24 : 36}
                      />
                    )}
                    <span className={styles.pinLabel} aria-hidden="true">
                      {name}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        {menu && (
          <div
            role="menu"
            aria-label={t('map.contextMenu')}
            className={styles.contextMenu}
            style={{ insetInlineStart: menu.sx, insetBlockStart: menu.sy }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null)
                placePin(menu)
              }}
            >
              {t('map.pinHere')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(null)
                placePin(menu, true)
              }}
            >
              {t('map.pinWithPage')}
            </button>
          </div>
        )}
      </div>

      <div className={styles.toolbar} role="toolbar" aria-label={t('map.tools')} data-tour="mapa-herramientas">
        {editable && (
          <button
            type="button"
            aria-pressed={tool === 'pin'}
            aria-label={t('map.addPin')}
            title={t('map.addPin')}
            onClick={() => setTool(tool === 'pin' ? 'select' : 'pin')}
          >
            <MapPin aria-hidden="true" size={18} />
          </button>
        )}
        <button type="button" aria-label={t('map.zoomIn')} title={t('map.zoomIn')} onClick={() => zoomCenter(1.25)}>
          <Plus aria-hidden="true" size={18} />
        </button>
        <button type="button" aria-label={t('map.zoomOut')} title={t('map.zoomOut')} onClick={() => zoomCenter(0.8)}>
          <Minus aria-hidden="true" size={18} />
        </button>
        <button type="button" aria-label={t('map.fit')} title={t('map.fit')} onClick={fit}>
          <Maximize aria-hidden="true" size={18} />
        </button>
        {editable && (
          <button
            type="button"
            aria-label={t('map.changeImage')}
            title={t('map.changeImage')}
            aria-expanded={changingImage}
            onClick={() => setChangingImage(!changingImage)}
          >
            <ImageIcon aria-hidden="true" size={18} />
          </button>
        )}
      </div>

      {/* Fuera de la barra: sus botones no son de herramientas */}
      <Tour
        id="mapa"
        steps={[
          { target: '[data-tour="mapa-pestanas"]', text: t('tour.map.tabs') },
          { target: '[data-tour="mapa-herramientas"]', text: t('tour.map.tools'), placement: 'right' },
          { target: '[data-tour="mapa-pin"]', text: t('tour.map.pin') }
        ]}
      />

      {changingImage && (
        <div className={styles.imagePanel}>
          <ImageChooser page={page} map={map} onDone={() => setChangingImage(false)} />
        </div>
      )}

      {tool === 'pin' && (
        <p className={styles.hint} role="status">
          {t('map.addPinHint')}
        </p>
      )}

      {current && (
        <PinPanel
          key={current.id}
          page={page}
          pin={current}
          editable={editable}
          naming={newPage === current.id}
          onNamed={() => setNewPage(null)}
          onChange={(patch) => pins.update.mutateAsync({ pinId: current.id, ...patch })}
          onDelete={() =>
            pins.remove.mutate(current.id, {
              onSuccess: () => {
                setSelected(null)
                announce(t('map.pin.deleted'))
                container.current?.focus()
              }
            })
          }
          onClose={() => {
            setSelected(null)
            container.current?.focus()
          }}
        />
      )}
      <FormError message={error ? errorText(error) : null} />
    </div>
  )
}
