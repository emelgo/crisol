/**
 * La pestaña de mapa de una página (ADR-0007): su imagen, que se mueve y se acerca, con pines que llevan a páginas. El
 * visor es el de Everlore rehecho sobre lo nuestro: durante el gesto el escenario se mueve con `transform` directamente
 * en el DOM (sin pintar React), la rueda acerca hacia el cursor y los pines guardan su tamaño con --inv-k
 */
import type { MapElementView, MapGeometry, MapPinView, MapView, Page, PageTabView } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Expand,
  ImageIcon,
  Layers,
  MapPin,
  Maximize,
  Minus,
  Pentagon,
  Plus,
  Ruler,
  Settings2,
  Shrink,
  Spline,
  Type
} from 'lucide-react'
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '../../api/client.ts'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { Loading } from '../../components/brand.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import { FormError } from '../../components/field.tsx'
import { canvasKeyTarget } from '../../components/focus.ts'
import list from '../../components/list.module.css'
import { failed, LoadError } from '../../components/load-error.tsx'
import { Tour } from '../../components/tour.tsx'
import { useWorldFiles } from '../cover-look.ts'
import { readAsInput, readAsKey, useReadAs } from '../read-as.tsx'
import { tabRegionLabel } from '../tabs/kinds.tsx'
import { useWorldPage } from '../world-page.ts'
import { MapDrawing } from './drawing.tsx'
import {
  insertedVertex,
  moved,
  type Point,
  snapped,
  snapTargets,
  type VertexRef,
  withoutVertex,
  withVertex
} from './edit.ts'
import { type Draft, DraftLayer, EditHandles } from './editing.tsx'
import { ElementPanel } from './element-panel.tsx'
import { mapKey } from './keys.ts'
import { LayersPanel, useHiddenHere } from './layers-panel.tsx'
import styles from './map.module.css'
import { MapSettings } from './map-settings.tsx'
import { distanceOf, roundDistance, scaleBar } from './measure.ts'
import { MeasurePanel } from './measure-panel.tsx'
import { PinPanel } from './pin-panel.tsx'
import { PinShape, tipAnchored } from './pin-shape.tsx'
import { useElements } from './use-elements.ts'

export { mapKey } from './keys.ts'

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
      <section className={styles.empty} aria-label={tabRegionLabel(t, 'map', tab.name)}>
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
type Tool = 'select' | 'pin' | 'region' | 'path' | 'text' | 'measure' | 'calibrate'
/** Las teclas de las herramientas (con el visor enfocado); medir, también para quien solo lee */
const TOOL_KEYS: Record<string, Tool> = { v: 'select', p: 'pin', r: 'region', l: 'path', t: 'text', m: 'measure' }
const DRAWING_TOOLS: readonly Tool[] = ['region', 'path', 'text']
const samePoint = (a: Point | undefined, b: Point | undefined) =>
  !!a && !!b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6
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
  const [tool, setTool] = useState<Tool>('select')
  // El aro del foco, solo si se llegó con el tabulador (al pulsar una tecla con el ratón en el mapa no se pinta)
  const [tabbed, setTabbed] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  // Lo dibujado elegido, lo que se está dibujando (con la goma hasta el cursor) y lo que se está retocando
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [namingElement, setNamingElement] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [live, setLive] = useState<{ id: string; geometry: MapGeometry } | null>(null)
  const liveRef = useRef(live)
  liveRef.current = live
  const lastTravel = useRef(0)
  const cursorFrame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(cursorFrame.current), [])
  // El arrastre en curso (para soltarlo si el visor se va)
  const endDrag = useRef<(() => void) | null>(null)
  useEffect(() => () => endDrag.current?.(), [])
  // Medir: los puntos y, si se mide a lo largo de una ruta, su nombre; calibrar: la raya y lo que se dibuja de ella
  const [measure, setMeasure] = useState<{ points: Point[]; route: string | null }>({ points: [], route: null })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [calibration, setCalibration] = useState<Point[]>([])
  const [line, setLine] = useState<[Point, Point] | null>(null)
  useEffect(() => {
    if (measure.points.length < 2 || !map.scale) return
    const distance = distanceOf(measure.points, image, map.scale)
    if (distance !== null)
      announce(t('map.measure.said', { distance: roundDistance(distance).toLocaleString('es'), unit: map.scale.unit }))
  }, [measure.points, map.scale, image, announce, t])
  // Lo dibujado bajo el puntero al pulsar: el visor captura el puntero (para arrastrar el mapa) y el clic le llega a él
  const pressedOn = useRef<string | null>(null)
  const [menu, setMenu] = useState<{ sx: number; sy: number; x: number; y: number } | null>(null)
  const [moving, setMoving] = useState<{ id: string; x: number; y: number } | null>(null)
  const [newPage, setNewPage] = useState<string | null>(null)
  const [changingImage, setChangingImage] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  // Ampliado: el mapa ocupa todo lo de al lado de la barra (para dibujar con sitio)
  const [wide, setWide] = useState(false)
  // Los botones que abren los paneles: al cerrarlos, el foco vuelve a ellos
  const layersButton = useRef<HTMLButtonElement>(null)
  // Dónde empieza el visor en la página: su alto llega justo al final de la ventana (la portada, el título y las
  // pestañas lo empujan hacia abajo)
  const wrapper = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = wrapper.current
    if (!element || wide) return
    const place = () => {
      const top = element.getBoundingClientRect().top + window.scrollY
      element.style.setProperty('--map-top', `${Math.max(0, top)}px`)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [wide])
  const settingsButton = useRef<HTMLButtonElement>(null)
  // En la página del mundo (Enrique, 2026-11-16): el mapa a sangre y sus herramientas en una píldora abajo en
  // el centro, el zoom abajo a la derecha y la escala abajo a la izquierda, pegados a lo que se ve
  const docked = Boolean(useWorldPage())
  const scaleRef = useRef<HTMLDivElement>(null)
  const scaleOf = useRef(map.scale)
  const hiddenHere = useHiddenHere(map.id)
  const drawingId = useId()
  // Las capas solo del máster: lo suyo se le ve más apagado (no lo ven los jugadores)
  const secretLayers = useMemo(
    () => new Set(map.layers.filter((layer) => layer.hidden).map((layer) => layer.id)),
    [map.layers]
  )
  const pins = usePins(page, map)
  const elements = useElements(page, map)
  const editable = !page.locked

  /** Abrir la página de un pin o de algo dibujado (como jugador, la de su campaña) */
  const openPage = useCallback(
    (pageId: string) => {
      if (readAs)
        void navigate({
          to: '/mundos/$worldId/campanas/$campaignId/paginas/$pageId',
          params: { worldId: page.worldId, campaignId: readAs.campaignId, pageId },
          search: readAs.asCharacterId ? { como: readAs.asCharacterId } : {}
        })
      else void navigate({ to: '/mundos/$worldId/wiki/$pageId', params: { worldId: page.worldId, pageId } })
    },
    [navigate, readAs, page.worldId]
  )

  // Mientras se mueve, el escenario va en su capa (fluido); al parar, se suelta para que el navegador lo vuelva a
  // dibujar a la escala de ahora y los pines y la imagen no se vean borrosos
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(settle.current ?? undefined), [])
  // La barra de escala, a la de ahora (sin pintar React: va con cada paso del gesto)
  const showScale = useCallback(() => {
    const bar = scaleRef.current
    const scale = scaleOf.current
    if (!bar) return
    const shown = scale ? scaleBar((view.current.k * scale.length) / scale.value) : null
    bar.hidden = !shown
    if (!shown || !scale) return
    bar.style.setProperty('--scale-width', `${shown.width}px`)
    const label = bar.querySelector('span')
    if (label) label.textContent = `${shown.units.toLocaleString('es')} ${scale.unit}`
  }, [])
  const apply = useCallback(() => {
    const element = stage.current
    if (!element) return
    const { x, y, k } = view.current
    element.style.willChange = 'transform'
    element.style.transform = `translate(${x}px, ${y}px) scale(${k})`
    element.style.setProperty('--inv-k', String(1 / k))
    showScale()
    clearTimeout(settle.current ?? undefined)
    settle.current = setTimeout(() => {
      element.style.willChange = 'auto'
    }, 200)
  }, [showScale])
  // Si cambia la escala del mapa (al calibrarla), la barra, al día
  useEffect(() => {
    scaleOf.current = map.scale
    showScale()
  }, [showScale, map.scale])

  const fit = useCallback(() => {
    const element = container.current
    if (!element) return
    const width = element.clientWidth
    const height = element.clientHeight
    const k = clampScale(Math.min(width / image.width, height / image.height, 1))
    view.current = { k, x: (width - image.width * k) / 2, y: (height - image.height * k) / 2 }
    apply()
  }, [apply, image.width, image.height])

  // Al encuadrar y al ampliarlo o reducirlo (cambia su tamaño)
  useLayoutEffect(() => fit(), [fit, wide])
  // Ampliado, lo de detrás (la página) no se alcanza con el tabulador ni con el lector de pantalla
  useEffect(() => {
    const root = document.getElementById('root')
    if (!wide || !root) return
    root.setAttribute('inert', '')
    return () => root.removeAttribute('inert')
  }, [wide])

  // Si el visor cambia de tamaño (la ventana, el móvil al girar), se vuelve a encuadrar
  useEffect(() => {
    const element = container.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let size = { width: element.clientWidth, height: element.clientHeight }
    const observer = new ResizeObserver(() => {
      const next = { width: element.clientWidth, height: element.clientHeight }
      if (next.width === size.width && next.height === size.height) return
      size = next
      fit()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [fit, wide])

  // Al ampliarlo o reducirlo, el visor es otro elemento (va o vuelve del cuerpo de la página): el foco, a él
  const wideBefore = useRef(wide)
  useEffect(() => {
    if (wideBefore.current !== wide) container.current?.focus()
    wideBefore.current = wide
  }, [wide])

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
  }, [apply, wide])

  /** De un punto de la pantalla a coordenadas del mapa (de 0 a 1) */
  const toMap = (clientX: number, clientY: number) => {
    const rect = container.current?.getBoundingClientRect()
    const { x, y, k } = view.current
    return {
      x: clamp01((clientX - (rect?.left ?? 0) - x) / (k * image.width)),
      y: clamp01((clientY - (rect?.top ?? 0) - y) / (k * image.height))
    }
  }

  /** Un punto de la pantalla en el mapa, pegado a los vértices y pines cercanos (menos los de lo que se retoca) */
  // Los puntos a los que se pega, una vez por cada cosa que se retoca (no en cada movimiento)
  const targets = useMemo(() => new Map<string | null, Point[]>(), [map.elements, map.pins])
  const snappedAt = (clientX: number, clientY: number, except: string | null = null): Point => {
    const { x, y } = toMap(clientX, clientY)
    let list = targets.get(except)
    if (!list) {
      list = snapTargets(map.elements, map.pins, except)
      targets.set(except, list)
    }
    return snapped([x, y], list, image, view.current.k).point
  }

  /** El pin que hay justo en un punto (para que una ruta empiece o acabe en él) */
  const pinAt = (point: Point | undefined) =>
    point ? (map.pins.find((pin) => samePoint([pin.x, pin.y], point))?.id ?? null) : null

  const chooseTool = (next: Tool) => {
    // La ayuda de la herramienta, una vez (un aviso que aparece ya con su texto no se lee)
    if (next !== tool && (next === 'region' || next === 'path' || next === 'text'))
      announce(t(`map.edit.hints.${next}`))
    if (next !== tool && next === 'measure') announce(t('map.measure.hint'))
    if (next !== tool && next === 'calibrate') announce(t('map.settings.drawHint'))
    setTool(next)
    setDraft(null)
    setCursor(null)
    if (next !== 'measure') setMeasure({ points: [], route: null })
    if (next !== 'calibrate') setCalibration([])
    if (next !== 'select') {
      setSelected(null)
      setSelectedElement(null)
      // Para dibujar, todo el mapa a la vista
      if (next !== 'pin') setLayersOpen(false)
    }
  }

  // Lo que llega de fuera (lo dibuja la IA u otro máster) entra forjándose; lo que dibuja uno mismo, no
  const seenIds = useRef<Set<string> | null>(null)
  const mine = useRef(new Set<string>())
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    const ids = new Set(map.elements.map((element) => element.id))
    const before = seenIds.current
    seenIds.current = ids
    if (!before) return
    const arrived = [...ids].filter((id) => !before.has(id) && !mine.current.has(id))
    if (arrived.length === 0) return
    setFresh(new Set(arrived))
    const done = setTimeout(() => setFresh(new Set()), 1800)
    return () => clearTimeout(done)
  }, [map.elements])

  const created = (element: MapElementView) => {
    mine.current.add(element.id)
    setSelectedElement(element.id)
    setNamingElement(element.id)
    setSelected(null)
    setLayersOpen(false)
  }

  /** Acabar lo que se dibuja: una región necesita tres puntos; una ruta, dos */
  const finishDraft = () => {
    if (!draft) return
    const points = draft.points.filter((point, index, all) => !samePoint(point, all[index - 1]))
    const enough = draft.kind === 'region' ? points.length >= 3 : points.length >= 2
    setDraft(null)
    setCursor(null)
    setTool('select')
    if (!enough) return
    const geometry: MapGeometry =
      draft.kind === 'region' ? { pieces: [points] } : { points, from: pinAt(points[0]), to: pinAt(points.at(-1)) }
    elements.create.mutate({ kind: draft.kind, geometry }, { onSuccess: created })
  }

  const addDraftPoint = (point: Point) => {
    const kind = tool === 'path' ? 'path' : 'region'
    const points = draft?.points ?? []
    // Pulsar el primero de una región la cierra; un doble clic no pone dos puntos
    if (kind === 'region' && points.length >= 3 && samePoint(point, points[0])) return finishDraft()
    if (samePoint(point, points.at(-1))) return
    setDraft({ kind, points: [...points, point] })
  }

  const placeText = (point: Point) => {
    setTool('select')
    elements.create.mutate(
      { kind: 'label', geometry: { at: point }, label: t('map.edit.newText') },
      { onSuccess: created }
    )
  }

  /** Arrastrar algo (un vértice, lo elegido): se sigue en la ventana hasta soltar; dice si se movió */
  const drag = (
    event: PointerEvent<Element>,
    onMove: (clientX: number, clientY: number, dx: number, dy: number) => void,
    onEnd: (movedIt: boolean) => void
  ) => {
    event.stopPropagation()
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    let travel = 0
    const move = (e: globalThis.PointerEvent) => {
      travel = Math.max(travel, Math.hypot(e.clientX - startX, e.clientY - startY))
      if (travel > 3) onMove(e.clientX, e.clientY, e.clientX - startX, e.clientY - startY)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
      endDrag.current = null
      onEnd(travel > 3)
    }
    endDrag.current?.()
    endDrag.current = end
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
  }

  /** Guardar la forma retocada (si la hay) y dejar de enseñarla en vivo */
  const commitLive = () => {
    const current = liveRef.current
    setLive(null)
    if (current) elements.update.mutate({ id: current.id, patch: { geometry: current.geometry } })
  }

  const dragVertex = (
    event: PointerEvent<Element>,
    element: MapElementView,
    base: MapGeometry,
    ref: VertexRef,
    always: boolean
  ) => {
    setLive({ id: element.id, geometry: base })
    drag(
      event,
      (clientX, clientY) =>
        setLive({ id: element.id, geometry: withVertex(base, ref, snappedAt(clientX, clientY, element.id)) }),
      (movedIt) => (movedIt || always ? commitLive() : setLive(null))
    )
  }

  const onElementPointerDownNow = (event: PointerEvent<SVGGElement>, element: MapElementView) => {
    if (tool !== 'select' || !editable || element.id !== selectedElement) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Lo elegido se arrastra entero
    const original = element.geometry
    const { k } = view.current
    drag(
      event,
      (_x, _y, dx, dy) =>
        setLive({ id: element.id, geometry: moved(original, dx / (k * image.width), dy / (k * image.height)) }),
      (movedIt) => (movedIt ? commitLive() : setLive(null))
    )
  }

  const onElementClickNow = (event: React.MouseEvent<SVGGElement>, element: MapElementView) => {
    if (tool !== 'select' || lastTravel.current > 4) return
    event.stopPropagation()
    setSelectedElement(element.id)
    setSelected(null)
    setLayersOpen(false)
  }

  // Siempre la misma función (lo dibujado no se vuelve a pintar entero en cada movimiento); hacen lo de ahora
  const latest = useRef({ down: onElementPointerDownNow, click: onElementClickNow })
  latest.current.down = onElementPointerDownNow
  latest.current.click = onElementClickNow
  const onElementPointerDown = useCallback(
    (event: PointerEvent<SVGGElement>, element: MapElementView) => latest.current.down(event, element),
    []
  )
  const onElementClick = useCallback(
    (event: React.MouseEvent<SVGGElement>, element: MapElementView) => latest.current.click(event, element),
    []
  )

  const removeElement = (element: MapElementView) =>
    elements.remove.mutate(element, {
      onSuccess: () => {
        setSelectedElement(null)
        announce(t('map.element.deleted'))
        container.current?.focus()
      }
    })

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
    pressedOn.current = (event.target as Element).closest?.('[data-id]')?.getAttribute('data-id') ?? null
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
    // Dibujando, midiendo o calibrando: la goma sigue al cursor (pegada a lo cercano)
    const following =
      draft ||
      (tool === 'measure' && measure.points.length > 0 && !measure.route) ||
      (tool === 'calibrate' && calibration.length === 1)
    if (following && pointers.current.size === 0) {
      const { clientX, clientY } = event
      cancelAnimationFrame(cursorFrame.current)
      cursorFrame.current = requestAnimationFrame(() => setCursor(snappedAt(clientX, clientY)))
    }
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
    lastTravel.current = current.travel
    if (current.travel > 4 || event.type === 'pointercancel') return
    if (tool === 'measure') {
      // Pulsar una ruta sin haber empezado: medirla entera; si no, un punto más (pegado a pines y vértices)
      const route = map.elements.find((element) => element.id === pressedOn.current && element.kind === 'path')
      if (route && 'points' in route.geometry && (measure.points.length === 0 || measure.route)) {
        const points = route.geometry.points.map((p) => [p[0], p[1]] as Point)
        setMeasure({ points, route: route.label ?? route.pageTitle ?? '' })
      } else {
        const point = snappedAt(event.clientX, event.clientY)
        setMeasure((now) => ({ points: now.route ? [point] : [...now.points, point], route: null }))
      }
      return
    }
    if (tool === 'calibrate') {
      const point = snappedAt(event.clientX, event.clientY)
      const [first] = calibration
      if (!first) return setCalibration([point])
      setLine([first, point])
      setCalibration([])
      setCursor(null)
      setTool('select')
      return
    }
    if (tool === 'pin' && editable) placePin(toMap(event.clientX, event.clientY))
    else if ((tool === 'region' || tool === 'path') && editable) addDraftPoint(snappedAt(event.clientX, event.clientY))
    else if (tool === 'text' && editable) {
      const { x, y } = toMap(event.clientX, event.clientY)
      placeText([x, y])
    } else if (tool === 'select' && pressedOn.current) {
      // Pulsar lo dibujado lo elige
      setSelectedElement(pressedOn.current)
      setSelected(null)
      setLayersOpen(false)
    } else {
      setSelected(null)
      setSelectedElement(null)
    }
  }

  // El menú del botón derecho (también con la tecla de menú o Mayús+F10): al abrirse, el foco en su primera opción
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (menu) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [menu])
  const closeMenu = () => {
    setMenu(null)
    container.current?.focus()
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    } else if (event.key === 'Tab') closeMenu()
  }

  /** Supr: borra lo elegido (lo dibujado o un pin); si no hay nada, false */
  const removeSelected = () => {
    if (!editable) return false
    const element = map.elements.find((e) => e.id === selectedElement)
    if (element) {
      removeElement(element)
      return true
    }
    const pin = map.pins.find((p) => p.id === selected)
    if (!pin || pin.locked) return false
    pins.remove.mutate(pin.id, {
      onSuccess: () => {
        setSelected(null)
        announce(t('map.pin.deleted'))
        container.current?.focus()
      }
    })
    return true
  }

  /** Escape, de dentro afuera: lo que se mide, lo que se dibuja, lo elegido y, sin nada más, el mapa ampliado */
  const stepBack = () => {
    if (tool === 'measure' && measure.points.length > 0) {
      setMeasure({ points: [], route: null })
      setCursor(null)
      return
    }
    if (!draft && tool === 'select' && !selectedElement && !selected && wide) setWide(false)
    if (!draft && tool === 'select') {
      setSelectedElement(null)
      setSelected(null)
    }
    chooseTool('select')
    setMenu(null)
  }

  // Supr y Escape valen con el foco en cualquier sitio del mapa (sus botones, un pin) o fuera de todo, no solo en el
  // mapa (Enrique, 2026-11-13: «si pulso Supr debería borrar lo que tengo seleccionado, y si pulso Esc en cualquier
  // momento quitar la herramienta»); no mientras se escribe ni en una ventana o un menú
  const globalKeys = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined)
  globalKeys.current = (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key !== 'Escape' && event.key !== 'Delete' && event.key !== 'Backspace') return
    if (event.target === container.current) return
    // También con el foco en una casilla o un color del panel, o en la cabecera de la página (no donde se escribe)
    const root = container.current?.closest('[data-page-column]') ?? container.current?.parentElement
    if (!canvasKeyTarget(event.target, root)) return
    if (event.key !== 'Escape') {
      if (removeSelected()) event.preventDefault()
      return
    }
    stepBack()
  }
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => globalKeys.current(event)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    // Dibujar: Intro acaba, Retroceso quita el último punto (también Ctrl+Z), Escape lo deja
    if (draft && event.key === 'Enter') {
      event.preventDefault()
      return finishDraft()
    }
    if (draft && (event.key === 'Backspace' || ((event.ctrlKey || event.metaKey) && event.key === 'z'))) {
      event.preventDefault()
      return setDraft(draft.points.length > 1 ? { ...draft, points: draft.points.slice(0, -1) } : null)
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && editable) {
      event.preventDefault()
      void elements
        .undo()
        .then((undone) => announce(t(undone ? 'map.edit.undone' : 'map.edit.nothingToUndo')))
        .catch((error: unknown) => announce(errorText(error)))
      return
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && removeSelected()) {
      event.preventDefault()
      return
    }
    const toolKey = TOOL_KEYS[event.key.toLowerCase()]
    if (toolKey && (editable || toolKey === 'measure') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      return chooseTool(toolKey)
    }
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
    else if (event.key === 'Escape') stepBack()
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
  const currentElement = map.elements.find((element) => element.id === selectedElement) ?? null
  // Lo medido hasta el cursor: la cifra, junto al extremo
  const measured = measure.route || !cursor ? measure.points : [...measure.points, cursor]
  const measureEnd = measured.length >= 2 ? measured.at(-1) : undefined
  const measureDistance = measured.length >= 2 ? distanceOf(measured, image, map.scale) : null
  const measureText =
    measureDistance === null ? null : `${roundDistance(measureDistance).toLocaleString('es')} ${map.scale?.unit ?? ''}`
  const error =
    pins.create.error ??
    pins.update.error ??
    pins.remove.error ??
    elements.create.error ??
    elements.update.error ??
    elements.remove.error

  // Las herramientas: dibujar, capas y medir; acercar y encuadrar; los ajustes y la imagen
  const drawing = (
    <>
      {editable && (
        <button
          type="button"
          aria-pressed={tool === 'pin'}
          aria-label={t('map.addPin')}
          aria-keyshortcuts="P"
          title={`${t('map.addPin')} (P)`}
          onClick={() => chooseTool(tool === 'pin' ? 'select' : 'pin')}
        >
          <MapPin aria-hidden="true" size={18} />
        </button>
      )}
      {editable &&
        (
          [
            ['region', Pentagon],
            ['path', Spline],
            ['text', Type]
          ] as const
        ).map(([name, Icon]) => (
          <button
            key={name}
            type="button"
            aria-pressed={tool === name}
            aria-label={t(`map.edit.tools.${name}`)}
            aria-keyshortcuts={name === 'region' ? 'R' : name === 'path' ? 'L' : 'T'}
            title={`${t(`map.edit.tools.${name}`)} (${name === 'region' ? 'R' : name === 'path' ? 'L' : 'T'})`}
            onClick={() => chooseTool(tool === name ? 'select' : name)}
          >
            <Icon aria-hidden="true" size={18} />
          </button>
        ))}
      {editable && <span className={styles.toolSep} aria-hidden="true" />}
      {(editable || map.layers.length > 0) && (
        <button
          type="button"
          ref={layersButton}
          aria-label={t('map.layers.title')}
          title={t('map.layers.title')}
          aria-expanded={layersOpen && !current && !currentElement && !settingsOpen}
          onClick={() => {
            const open = layersOpen && !current && !currentElement && !settingsOpen
            setLayersOpen(!open)
            setSettingsOpen(false)
            setSelected(null)
            setSelectedElement(null)
          }}
        >
          <Layers aria-hidden="true" size={18} />
        </button>
      )}
      <button
        type="button"
        aria-pressed={tool === 'measure'}
        aria-label={t('map.measure.tool')}
        aria-keyshortcuts="M"
        title={`${t('map.measure.tool')} (M)`}
        onClick={() => chooseTool(tool === 'measure' ? 'select' : 'measure')}
      >
        <Ruler aria-hidden="true" size={18} />
      </button>
    </>
  )
  const zooming = (
    <>
      <button type="button" aria-label={t('map.zoomIn')} title={t('map.zoomIn')} onClick={() => zoomCenter(1.25)}>
        <Plus aria-hidden="true" size={18} />
      </button>
      <button type="button" aria-label={t('map.zoomOut')} title={t('map.zoomOut')} onClick={() => zoomCenter(0.8)}>
        <Minus aria-hidden="true" size={18} />
      </button>
      <button type="button" aria-label={t('map.fit')} title={t('map.fit')} onClick={fit}>
        <Maximize aria-hidden="true" size={18} />
      </button>
      <button
        type="button"
        aria-pressed={wide}
        aria-label={t(wide ? 'map.shrink' : 'map.expand')}
        title={t(wide ? 'map.shrink' : 'map.expand')}
        onClick={() => setWide(!wide)}
      >
        {wide ? <Shrink aria-hidden="true" size={18} /> : <Expand aria-hidden="true" size={18} />}
      </button>
    </>
  )
  const setup = (
    <>
      {editable && <span className={styles.toolSep} aria-hidden="true" />}
      {editable && !readAs && (
        <button
          type="button"
          ref={settingsButton}
          aria-label={t('map.settings.title')}
          title={t('map.settings.title')}
          aria-expanded={settingsOpen && !current && !currentElement}
          onClick={() => {
            setSettingsOpen(!settingsOpen)
            setLayersOpen(false)
            setSelected(null)
            setSelectedElement(null)
          }}
        >
          <Settings2 aria-hidden="true" size={18} />
        </button>
      )}
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
    </>
  )
  const toolbar = !docked ? (
    <div className={styles.toolbar} role="toolbar" aria-label={t('map.tools')} data-tour="mapa-herramientas">
      {drawing}
      <span className={styles.toolSep} aria-hidden="true" />
      {zooming}
      {setup}
    </div>
  ) : (
    // Pegadas abajo de lo que se ve aunque el mapa siga más abajo (la columna aún no ha bajado del todo)
    <div className={styles.dock}>
      <div
        className={`${styles.toolbar} ${styles.pill}`}
        role="toolbar"
        aria-label={t('map.tools')}
        data-tour="mapa-herramientas"
      >
        {drawing}
        {setup}
      </div>
      <div className={`${styles.toolbar} ${styles.zoomTools}`} role="toolbar" aria-label={t('map.zoomTools')}>
        {zooming}
      </div>
      <div ref={scaleRef} className={styles.scaleBar} hidden>
        <span />
      </div>
      {changingImage && (
        <div className={`${styles.imagePanel} ${styles.dockPanel}`}>
          <ImageChooser page={page} map={map} onDone={() => setChangingImage(false)} />
        </div>
      )}
    </div>
  )

  // Ampliado, en el cuerpo de la página: por encima de todo lo demás (sus columnas tienen su propio apilamiento)
  const content = (
    <div
      ref={wrapper}
      className={styles.wrapper}
      data-wide={wide || undefined}
      style={{ '--map-aspect': `${image.width} / ${image.height}` } as React.CSSProperties}
    >
      {/* Un control propio: se mueve con las flechas y se acerca con + y - */}
      <div
        ref={container}
        className={styles.viewer}
        data-tool={tool}
        data-tabbed={tabbed || undefined}
        role="application"
        aria-roledescription={t('map.roleDescription')}
        aria-label={tabRegionLabel(t, 'map', tab.name)}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: es un control propio (role application), no un contenedor
        tabIndex={0}
        onPointerDown={(event) => {
          setTabbed(false)
          onPointerDown(event)
        }}
        onKeyUp={(event) => {
          if (event.key === 'Tab' && event.target === event.currentTarget) setTabbed(true)
        }}
        onBlur={() => setTabbed(false)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={() => {
          if (draft) return finishDraft()
          // Doble clic en lo dibujado que lleva a una página: la abre
          const target = map.elements.find((element) => element.id === pressedOn.current)
          if (tool === 'select' && target?.pageId && target.pageTitle) openPage(target.pageId)
        }}
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
          <MapDrawing
            id={drawingId}
            image={image}
            layers={map.layers}
            elements={map.elements}
            hiddenHere={hiddenHere.hidden}
            secretLayers={secretLayers}
            selected={selectedElement}
            fresh={fresh}
            live={live}
            onOpen={openPage}
            onElementPointerDown={onElementPointerDown}
            onElementClick={onElementClick}
          />
          {draft && <DraftLayer image={image} draft={draft} cursor={cursor} />}
          {tool === 'measure' && measure.points.length > 0 && (
            <DraftLayer
              image={image}
              draft={{ kind: 'path', points: measure.points }}
              cursor={measure.route ? null : cursor}
              variant="measure"
            />
          )}
          {tool === 'measure' && map.scale && measureEnd && measureText && (
            <span
              className={styles.measureTag}
              style={{ insetInlineStart: `${measureEnd[0] * 100}%`, insetBlockStart: `${measureEnd[1] * 100}%` }}
              aria-hidden="true"
            >
              {measureText}
            </span>
          )}
          {(calibration.length > 0 || line) && (
            <DraftLayer
              image={image}
              draft={{ kind: 'path', points: line ?? calibration }}
              cursor={line ? null : cursor}
            />
          )}
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
                    onPointerCancel={onPinPointerUp}
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
                      if (pin.pageId && pin.pageTitle) openPage(pin.pageId)
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
          {editable && currentElement && currentElement.kind !== 'label' && (
            <EditHandles
              geometry={live?.id === currentElement.id ? live.geometry : currentElement.geometry}
              onVertexDown={(event, ref) => dragVertex(event, currentElement, currentElement.geometry, ref, false)}
              onMidpointDown={(event, ref, at) =>
                dragVertex(
                  event,
                  currentElement,
                  insertedVertex(currentElement.geometry, ref, at),
                  { ...ref, index: ref.index + 1 },
                  true
                )
              }
              onVertexRemove={(ref) => {
                const next = withoutVertex(currentElement.geometry, ref)
                if (next) elements.update.mutate({ id: currentElement.id, patch: { geometry: next } })
                else announce(t('map.edit.tooFew'))
              }}
            />
          )}
        </div>
        {menu && (
          <div
            ref={menuRef}
            role="menu"
            aria-label={t('map.contextMenu')}
            className={styles.contextMenu}
            style={{ insetInlineStart: menu.sx, insetBlockStart: menu.sy }}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={onMenuKeyDown}
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

      {toolbar}

      {/* Fuera de la barra: sus botones no son de herramientas */}
      {/* Quien solo lo lee (un jugador) ni pone ni mueve pines: su propio tutorial */}
      {readAs || !editable ? (
        <Tour
          id="mapa-lectura"
          steps={[
            { target: '[data-tour="mapa-pestanas"]', text: t('tour.map.tabs') },
            {
              target: '[data-tour="mapa-herramientas"]',
              text: t('tour.map.readTools'),
              placement: docked ? 'top' : 'right'
            },
            { target: '[data-tour="mapa-pin"]', text: t('tour.map.readPin') }
          ]}
        />
      ) : (
        <Tour
          id="mapa"
          steps={[
            { target: '[data-tour="mapa-pestanas"]', text: t('tour.map.tabs') },
            {
              target: '[data-tour="mapa-herramientas"]',
              text: t('tour.map.tools'),
              placement: docked ? 'top' : 'right'
            },
            { target: '[data-tour="mapa-pin"]', text: t('tour.map.pin') }
          ]}
        />
      )}

      {changingImage && !docked && (
        <div className={styles.imagePanel}>
          <ImageChooser page={page} map={map} onDone={() => setChangingImage(false)} />
        </div>
      )}

      {tool === 'pin' && <p className={styles.hint}>{t('map.addPinHint')}</p>}
      {DRAWING_TOOLS.includes(tool) && (
        <p className={styles.hint}>{t(`map.edit.hints.${tool as 'region' | 'path' | 'text'}`)}</p>
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
      {!current && currentElement && (
        <ElementPanel
          key={currentElement.id}
          page={page}
          element={currentElement}
          layers={map.layers}
          editable={editable && !readAs}
          naming={namingElement === currentElement.id}
          onChange={(patch) => elements.update.mutateAsync({ id: currentElement.id, patch })}
          onDelete={() => removeElement(currentElement)}
          onClose={() => {
            setSelectedElement(null)
            container.current?.focus()
          }}
        />
      )}
      {tool === 'measure' && (
        <MeasurePanel
          map={map}
          image={image}
          points={measured}
          route={measure.route}
          canCalibrate={editable && !readAs}
          onClear={() => chooseTool('select')}
          onCalibrate={() => {
            chooseTool('select')
            setSettingsOpen(true)
          }}
        />
      )}
      {!current && !currentElement && settingsOpen && (
        <MapSettings
          page={page}
          map={map}
          image={image}
          line={line}
          drawing={tool === 'calibrate'}
          onDrawLine={() => {
            setLine(null)
            chooseTool('calibrate')
            // El botón se va: el foco, al mapa, donde se dibuja la raya
            container.current?.focus()
          }}
          onLineDone={() => setLine(null)}
          onClose={() => {
            setSettingsOpen(false)
            setLine(null)
            if (tool === 'calibrate') chooseTool('select')
            settingsButton.current?.focus()
          }}
        />
      )}
      {!current && !currentElement && !settingsOpen && layersOpen && (
        <LayersPanel
          page={page}
          map={map}
          editable={editable && !readAs}
          hiddenHere={hiddenHere.hidden}
          onToggleHere={hiddenHere.toggle}
          onSelect={(id) => {
            setSelectedElement(id)
            setSelected(null)
          }}
          onClose={() => {
            setLayersOpen(false)
            layersButton.current?.focus()
          }}
        />
      )}
      <FormError message={error ? errorText(error) : null} />
    </div>
  )
  return wide ? createPortal(content, document.body) : content
}
