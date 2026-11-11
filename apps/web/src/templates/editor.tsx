/**
 * Una plantilla abierta (/plantillas/:id, ADR-0024): es una página del mundo oculto de la cuenta, así que se ve y se
 * edita como una página (portada, icono en el título, pestañas, texto y panel), con lo suyo: «Plantillas» arriba a la
 * izquierda para volver, la marca «Plantilla» junto al título, sin «Quién la conoce», «Marcar» ni «Mencionado en», y
 * en el panel sus campos y sus bloques, que se definen en vez de rellenarse. A la izquierda, las demás, para saltar
 */
import type {
  TemplateView as Listed,
  Page,
  PageProperty,
  PageTemplate,
  PanelBlock,
  TemplateFolder
} from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronUp, Copy, Plus, Settings, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { useDismiss } from '../components/dismiss.ts'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { Tour } from '../components/tour.tsx'
import { LEAVE_ITEM, leaveItem, SECTION } from '../components/world-transition.ts'
import { CollabSocket } from '../wiki/collab.tsx'
import { blockOf, type Kind, kindOf, PANEL_GROUPS } from '../wiki/panel-blocks.tsx'
import { RelatedOptions } from '../wiki/related-block.tsx'
import { type TabTarget, TabTargetContext, usePageTabs } from '../wiki/tabs/page-tabs.tsx'
import wiki from '../wiki/wiki.module.css'
import { EntryView, pageKey, useSideTop } from '../wiki/wiki.tsx'
import styles from './editor.module.css'
import { FieldsEditor } from './fields.tsx'
import { TemplateIcon } from './icons.tsx'
import { useNewTemplate } from './new-template.ts'
import { useTemplates } from './picker.tsx'
import { Grip, moved, useReorder } from './reorder.tsx'
import { TemplateSettings } from './screen.tsx'
import { templateGroups } from './tree.ts'

type Patch = Partial<Pick<PageTemplate, 'fields' | 'panel'>>

export function TemplateView() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const { account, pending } = useAccounts().useAccount()
  const { templateId } = useParams({ strict: false }) as { templateId: string }
  const { nuevo, pestana } = useSearch({ strict: false }) as { nuevo?: true; pestana?: string }
  const templates = useTemplates()
  const template = templates.data?.templates.find((each) => each.id === templateId)
  // Su página: al abrir una de antes, el servidor se la hace (getTemplate); su mundo sale de ella
  const opened = useQuery({
    queryKey: ['template-page', templateId],
    queryFn: async () => {
      const found = await api.call('getTemplate', { templateId })
      if (!found.pageId) throw new ApiError('NOT_FOUND', 404)
      const page = await api.call('getPage', { pageId: found.pageId })
      queryClient.setQueryData(pageKey(page.worldId, page.id), page)
      return { worldId: page.worldId, pageId: page.id }
    },
    enabled: Boolean(account),
    staleTime: Number.POSITIVE_INFINITY
  })
  const page = useQuery({
    queryKey: pageKey(opened.data?.worldId ?? '', opened.data?.pageId ?? ''),
    queryFn: () => api.call('getPage', { pageId: opened.data?.pageId ?? '' }),
    enabled: Boolean(opened.data)
  })
  // Lo que cambia en su página (nombre, icono, portada) sale también en la lista de plantillas
  const seen = useRef(0)
  useEffect(() => {
    if (!page.dataUpdatedAt) return
    if (seen.current) void queryClient.invalidateQueries({ queryKey: ['templates'] })
    seen.current = page.dataUpdatedAt
  }, [page.dataUpdatedAt, queryClient])
  useEffect(() => {
    if (page.data) document.title = t('app.pageTitle', { page: page.data.title })
  }, [page.data, t])
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const gone =
    (opened.error instanceof ApiError && opened.error.status === 404) ||
    (templates.data && !template && !templates.isFetching)
  // Una que no está (o que se borró) lleva a la lista
  if (gone) return <Navigate to="/plantillas" replace />
  return (
    <TemplateLayout current={template} all={templates.data?.templates ?? []} folders={templates.data?.folders ?? []}>
      {page.data && template ? (
        <TemplatePage
          key={template.id}
          page={page.data}
          template={template}
          folders={templates.data?.folders ?? []}
          nuevo={nuevo === true}
          pestana={pestana}
        />
      ) : failed(opened) || failed(page) ? (
        <LoadError error={opened.error ?? page.error} onRetry={() => (opened.error ? opened : page).refetch()} />
      ) : (
        <Loading />
      )}
    </TemplateLayout>
  )
}

/** Como la wiki: a la izquierda, la ficha con las plantillas (y «Plantillas», encima, para volver); en medio, la abierta */
function TemplateLayout({
  current,
  all,
  folders,
  children
}: {
  current: Listed | undefined
  all: readonly Listed[]
  folders: readonly TemplateFolder[]
  children: ReactNode
}) {
  const { t } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const headingId = useId()
  const create = useNewTemplate()
  useSideTop(root, true)
  return (
    <div ref={root} className={wiki.wiki}>
      <Link
        to="/plantillas"
        className={styles.back}
        viewTransition={LEAVE_ITEM}
        // Al revés que al entrar: su icono y su nombre vuelven a su tarjeta
        onClick={() => current && leaveItem(current.id, root.current)}
      >
        <ChevronLeft aria-hidden="true" size={16} />
        {t('templates.title')}
      </Link>
      <aside className={wiki.aside} aria-labelledby={headingId}>
        <div className={wiki.asideHeader}>
          <h2 id={headingId}>{t('templates.listLabel')}</h2>
          <button
            type="button"
            className={wiki.newPageIcon}
            aria-label={t('templates.new')}
            title={t('templates.new')}
            disabled={create.isPending}
            // En la carpeta de la abierta
            onClick={() => create.mutate({ folderId: current?.folderId ?? null })}
          >
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
        <FormError message={create.errorText} />
        <TemplateLinks folders={folders} templates={all} current={current?.id} />
      </aside>
      <div className={wiki.content}>
        <CollabSocket>{children}</CollabSocket>
      </div>
    </div>
  )
}

function TemplateLinks({
  folders,
  templates,
  current
}: {
  folders: readonly TemplateFolder[]
  templates: readonly Listed[]
  current: string | undefined
}) {
  const { t } = useTranslation()
  const groups = templateGroups(folders, templates)
  return (
    <ul className={styles.links}>
      {groups.map((group) => (
        <li key={group.id ?? 'arriba'}>
          {/* Las de lo más alto, detrás de las carpetas: con su rótulo, si hay carpetas */}
          {(group.label ?? (groups.length > 1 ? t('templates.loose') : null)) && (
            <p className={styles.listHead}>{group.label ?? t('templates.loose')}</p>
          )}
          <ul className={styles.links}>
            {group.templates.map((each) => (
              <li key={each.id}>
                <Link
                  to="/plantillas/$templateId"
                  params={{ templateId: each.id }}
                  aria-current={each.id === current ? 'page' : undefined}
                  // De una a otra, como entre pestañas: rápido
                  viewTransition={SECTION}
                >
                  <TemplateIcon icon={each.icon} size={15} />
                  {each.name}
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

/** La página de la plantilla, con sus pestañas llevando a la plantilla (no a la wiki de un mundo) */
function TemplatePage({
  page,
  template,
  folders,
  nuevo,
  pestana
}: {
  page: Page
  template: Listed
  folders: readonly TemplateFolder[]
  nuevo: boolean
  pestana: string | undefined
}) {
  const { t } = useTranslation()
  const tabs = usePageTabs(page)
  const all = tabs.data ?? []
  const active = pestana ? (all.find((tab) => tab.id === pestana) ?? null) : null
  const target = useCallback<TabTarget>(
    (tab) => ({
      to: '/plantillas/$templateId',
      params: { templateId: template.id },
      search: tab ? { pestana: tab } : {}
    }),
    [template.id]
  )
  // Una pestaña que ya no está: al texto
  if (pestana && tabs.data && !tabs.isFetching && !active) return <Navigate {...target(null)} replace />
  if (pestana && !active) return null
  return (
    <TabTargetContext.Provider value={target}>
      {!nuevo && (
        <Tour
          id="plantilla"
          steps={[
            { target: '[data-tour="plantilla-marca"]', text: t('tour.template.page') },
            { target: '[data-tour="panel-bloques"]', text: t('tour.template.panel') }
          ]}
        />
      )}
      <EntryView
        page={page}
        nuevo={nuevo}
        tabs={all}
        active={active}
        template={{
          id: template.id,
          more: <TemplateMore template={template} folders={folders} />,
          side: <TemplateSide template={template} page={page} />
        }}
      />
    </TabTargetContext.Provider>
  )
}

/** «⋯» de una plantilla: sus ajustes (nombre, icono y borrarla); borrada, a la lista */
function TemplateMore({ template, folders }: { template: Listed; folders: readonly TemplateFolder[] }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // Duplicarla: su página entera, con los mismos campos (sus páginas salen en las mismas tablas), y se abre
  const copy = useNewTemplate()
  return (
    <>
      <button type="button" disabled={copy.isPending} onClick={() => copy.mutate({ copyOf: template })}>
        <Copy aria-hidden="true" size={16} />
        {t('templates.duplicate')}
      </button>
      <FormError message={copy.errorText} />
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Settings aria-hidden="true" size={16} />
        {t('templates.settings')}
      </button>
      {open && (
        <TemplateSettings
          template={template}
          // Su carpeta, también desde aquí
          folder={{
            folders: [...folders],
            value: template.folderId,
            onMove: async (dest) => {
              await api.call('moveTemplate', { templateId: template.id, folderId: dest })
              await queryClient.invalidateQueries({ queryKey: ['templates'] })
            }
          }}
          onClose={(gone) => {
            setOpen(false)
            if (gone) void navigate({ to: '/plantillas' })
          }}
        />
      )}
    </>
  )
}

/**
 * El panel de la plantilla: sus campos (nombre y tipo) y los bloques de su panel, que se definen. Se guarda solo, en
 * fila; mientras quede algo por guardar, lo que llega de fuera no pisa lo de aquí
 */
function TemplateSide({ template, page }: { template: PageTemplate; page: Page }) {
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [draft, setDraft] = useState<Patch & Pick<PageTemplate, 'fields' | 'panel'>>(template)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const inFlight = useRef(0)
  useEffect(() => {
    if (inFlight.current === 0) setDraft(template)
  }, [template])
  const save = useMutation({
    mutationFn: (patch: Patch) => {
      inFlight.current++
      const run = queue.current
        .catch(() => undefined)
        .then(() => api.call('updateTemplate', { templateId: template.id, ...patch }))
        .finally(() => {
          inFlight.current--
        })
      queue.current = run
      return run
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['templates'] }),
        queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      ])
  })
  const change = (patch: Patch) => {
    setDraft((current) => ({ ...current, ...patch }))
    save.mutate(patch)
  }
  return (
    <div className={styles.side}>
      <FieldsEditor
        fields={draft.fields}
        readOnly={page.locked}
        onChange={(fields: PageProperty[]) => change({ fields })}
      />
      <BlocksEditor blocks={draft.panel} readOnly={page.locked} onChange={(panel) => change({ panel })} />
      <FormError message={save.error ? errorText(save.error) : null} />
    </div>
  )
}

/** Los bloques del panel de la plantilla: se añaden, se titulan, se recolocan y se quitan; las tablas, con sus desplegables */
function BlocksEditor({
  blocks,
  readOnly,
  onChange
}: {
  blocks: readonly PanelBlock[]
  readOnly: boolean
  onChange: (blocks: PanelBlock[]) => void
}) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  // El bloque desplegado (sus opciones), como un campo
  const [open, setOpen] = useState<string | null>(null)
  const addRoot = useRef<HTMLDivElement>(null)
  const addTrigger = useRef<HTMLButtonElement>(null)
  // Abierto, Escape o pulsar fuera lo cierran (como «⋯»)
  useDismiss(adding, () => setAdding(false), addRoot, addTrigger)
  const update = (index: number, patch: Partial<PanelBlock>) =>
    onChange(blocks.map((block, i) => (i === index ? ({ ...block, ...patch } as PanelBlock) : block)))
  const reorder = (from: number, to: number) => onChange(moved(blocks, from, to))
  const drag = useReorder(reorder)
  return (
    <section className={styles.block} aria-label={t('templates.inPanel')}>
      <h2 className={styles.blockTitle}>{t('templates.inPanel')}</h2>
      <ul className={styles.fields}>
        {blocks.map((block, index) => {
          const kind = kindOf(block)
          const label = t(`panelBlocks.kinds.${kind}`)
          const name = ('title' in block && block.title) || label
          const expanded = open === block.id
          const toggle = () => setOpen(expanded ? null : block.id)
          return (
            <li key={block.id} className={styles.field} data-open={expanded || undefined} {...drag.row(index)}>
              {/* Plegado: sus seis puntos, su nombre y su tipo; al pulsarlo, sus opciones */}
              <div className={styles.fieldLine}>
                {!readOnly && (
                  <Grip
                    name={name}
                    index={index}
                    count={blocks.length}
                    open={expanded}
                    onToggle={toggle}
                    onMove={reorder}
                    onDragStart={drag.start}
                    onDragEnd={drag.end}
                  />
                )}
                <button type="button" className={styles.fieldRow} aria-expanded={expanded} onClick={toggle}>
                  <span className={styles.fieldName}>{name}</span>
                  <span className={styles.fieldType}>{label}</span>
                </button>
              </div>
              {expanded && (
                <fieldset className={styles.blockShape} disabled={readOnly}>
                  <legend className={styles.hidden}>{name}</legend>
                  {'title' in block && (
                    <input
                      className={styles.blockName}
                      aria-label={t('templateEditor.blockTitle', { kind: label })}
                      defaultValue={block.title}
                      placeholder={label}
                      maxLength={80}
                      onBlur={(event) => {
                        const title = event.currentTarget.value.trim()
                        if (title !== block.title) update(index, { title } as Partial<PanelBlock>)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                      }}
                    />
                  )}
                  {block.type === 'related' && (
                    <RelatedOptions block={block} onChange={(patch) => update(index, patch as Partial<PanelBlock>)} />
                  )}
                  {!readOnly && (
                    <div className={styles.shapeActions}>
                      <button type="button" disabled={index === 0} onClick={() => reorder(index, index - 1)}>
                        <ChevronUp size={14} aria-hidden="true" />
                        {t('templateEditor.up')}
                      </button>
                      <button
                        type="button"
                        disabled={index === blocks.length - 1}
                        onClick={() => reorder(index, index + 1)}
                      >
                        <ChevronDown size={14} aria-hidden="true" />
                        {t('templateEditor.down')}
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        {t('panelBlocks.remove')}
                      </button>
                    </div>
                  )}
                </fieldset>
              )}
            </li>
          )
        })}
      </ul>
      {blocks.length === 0 && <p className={styles.muted}>{t('templateEditor.noBlocks')}</p>}
      {!readOnly && (
        <div ref={addRoot} className={styles.addWrap}>
          <button
            ref={addTrigger}
            type="button"
            className={styles.add}
            aria-expanded={adding}
            onClick={() => setAdding(!adding)}
          >
            <Plus size={14} aria-hidden="true" />
            {t('panelBlocks.add')}
          </button>
          {adding && (
            <div className={styles.addMenu}>
              {PANEL_GROUPS.map(({ group, kinds }) => (
                <div key={group}>
                  <p className={styles.listHead}>{t(`panelBlocks.groups.${group}`)}</p>
                  {kinds.map(({ kind, icon }) => (
                    <button
                      key={kind}
                      type="button"
                      className={styles.addOption}
                      onClick={() => {
                        setAdding(false)
                        const block = blockOf(kind as Kind)
                        onChange([...blocks, block])
                        setOpen(block.id)
                      }}
                    >
                      {icon}
                      {t(`panelBlocks.kinds.${kind}`)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
