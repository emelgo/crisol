/**
 * La pantalla del máster (docs/specs/herramientas-mesa.md): un cajón que sube desde abajo del mapa con los statblocks
 * de las criaturas de la escena (la hoja de la criatura en juego, con sus tiradas a un clic; una por cada criatura
 * distinta, con cuántas hay) y la nota de una página (la de la escena, u otra). Lo que enseña se recuerda en este
 * navegador para cada escena
 */
import type { SceneView, TokenView } from '@crisol/contracts'
import { useQuery } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/core'
import { FileText, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { SheetGroups } from '../characters/play-sheet.tsx'
import { Loading } from '../components/brand.tsx'
import { CreatureSheet } from '../creatures/in-play.tsx'
import { ContentView } from '../wiki/content.tsx'
import { usePageContent } from '../wiki/preview.tsx'
import { PageLink } from '../wiki/read-as.tsx'
import styles from './tools.module.css'
import visionStyles from './vision.module.css'
import { Switch } from './vision-panel.tsx'

export type GmSettings = { note: string | null; statblocks: boolean }

const storageKey = (campaignId: string, sceneId: string) => `crisol.mesa.pantalla.${campaignId}.${sceneId}`

/** Lo que enseña la pantalla del máster en una escena (por defecto, su página y los statblocks) */
export function useGmSettings(campaignId: string, scene: SceneView | null) {
  const read = (): GmSettings => {
    const fallback = { note: scene?.pageId ?? null, statblocks: true }
    if (!scene) return fallback
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey(campaignId, scene.id)) ?? 'null') as GmSettings | null
      return stored ? { ...fallback, ...stored } : fallback
    } catch {
      return fallback
    }
  }
  const [settings, setSettings] = useState<GmSettings>(read)
  // Otra escena: lo suyo
  const sceneId = scene?.id ?? null
  const [readFor, setReadFor] = useState(sceneId)
  if (readFor !== sceneId) {
    setReadFor(sceneId)
    setSettings(read())
  }
  const change = (patch: Partial<GmSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    if (!scene) return
    try {
      localStorage.setItem(storageKey(campaignId, scene.id), JSON.stringify(next))
    } catch {
      // Sin almacenamiento, se queda para esta visita
    }
  }
  return { settings, change }
}

/** Las criaturas de la escena, una por cada nombre (sin el número de su copia), con cuántas hay */
export function creatureGroups(tokens: readonly TokenView[]) {
  const groups = new Map<string, { creatureId: string; name: string; count: number }>()
  for (const token of tokens) {
    if (token.actor.kind !== 'creature') continue
    const name = token.actor.name.replace(/\s+\d+$/, '')
    const group = groups.get(name)
    if (group) group.count++
    else groups.set(name, { creatureId: token.actor.id, name, count: 1 })
  }
  return [...groups.values()]
}

export function GmScreen({
  worldId,
  campaignId,
  systemId,
  tokens,
  settings,
  onClose
}: {
  worldId: string
  campaignId: string
  systemId: string | null
  tokens: readonly TokenView[]
  settings: GmSettings
  onClose: () => void
}) {
  const { t } = useTranslation()
  const groups = settings.statblocks ? creatureGroups(tokens) : []
  return (
    <section className={styles.gm} aria-label={t('tools.gm')}>
      <header className={styles.gmHead}>
        <h2>{t('tools.gm')}</h2>
        <button type="button" className={styles.icon} aria-label={t('tools.closeGm')} onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <SheetGroups value={true}>
        <div className={styles.gmBody}>
          {groups.map((group) => (
            <div key={group.creatureId} className={styles.statblock}>
              <span className={styles.statCount}>
                {group.count > 1 ? t('tools.inScene', { count: group.count }) : t('tools.single')}
              </span>
              <CreatureSheet
                creatureId={group.creatureId}
                campaignId={campaignId}
                systemId={systemId}
                onRemoved={() => {}}
                statblock
              />
            </div>
          ))}
          {settings.statblocks && groups.length === 0 && <p className={visionStyles.stat}>{t('tools.noCreatures')}</p>}
          {settings.note && <Note worldId={worldId} pageId={settings.note} />}
        </div>
      </SheetGroups>
    </section>
  )
}

/** La nota: lo de dentro de una página, en solo lectura, con un enlace a ella */
function Note({ worldId, pageId }: { worldId: string; pageId: string }) {
  const { t } = useTranslation()
  const content = usePageContent(worldId, pageId, null, false)
  const page = content.data?.page
  return (
    <article className={styles.note} aria-label={page?.title ?? t('tools.note')}>
      <h3>{page?.title ?? ''}</h3>
      {page && (
        <PageLink worldId={worldId} pageId={pageId} className={styles.noteLink}>
          <FileText aria-hidden="true" size={13} />
          {t('tools.openPage')}
        </PageLink>
      )}
      {content.data ? (
        <ContentView blocks={(content.data.blocks ?? []) as JSONContent[]} worldId={worldId} />
      ) : (
        <Loading />
      )}
    </article>
  )
}

/** El panel de la pantalla del máster: qué nota enseña y si van los statblocks */
export function GmPanel({
  worldId,
  scene,
  settings,
  onChange
}: {
  worldId: string
  scene: SceneView
  settings: GmSettings
  onChange: (patch: Partial<GmSettings>) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const pages = names.data?.pages ?? []
  const current =
    pages.find((page) => page.id === settings.note)?.title ?? (settings.note === scene.pageId ? scene.pageTitle : '')
  const [text, setText] = useState(current)
  useEffect(() => setText(current), [current])
  const commit = () => {
    const key = text.trim().toLocaleLowerCase('es')
    if (!key) return onChange({ note: null })
    const found = pages.find((page) => page.title.toLocaleLowerCase('es') === key)
    if (found) onChange({ note: found.id })
    else setText(current)
  }
  return (
    <>
      <label className={visionStyles.field}>
        <span>{t('tools.note')}</span>
        <input
          className={visionStyles.input}
          list={`${id}-pages`}
          value={text}
          placeholder={t('tools.noNote')}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
        />
        <datalist id={`${id}-pages`}>
          {pages.map((page) => (
            <option key={page.id} value={page.title} />
          ))}
        </datalist>
      </label>
      <Switch checked={settings.statblocks} onChange={(statblocks) => onChange({ statblocks })}>
        {t('tools.statblocks')}
      </Switch>
    </>
  )
}
