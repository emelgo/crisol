/**
 * La pestaña «Escena» de una página (docs/specs/escenas.md): el mapa de la escena, troceado en teselas, con su
 * rejilla; a la derecha, en el sitio del panel de la página, la rejilla y cómo alinearla; debajo, «Abrir en la mesa».
 * Solo la ve quien lleva el mundo: a un jugador no le llega (la ve proyectada en la mesa)
 */
import type { Page, PageTabView, SceneGrid, SceneView, SceneViewport } from '@crisol/contracts'
import { gridFromMeasures, type Point } from '@crisol/tabletop'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Crosshair, Frame, ImageIcon, Layers, Map as MapIcon, ScanSearch } from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../../api/context.tsx'
import { useErrorText } from '../../api/errors.ts'
import { useAnnounce } from '../../components/announcer.tsx'
import { Loading } from '../../components/brand.tsx'
import { BusyButton } from '../../components/busy-button.tsx'
import dialogStyles from '../../components/dialog.module.css'
import { FormError } from '../../components/field.tsx'
import { failed, LoadError } from '../../components/load-error.tsx'
import { Modal } from '../../components/modal.tsx'
import { Tour } from '../../components/tour.tsx'
import { usePreparer } from '../../tabletop/preparer.ts'
import { Preparing } from '../../tabletop/preparing.tsx'
import { sceneTabKey } from '../../tabletop/queries.ts'
import { type SceneChoice, useScenePreparation } from '../../tabletop/use-preparation.ts'
import { takePendingChoice } from './pending.ts'
import styles from './scene.module.css'
import { type GridPatch, SceneTabContext, type SceneTabState, useSceneTab } from './scene-context.ts'
import { SceneViewer } from './scene-viewer.tsx'
import { SourcePicker } from './source-picker.tsx'

/**
 * Lo de la escena que comparten el mapa (en medio) y la rejilla (a la derecha). Va siempre alrededor de la página
 * (con tab null si la pestaña no es una escena), para que cambiar de pestaña no rehaga la cabecera
 */
export function SceneTabProvider({
  page,
  tab,
  children
}: {
  page: Page
  tab: PageTabView | null
  children: ReactNode
}) {
  const api = useApi()
  const queryClient = useQueryClient()
  const tabId = tab?.id ?? null
  const key = sceneTabKey(page.worldId, tabId ?? '')
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.call('getScene', { tabId: tabId ?? '' }),
    enabled: tabId !== null
  })
  const scene = tabId ? query.data : undefined
  const preparation = useScenePreparation(page.worldId)
  const editable = !page.locked
  const [aligning, setAligning] = useState(false)
  const [found, setFound] = useState<{ size: number } | 'none' | null>(null)
  const viewer = useRef<(() => SceneViewport | null) | null>(null)
  // Otra pestaña: lo de la anterior se olvida
  const [shownTab, setShownTab] = useState(tabId)
  if (shownTab !== tabId) {
    setShownTab(tabId)
    setAligning(false)
    setFound(null)
  }
  // Lo que falta por guardar de la rejilla (al arrastrar, se junta y sale de una vez), con su escena
  const pending = useRef<{ sceneId: string; grid: GridPatch } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const update = useMutation({
    mutationFn: ({ sceneId, ...input }: { sceneId: string; grid?: GridPatch; initialView?: SceneViewport | null }) =>
      api.call('updateScene', { sceneId, ...input }),
    onError: () => queryClient.invalidateQueries({ queryKey: key })
  })
  const flush = () => {
    clearTimeout(timer.current)
    const waiting = pending.current
    pending.current = null
    if (waiting) update.mutate(waiting)
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  const saveGrid = (patch: GridPatch, later = false) => {
    if (!scene) return
    queryClient.setQueryData<SceneView>(key, (current) =>
      current ? { ...current, grid: { ...current.grid, ...patch } } : current
    )
    pending.current = { sceneId: scene.id, grid: { ...pending.current?.grid, ...patch } }
    clearTimeout(timer.current)
    if (later) timer.current = setTimeout(flush, 350)
    else flush()
  }
  const alignCorners = ([a, b]: [Point, Point]) => {
    if (!scene) return
    const type = scene.grid.type === 'none' ? 'square' : scene.grid.type
    // En la cuadrada se marcan dos esquinas opuestas: el lado, de lo que miden en horizontal y en vertical
    const side = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 2
    const corner = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }
    const measure = type === 'square' ? { a: corner, b: { x: corner.x + side, y: corner.y } } : { a, b }
    const result = gridFromMeasures(type, [measure])
    setAligning(false)
    if (!result) return
    const { grid } = result
    saveGrid({ type, size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY })
    setFound({ size: Math.round(grid.size) })
  }

  // Lo elegido en «Pestaña nueva» o una escena que creó la IA con un archivo (sin trocear): se prepara al abrirla
  const started = useRef<string | null>(null)
  const { start, cancel } = preparation
  useEffect(() => {
    if (!scene || !editable || started.current === scene.id) return
    const chosen = takePendingChoice(scene.tabId)
    const own = scene.image && !scene.image.tiles && scene.image.fileId ? scene.image.fileId : null
    if (!chosen && !own) return
    started.current = scene.id
    void start(scene, chosen ?? { kind: 'own', fileId: own as string })
  }, [scene, editable, start])
  // Al dejar la pestaña: se guarda lo pendiente y se para lo que se estuviera preparando
  useEffect(
    () => () => {
      flushRef.current()
      cancel()
    },
    [tabId, cancel]
  )

  const value: SceneTabState | null = tab
    ? {
        page,
        tab,
        scene,
        query,
        preparation,
        editable,
        saveGrid,
        saveView: (view) =>
          scene ? update.mutateAsync({ sceneId: scene.id, initialView: view }) : Promise.resolve(null),
        aligning,
        setAligning,
        found,
        setFound,
        alignCorners,
        viewer
      }
    : null
  return <SceneTabContext.Provider value={value}>{children}</SceneTabContext.Provider>
}

/** Lo de en medio: el mapa (o elegirlo, o «Preparando el mapa…») y, debajo, abrirla en la mesa o cambiar la imagen */
export function SceneMain() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { page, tab, scene, query, preparation, editable } = useSceneTab()
  if (!scene) return failed(query) ? <LoadError error={query.error} onRetry={() => query.refetch()} /> : <Loading />
  const { state } = preparation
  const start = (choice: SceneChoice) => void preparation.start(scene, choice)
  const tour = (
    <Tour
      id="escena"
      steps={[
        { target: '[data-tour="mapa-pestanas"]', text: t('tour.map.tabs') },
        { target: '[data-tour="escena-mapa"]', text: t('tour.scene.map') },
        { target: '[data-tour="escena-rejilla"]', text: t('tour.scene.grid'), placement: 'left' },
        { target: '[data-tour="escena-mesa"]', text: t('tour.scene.table'), placement: 'top' }
      ]}
    />
  )
  if (state.status !== 'preparing' && !scene.image) {
    return (
      <section className={styles.empty} aria-label={t('scene.label', { name: tab.name })} data-tour="escena-mapa">
        <MapIcon aria-hidden="true" size={32} strokeWidth={1.5} />
        <p>{t('scene.empty')}</p>
        {editable && <SourcePicker worldId={page.worldId} value={null} onChange={start} />}
        {state.status === 'failed' && <FormError message={errorText(state.error)} />}
        {tour}
      </section>
    )
  }
  return (
    <div className={styles.wrapper}>
      <div className={styles.frame} data-tour="escena-mapa">
        {state.status === 'preparing' ? (
          <Preparing state={state} onCancel={preparation.cancel} />
        ) : scene.image?.tiles ? (
          <SceneViewer key={scene.image.tiles.version} />
        ) : (
          <div className={styles.waiting} />
        )}
      </div>
      {state.status === 'failed' && <FormError message={errorText(state.error)} />}
      <div className={styles.actions}>
        <OpenInTable scene={scene} />
        <span className={styles.grow} />
        {editable && state.status !== 'preparing' && <ChangeImage onChoose={start} />}
      </div>
      {tour}
    </div>
  )
}

/** «Abrir en la mesa», con la campaña si el mundo tiene varias que lleve la cuenta */
function OpenInTable({ scene }: { scene: SceneView }) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { page } = useSceneTab()
  const campaigns = useQuery({
    queryKey: ['campaigns', page.worldId],
    queryFn: () => api.call('listCampaigns', { worldId: page.worldId })
  })
  const mine = campaigns.data?.campaigns.filter((campaign) => campaign.role === 'master') ?? []
  const [chosen, setChosen] = useState<string | null>(null)
  const campaignId = chosen ?? mine[0]?.id ?? null
  const open = useMutation({
    mutationFn: (id: string) => api.call('openScene', { campaignId: id, sceneId: scene.id }),
    onSuccess: (_, id) =>
      navigate({ to: '/mundos/$worldId/campanas/$campaignId/mesa', params: { worldId: page.worldId, campaignId: id } })
  })
  if (mine.length === 0 || !campaignId) return null
  return (
    <div className={styles.openRow} data-tour="escena-mesa">
      <BusyButton
        className={styles.primary}
        busy={open.isPending}
        disabled={!scene.image}
        onClick={() => open.mutate(campaignId)}
      >
        <Layers aria-hidden="true" size={16} />
        {t('scene.openInTable')}
      </BusyButton>
      {mine.length > 1 && (
        <select
          className={styles.select}
          aria-label={t('scene.campaign')}
          value={campaignId}
          onChange={(event) => setChosen(event.currentTarget.value)}
        >
          {mine.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
      )}
      <FormError message={open.error ? errorText(open.error) : null} />
    </div>
  )
}

/** «Cambiar la imagen»: el mismo selector, en un cuadro; elegir una ya la prepara */
function ChangeImage({ onChoose }: { onChoose: (choice: SceneChoice) => void }) {
  const { t } = useTranslation()
  const { page } = useSceneTab()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  return (
    <>
      <button ref={trigger} type="button" className={styles.ghost} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <ImageIcon aria-hidden="true" size={16} />
        {t('scene.changeImage')}
      </button>
      {open && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={`${dialogStyles.dialog} ${styles.dialog}`}
          onClose={() => {
            setOpen(false)
            trigger.current?.focus()
          }}
        >
          <div className={styles.dialogBody}>
            <h2 id={titleId}>{t('scene.changeImage')}</h2>
            <SourcePicker
              worldId={page.worldId}
              value={null}
              onChange={(choice) => {
                dialog.current?.close()
                onChoose(choice)
              }}
            />
          </div>
        </Modal>
      )}
    </>
  )
}

const GRID_KINDS = ['square', 'hex', 'none'] as const
const UNITS = ['pies', 'millas'] as const

/** La rejilla de la escena, a la derecha: su tipo, su tamaño, lo que mide, alinearla y la vista inicial */
export function SceneSide() {
  const { t } = useTranslation()
  const preparer = usePreparer()
  const announce = useAnnounce()
  const errorText = useErrorText()
  const { scene, editable, saveGrid, saveView, setAligning, aligning, found, setFound, viewer } = useSceneTab()
  const ids = { shape: useId(), size: useId(), distance: useId(), units: useId(), diagonals: useId(), color: useId() }
  const typeName = useId()
  const detect = useMutation({
    mutationFn: async () => {
      const tiles = scene?.image?.tiles
      if (!scene?.image || !tiles) return null
      return preparer.detect({ id: scene.id, width: scene.image.width, height: scene.image.height, tiles })
    },
    onSuccess: (grid) => {
      if (!grid) return setFound('none')
      saveGrid({ type: grid.type, size: grid.size, offsetX: grid.offsetX, offsetY: grid.offsetY })
      setFound({ size: Math.round(grid.size) })
    }
  })
  const keepView = useMutation({
    mutationFn: async () => {
      const view = viewer.current?.()
      if (view) await saveView(view)
    },
    onSuccess: () => announce(t('scene.grid.viewSaved'))
  })
  if (!scene) return null
  const { grid } = scene
  const kind = grid.type === 'none' ? 'none' : grid.type === 'square' ? 'square' : 'hex'
  const ready = Boolean(scene.image?.tiles) && editable
  const units = UNITS.includes(grid.units as (typeof UNITS)[number]) ? UNITS : [...UNITS, grid.units]
  const setSize = (value: number, later: boolean) => {
    if (Number.isFinite(value) && value >= 10 && value <= 2000) {
      setFound(null)
      saveGrid({ size: value }, later)
    }
  }
  return (
    <section className={styles.side} aria-labelledby={`${typeName}-title`} data-tour="escena-rejilla">
      <h2 id={`${typeName}-title`}>{t('scene.grid.title')}</h2>
      <fieldset className={styles.segments} disabled={!editable}>
        <legend className={styles.hidden}>{t('scene.grid.type')}</legend>
        {GRID_KINDS.map((option) => (
          <label key={option} className={styles.segment}>
            <input
              type="radio"
              name={typeName}
              checked={kind === option}
              onChange={() => saveGrid({ type: option === 'hex' ? 'hex-rows' : option === 'none' ? 'none' : 'square' })}
            />
            {t(`scene.grid.types.${option}`)}
          </label>
        ))}
      </fieldset>
      {kind === 'hex' && (
        <div className={styles.field}>
          <label htmlFor={ids.shape}>{t('scene.grid.shape')}</label>
          <select
            id={ids.shape}
            className={styles.select}
            value={grid.type}
            disabled={!editable}
            onChange={(event) => saveGrid({ type: event.currentTarget.value as SceneGrid['type'] })}
          >
            <option value="hex-rows">{t('scene.grid.shapes.hex-rows')}</option>
            <option value="hex-columns">{t('scene.grid.shapes.hex-columns')}</option>
          </select>
        </div>
      )}
      {kind !== 'none' && (
        <>
          <div className={styles.field}>
            <label htmlFor={ids.size}>{t('scene.grid.size')}</label>
            <div className={styles.row}>
              <input
                type="range"
                min={10}
                max={Math.max(300, Math.ceil(grid.size * 1.5))}
                step={0.5}
                value={grid.size}
                disabled={!editable}
                aria-label={t('scene.grid.sizeLabel')}
                onChange={(event) => setSize(Number(event.currentTarget.value), true)}
              />
              <input
                id={ids.size}
                className={styles.number}
                type="number"
                min={10}
                max={2000}
                step={0.1}
                value={Math.round(grid.size * 10) / 10}
                disabled={!editable}
                onChange={(event) => setSize(Number(event.currentTarget.value), true)}
              />
              <span className={styles.unit}>{t('scene.grid.px')}</span>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor={ids.distance}>{t('scene.grid.distance')}</label>
              <input
                id={ids.distance}
                className={styles.number}
                type="number"
                min={0.1}
                step="any"
                value={grid.distance}
                disabled={!editable}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value)
                  if (value > 0) saveGrid({ distance: value }, true)
                }}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.units}>{t('scene.grid.units')}</label>
              <select
                id={ids.units}
                className={styles.select}
                value={grid.units}
                disabled={!editable}
                onChange={(event) => saveGrid({ units: event.currentTarget.value })}
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`scene.grid.unitNames.${unit}`, { defaultValue: unit })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor={ids.diagonals}>{t('scene.grid.diagonals')}</label>
            <select
              id={ids.diagonals}
              className={styles.select}
              value={grid.diagonals}
              disabled={!editable}
              onChange={(event) => saveGrid({ diagonals: event.currentTarget.value as SceneGrid['diagonals'] })}
            >
              <option value="equal">{t('scene.grid.diagonalRules.equal')}</option>
              <option value="alternate">{t('scene.grid.diagonalRules.alternate')}</option>
              <option value="euclidean">{t('scene.grid.diagonalRules.euclidean')}</option>
            </select>
          </div>
          <div className={styles.field}>
            <span>{t('scene.grid.align')}</span>
            <div className={styles.row}>
              <BusyButton
                className={styles.ghost}
                busy={detect.isPending}
                disabled={!ready}
                onClick={() => {
                  setAligning(false)
                  setFound(null)
                  detect.mutate()
                }}
              >
                <ScanSearch aria-hidden="true" size={16} />
                {t('scene.grid.find')}
              </BusyButton>
              <button
                type="button"
                className={styles.ghost}
                aria-pressed={aligning}
                disabled={!ready}
                onClick={() => {
                  setFound(null)
                  setAligning(!aligning)
                }}
              >
                <Crosshair aria-hidden="true" size={16} />
                {t('scene.grid.corners')}
              </button>
            </div>
            <p className={styles.found} role="status">
              {found === 'none' ? t('scene.grid.notFound') : found ? t('scene.grid.found', { size: found.size }) : ''}
            </p>
            <FormError message={detect.error ? errorText(detect.error) : null} />
          </div>
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-checked={grid.visible}
            disabled={!editable}
            onClick={() => saveGrid({ visible: !grid.visible })}
          >
            {t('scene.grid.visible')}
            <span className={styles.toggle} aria-hidden="true" />
          </button>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor={ids.color}>{t('scene.grid.color')}</label>
              <input
                id={ids.color}
                className={styles.color}
                type="color"
                value={grid.color}
                disabled={!editable}
                onChange={(event) => saveGrid({ color: event.currentTarget.value }, true)}
              />
            </div>
            <div className={`${styles.field} ${styles.grow}`}>
              <span>{t('scene.grid.opacity')}</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={grid.opacity}
                disabled={!editable}
                aria-label={t('scene.grid.opacity')}
                onChange={(event) => saveGrid({ opacity: Number(event.currentTarget.value) }, true)}
              />
            </div>
          </div>
        </>
      )}
      <div className={styles.field}>
        <span>{t('scene.grid.initialView')}</span>
        <BusyButton
          className={styles.ghost}
          busy={keepView.isPending}
          disabled={!ready}
          onClick={() => keepView.mutate()}
        >
          <Frame aria-hidden="true" size={16} />
          {t('scene.grid.useView')}
        </BusyButton>
      </div>
    </section>
  )
}
