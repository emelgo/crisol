/**
 * La pantalla del máster (docs/specs/herramientas-mesa.md; lienzo «El tiempo de la campaña», pantallas 7 y 7b;
 * decisiones 24 y 33): un cajón que sube desde abajo del mapa (atajo G) en cuatro columnas que se encienden y apagan
 * desde su cabecera: las criaturas de la escena (su statblock, una por cada criatura distinta, con cuántas hay), los
 * personajes de la escena (su ficha corta), una nota fijada (la página de la escena u otra) y las tablas aleatorias del
 * mundo a mano (se tiran ocultas al registro o, con la opción, a la vista de todos). Lo elegido se guarda en el servidor
 * por campaña y escena: en otro aparato sale igual
 */
import type { Character, DiceRoll, GmScreen as GmScreenSettings, SceneView, TokenView } from '@crisol/contracts'
import { tableFormula } from '@crisol/dice'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { JSONContent } from '@tiptap/core'
import {
  ChevronDown,
  ChevronRight,
  Dices,
  FileText,
  Lock,
  Pin,
  Plus,
  ScrollText,
  Swords,
  UsersRound,
  X
} from 'lucide-react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { SheetGroups } from '../characters/play-sheet.tsx'
import { Loading } from '../components/brand.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import { CreatureSheet } from '../creatures/in-play.tsx'
import { colorOf } from '../dice/rolls.ts'
import { ContentView } from '../wiki/content.tsx'
import { usePageContent } from '../wiki/preview.tsx'
import { PageLink } from '../wiki/read-as.tsx'
import gm from './gm-screen.module.css'

type Columns = GmScreenSettings['columns']
const COLUMNS = ['statblocks', 'characters', 'note', 'tables'] as const

/** Lo de siempre: las cuatro columnas, la página de la escena y ninguna tabla */
const defaults = (scene: SceneView | null): GmScreenSettings => ({
  columns: { statblocks: true, characters: true, note: true, tables: true },
  note: scene?.pageId ?? null,
  tables: []
})

/**
 * Lo que enseña la pantalla del máster en la escena abierta: lo que guarda el servidor (en la mesa, gmScreen) o lo de
 * siempre. Cambiarlo se ve al momento y se guarda
 */
/** Un cambio: las columnas que se tocan, la nota o las tablas */
export type GmPatch = { columns?: Partial<Columns>; note?: string | null; tables?: string[] }

export function useGmSettings(campaignId: string, scene: SceneView | null, stored: GmScreenSettings | null) {
  const api = useApi()
  const [local, setLocal] = useState<{ sceneId: string | null; settings: GmScreenSettings } | null>(null)
  const sceneId = scene?.id ?? null
  // Lo que llega del servidor manda; lo de aquí, hasta que llega
  const settings = (local?.sceneId === sceneId ? local?.settings : null) ?? stored ?? defaults(scene)
  const save = useMutation({
    mutationFn: (patch: GmPatch) => api.call('setGmScreen', { campaignId, ...(sceneId ? { sceneId } : {}), ...patch }),
    onSuccess: ({ gmScreen }) => setLocal({ sceneId, settings: gmScreen })
  })
  const change = (patch: GmPatch) => {
    setLocal({ sceneId, settings: { ...settings, ...patch, columns: { ...settings.columns, ...patch.columns } } })
    save.mutate(patch)
  }
  return { settings, change, error: save.error }
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

/** Los personajes de la escena, uno por cada personaje (aunque tenga varias fichas) */
export function sceneCharacters(tokens: readonly TokenView[]) {
  const seen = new Map<string, TokenView>()
  for (const token of tokens)
    if (token.actor.kind === 'character' && !seen.has(token.actor.id)) seen.set(token.actor.id, token)
  return [...seen.values()]
}

export function GmScreen({
  worldId,
  campaignId,
  systemId,
  scene,
  tokens,
  settings,
  onChange,
  error,
  onClose
}: {
  worldId: string
  campaignId: string
  systemId: string | null
  scene: SceneView
  tokens: readonly TokenView[]
  settings: GmScreenSettings
  onChange: (patch: GmPatch) => void
  error: unknown
  onClose: () => void
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const on = COLUMNS.filter((column) => settings.columns[column])
  return (
    <section className={gm.drawer} aria-label={t('campaignTime.gm.title')}>
      <header className={gm.head}>
        <h2>{t('campaignTime.gm.title')}</h2>
        <kbd className={gm.key}>G</kbd>
        <fieldset className={gm.toggles}>
          <legend className={gm.srOnly}>{t('campaignTime.gm.columns')}</legend>
          {COLUMNS.map((column) => (
            <label key={column} data-on={settings.columns[column] || undefined}>
              <input
                type="checkbox"
                checked={settings.columns[column]}
                onChange={(event) => onChange({ columns: { [column]: event.target.checked } })}
              />
              {t(`campaignTime.gm.${column}`)}
            </label>
          ))}
        </fieldset>
        <span className={gm.scene}>{scene.name}</span>
        <button type="button" className={gm.close} aria-label={t('campaignTime.gm.close')} onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      <FormError message={error ? errorText(error) : null} />
      <SheetGroups value={true}>
        <div className={gm.body} style={{ ['--columns' as string]: Math.max(1, on.length) }}>
          {settings.columns.statblocks && <Creatures campaignId={campaignId} systemId={systemId} tokens={tokens} />}
          {settings.columns.characters && <Characters campaignId={campaignId} tokens={tokens} />}
          {settings.columns.note && (
            <PinnedNote worldId={worldId} pageId={settings.note} onPick={(note) => onChange({ note })} />
          )}
          {settings.columns.tables && (
            <Tables
              worldId={worldId}
              campaignId={campaignId}
              chosen={settings.tables}
              onChange={(tables) => onChange({ tables })}
            />
          )}
        </div>
      </SheetGroups>
    </section>
  )
}

/** Una columna: su icono, su título pequeño, lo de la derecha y lo de dentro, que se desplaza solo */
function Column({
  icon,
  title,
  aside,
  children
}: {
  icon: ReactNode
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  // Con su nombre, no con aria-labelledby: sin el marco de las secciones de la hoja
  return (
    <section className={gm.column} aria-label={title}>
      <header className={gm.columnHead}>
        {icon}
        <h3>{title}</h3>
        {aside}
      </header>
      <div
        className={gm.columnBody}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: se desplaza sola; con el teclado también, aunque dentro no haya nada que pulsar (WCAG 2.1.1)
        tabIndex={0}
      >
        {children}
      </div>
    </section>
  )
}

function Creatures({
  campaignId,
  systemId,
  tokens
}: {
  campaignId: string
  systemId: string | null
  tokens: readonly TokenView[]
}) {
  const { t } = useTranslation()
  const groups = creatureGroups(tokens)
  const total = groups.reduce((sum, g) => sum + g.count, 0)
  // La primera, abierta; las demás, plegadas (se abren al pulsarlas)
  const [open, setOpen] = useState<string | null>(null)
  const shown = open ?? groups[0]?.creatureId ?? null
  return (
    <Column
      icon={<Swords aria-hidden="true" size={14} />}
      title={t('campaignTime.gm.statblocks')}
      aside={total > 0 && <span className={gm.count}>{t('campaignTime.gm.inScene', { count: total })}</span>}
    >
      {groups.length === 0 && <p className={gm.empty}>{t('tools.noCreatures')}</p>}
      {groups.map((group) =>
        group.creatureId === shown ? (
          <div key={group.creatureId} className={gm.statblock}>
            {group.count > 1 && <span className={gm.times}>×{group.count}</span>}
            <CreatureSheet
              creatureId={group.creatureId}
              campaignId={campaignId}
              systemId={systemId}
              onRemoved={() => {}}
              statblock
            />
          </div>
        ) : (
          <button
            key={group.creatureId}
            type="button"
            className={gm.folded}
            aria-expanded={false}
            onClick={() => setOpen(group.creatureId)}
          >
            <ChevronRight aria-hidden="true" size={15} />
            <b>{group.name}</b>
            {group.count > 1 && <span>×{group.count}</span>}
          </button>
        )
      )}
    </Column>
  )
}

/** La ficha corta de un personaje: quién lo juega, sus números (los del sistema) y su vida */
function Characters({ campaignId, tokens }: { campaignId: string; tokens: readonly TokenView[] }) {
  const { t } = useTranslation()
  const api = useApi()
  const people = sceneCharacters(tokens)
  const characters = useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () => api.call('listCharacters', { campaignId }),
    enabled: people.length > 0
  })
  const card = (id: string): Pick<Character, 'owner' | 'summary'> | undefined =>
    characters.data?.characters.find((c) => c.id === id)
  return (
    <Column icon={<UsersRound aria-hidden="true" size={14} />} title={t('campaignTime.gm.charactersTitle')}>
      {people.length === 0 && <p className={gm.empty}>{t('campaignTime.gm.noCharacters')}</p>}
      <ul className={gm.people}>
        {people.map((token) => {
          const info = card(token.actor.id)
          const life = token.actor.life
          const ratio = life && life.max > 0 ? Math.max(0, Math.min(1, life.value / life.max)) : null
          const stats = token.actor.stats.slice(0, 4)
          return (
            <li key={token.actor.id} className={gm.person}>
              <div className={gm.personHead}>
                <span
                  className={gm.avatar}
                  aria-hidden="true"
                  style={{ background: colorOf(info?.owner?.id ?? token.actor.id, null) }}
                >
                  {token.actor.name.charAt(0).toUpperCase()}
                </span>
                <span className={gm.who}>
                  <b>{token.actor.name}</b>
                  <span>{[info?.summary.line, info?.owner?.name].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
              {(stats.length > 0 || life) && (
                <dl className={gm.stats}>
                  {life && (
                    <div>
                      <dt>{t('campaignTime.gm.hp')}</dt>
                      <dd>
                        {life.value}
                        <small>/{life.max}</small>
                      </dd>
                    </div>
                  )}
                  {stats
                    .filter((stat) => !(life && /^(pg|hp)$/i.test(stat.label)))
                    .slice(0, life ? 3 : 4)
                    .map((stat) => (
                      <div key={stat.key}>
                        <dt>{stat.label}</dt>
                        <dd>{stat.value}</dd>
                      </div>
                    ))}
                </dl>
              )}
              {ratio !== null && (
                <span className={gm.bar} aria-hidden="true">
                  <span style={{ inlineSize: `${Math.round(ratio * 100)}%` }} data-low={ratio < 0.35 || undefined} />
                </span>
              )}
              {token.actor.conditions.length > 0 && (
                <p className={gm.conditions}>
                  {token.actor.conditions.map((condition) => (
                    <span key={condition.name}>{condition.name}</span>
                  ))}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </Column>
  )
}

/** La nota fijada: lo de dentro de una página, en solo lectura, con su enlace y «Cambiar» */
function PinnedNote({
  worldId,
  pageId,
  onPick
}: {
  worldId: string
  pageId: string | null
  onPick: (pageId: string | null) => void
}) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  return (
    <Column
      icon={<Pin aria-hidden="true" size={14} />}
      title={t('campaignTime.gm.noteTitle')}
      aside={
        <button type="button" className={gm.link} aria-expanded={picking} onClick={() => setPicking(!picking)}>
          {t('campaignTime.gm.noteChange')}
        </button>
      }
    >
      {picking && (
        <NotePicker
          worldId={worldId}
          current={pageId}
          onPick={(id) => {
            setPicking(false)
            onPick(id)
          }}
        />
      )}
      {pageId ? <Note worldId={worldId} pageId={pageId} /> : <p className={gm.empty}>{t('campaignTime.gm.noNote')}</p>}
    </Column>
  )
}

/** Elegir la nota: las páginas del mundo por su título */
function NotePicker({
  worldId,
  current,
  onPick
}: {
  worldId: string
  current: string | null
  onPick: (pageId: string | null) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const id = useId()
  const names = useQuery({
    queryKey: ['pages', worldId, 'names'],
    queryFn: () => api.call('listPageNames', { worldId })
  })
  const pages = names.data?.pages ?? []
  const [text, setText] = useState(pages.find((p) => p.id === current)?.title ?? '')
  // Se acaba de pulsar «Cambiar»: se escribe ya
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const commit = () => {
    const key = text.trim().toLocaleLowerCase('es')
    if (!key) return onPick(null)
    const found = pages.find((page) => page.title.toLocaleLowerCase('es') === key)
    if (found) onPick(found.id)
  }
  return (
    <label className={gm.picker}>
      <span className={gm.srOnly}>{t('campaignTime.gm.notePick')}</span>
      <input
        ref={input}
        list={`${id}-pages`}
        value={text}
        placeholder={t('campaignTime.gm.notePick')}
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
  )
}

function Note({ worldId, pageId }: { worldId: string; pageId: string }) {
  const { t } = useTranslation()
  const content = usePageContent(worldId, pageId, null, false)
  const page = content.data?.page
  return (
    <article className={gm.note} aria-label={page?.title ?? t('campaignTime.gm.note')}>
      <h4>{page?.title ?? ''}</h4>
      {page && (
        <PageLink worldId={worldId} pageId={pageId} className={gm.noteLink}>
          <FileText aria-hidden="true" size={13} />
          {t('campaignTime.gm.openPage')}
        </PageLink>
      )}
      {content.data ? (
        <ContentView blocks={(content.data.blocks ?? []) as JSONContent[]} worldId={worldId} compact />
      ) : (
        <Loading />
      )}
    </article>
  )
}

/** Las tablas elegidas: se despliegan, se tiran (ocultas, o a la vista de todos) y se añaden o se quitan */
function Tables({
  worldId,
  campaignId,
  chosen,
  onChange
}: {
  worldId: string
  campaignId: string
  chosen: readonly string[]
  onChange: (tables: string[]) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const errorText = useErrorText()
  const [adding, setAdding] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useDismiss(adding, () => setAdding(false), menu, addButton)
  const [visible, setVisible] = useState(false)
  const [last, setLast] = useState<DiceRoll | null>(null)
  const all = useQuery({
    queryKey: ['randomTables', worldId],
    queryFn: () => api.call('listRandomTables', { worldId })
  })
  const list = all.data?.tables ?? []
  const roll = useMutation({
    mutationFn: (tabId: string) =>
      api.call('rollOnTable', { tabId, campaignId, visibility: visible ? 'all' : 'hidden' }),
    onSuccess: ({ roll: done }) => setLast(done)
  })
  const rest = list.filter((table) => !chosen.includes(table.tabId))
  return (
    <Column
      icon={<ScrollText aria-hidden="true" size={14} />}
      title={t('campaignTime.gm.tablesTitle')}
      aside={
        <span className={gm.addRoot}>
          <button
            ref={addButton}
            type="button"
            className={gm.link}
            aria-expanded={adding}
            disabled={rest.length === 0}
            title={list.length === 0 ? t('campaignTime.gm.noRandomTables') : undefined}
            onClick={() => setAdding(!adding)}
          >
            <Plus aria-hidden="true" size={14} />
            {t('campaignTime.gm.addTable')}
          </button>
          {adding && (
            <div ref={menu} className={gm.addMenu} role="menu">
              {rest.map((table) => (
                <button
                  key={table.tabId}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAdding(false)
                    onChange([...chosen, table.tabId])
                  }}
                >
                  {table.name}
                  <span>{table.pageTitle}</span>
                </button>
              ))}
            </div>
          )}
        </span>
      }
    >
      <label className={gm.visible}>
        <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
        {t('campaignTime.gm.rollVisible')}
      </label>
      {last?.table && (
        <div className={gm.result} role="status">
          <p className={gm.resultHead}>
            {last.visibility === 'all' ? (
              t('campaignTime.gm.visibleResult')
            ) : (
              <>
                <Lock aria-hidden="true" size={12} />
                {t('campaignTime.gm.hiddenResult')}
              </>
            )}
            <b>{last.total}</b>
          </p>
          <p>
            <b>{last.table.name}</b> · {last.table.results.map((r) => r.text).join(' · ')}
          </p>
        </div>
      )}
      <FormError message={roll.error ? errorText(roll.error) : null} />
      {chosen.length === 0 && (
        <p className={gm.empty}>
          {list.length === 0 ? t('campaignTime.gm.noRandomTables') : t('campaignTime.gm.noTables')}
        </p>
      )}
      <ul className={gm.tables}>
        {chosen.map((tabId, index) => (
          <TableCard
            key={tabId}
            tabId={tabId}
            campaignId={campaignId}
            open={index === 0}
            name={list.find((table) => table.tabId === tabId)?.name ?? ''}
            highlight={last?.table && last.table.name === list.find((x) => x.tabId === tabId)?.name ? last.total : null}
            busy={roll.isPending}
            onRoll={() => roll.mutate(tabId)}
            onRemove={() => onChange(chosen.filter((id) => id !== tabId))}
          />
        ))}
      </ul>
    </Column>
  )
}

function TableCard({
  tabId,
  campaignId,
  open: startOpen,
  name,
  highlight,
  busy,
  onRoll,
  onRemove
}: {
  tabId: string
  campaignId: string
  open: boolean
  name: string
  highlight: number | null
  busy: boolean
  onRoll: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const [open, setOpen] = useState(startOpen)
  const table = useQuery({
    queryKey: ['randomTable', tabId, campaignId],
    queryFn: () => api.call('getRandomTable', { tabId, campaignId })
  })
  const data = table.data?.table
  const title = data?.name ?? name
  const formula = data ? tableFormula(data.formula, data.rows).replace(/^1d/, 'd') : ''
  return (
    <li className={gm.tableCard}>
      <div className={gm.tableHead}>
        <button
          type="button"
          className={gm.tableToggle}
          aria-expanded={open}
          aria-label={t(open ? 'campaignTime.gm.collapse' : 'campaignTime.gm.expand', { name: title })}
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown aria-hidden="true" size={15} /> : <ChevronRight aria-hidden="true" size={15} />}
          <b>{title}</b>
        </button>
        <span className={gm.formula}>{formula}</span>
        <button
          type="button"
          className={gm.roll}
          disabled={busy || !data || data.rows.length === 0}
          aria-label={t('campaignTime.gm.rollTable', { name: title })}
          onClick={onRoll}
        >
          <Dices aria-hidden="true" size={14} />
          {t('campaignTime.gm.roll')}
        </button>
        <button
          type="button"
          className={gm.remove}
          aria-label={t('campaignTime.gm.removeTable', { name: title })}
          onClick={onRemove}
        >
          <X aria-hidden="true" size={13} />
        </button>
      </div>
      {open && data && (
        <ol className={gm.rows}>
          {data.rows.map((row) => (
            <li
              key={row.id}
              data-hit={(highlight !== null && row.from <= highlight && highlight <= row.to) || undefined}
            >
              <span>{row.from === row.to ? row.from : `${row.from}–${row.to}`}</span>
              <span>{row.text}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}
