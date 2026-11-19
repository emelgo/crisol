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
import { Link, Navigate, useParams, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronUp, FolderPlus, Plus, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
import { Tour } from '../components/tour.tsx'
import { LEAVE_ITEM, leaveItem } from '../components/world-transition.ts'
import { CollabSocket } from '../wiki/collab.tsx'
import panelStyles from '../wiki/panel-blocks.module.css'
import { AddBlock, blockOf, kindOf } from '../wiki/panel-blocks.tsx'
import { RelatedOptions } from '../wiki/related-block.tsx'
import { type TabTarget, TabTargetContext, usePageTabs } from '../wiki/tabs/page-tabs.tsx'
import wiki from '../wiki/wiki.module.css'
import { EntryView, pageKey, useSideTop } from '../wiki/wiki.tsx'
import pageStyles from '../wiki/world-page.module.css'
import { useRememberedPanel, WorldPageContext, type WorldPageValue } from '../wiki/world-page.ts'
import styles from './editor.module.css'
import { FieldsEditor, withNewField } from './fields.tsx'
import { useTemplates } from './picker.tsx'
import { Grip, moved, useReorder } from './reorder.tsx'
import { type SideDialog, SideDialogView, TemplateSideTree } from './side-tree.tsx'

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
  // Al pasar a otra (desde el árbol, al duplicar o renombrar), la de antes se queda hasta que llega la nueva, como
  // entre páginas del mundo: sin hueco
  const shown = useRef<{ page: Page; template: Listed } | null>(null)
  if (page.data && template && page.data.id === opened.data?.pageId) shown.current = { page: page.data, template }
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const gone =
    (opened.error instanceof ApiError && opened.error.status === 404) ||
    (templates.data && !template && !templates.isFetching)
  // Una que no está (o que se borró) lleva a la lista
  if (gone) return <Navigate to="/plantillas" replace />
  const ready = page.data && template && page.data.id === opened.data?.pageId
  const before = shown.current
  return (
    <TemplateLayout current={template} all={templates.data?.templates ?? []} folders={templates.data?.folders ?? []}>
      {ready && page.data && template ? (
        <TemplatePage key={template.id} page={page.data} template={template} nuevo={nuevo === true} pestana={pestana} />
      ) : failed(opened) || failed(page) ? (
        <LoadError error={opened.error ?? page.error} onRetry={() => (opened.error ? opened : page).refetch()} />
      ) : before ? (
        <TemplatePage
          key={before.template.id}
          page={before.page}
          template={before.template}
          nuevo={false}
          pestana={undefined}
        />
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
  // Un cuadro cada vez, con su número: el que se va (tras su salida) solo se cierra a sí mismo, no al que se abrió
  // mientras tanto
  const [dialog, setOpenDialog] = useState<{ which: SideDialog; n: number } | null>(null)
  const opened = useRef(0)
  const setDialog = (which: SideDialog) => {
    opened.current += 1
    setOpenDialog({ which, n: opened.current })
  }
  useSideTop(root, true)
  // El mismo esqueleto que una página del mundo (la portada detrás del título, las pestañas debajo y el panel que se
  // pliega), recordando si va plegado como allí
  const [panelFolded, setPanelFolded] = useRememberedPanel()
  const worldPage = useMemo<WorldPageValue>(() => ({ panelFolded, setPanelFolded }), [panelFolded, setPanelFolded])
  return (
    <div ref={root} className={`${wiki.wiki} ${pageStyles.wiki}`} data-world-page="">
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
          {/* El rótulo pequeño y gris de la ficha del árbol de un mundo, en el mismo sitio */}
          <div className={wiki.asideTitle}>
            <h2 id={headingId}>{t('templates.listLabel')}</h2>
          </div>
          <div className={styles.headTools}>
            <button
              type="button"
              className={wiki.newPageIcon}
              aria-label={t('templates.newFolder')}
              title={t('templates.newFolder')}
              aria-haspopup="dialog"
              onClick={() => setDialog({ kind: 'new-folder', parentId: null, label: t('templates.newFolder') })}
            >
              <FolderPlus aria-hidden="true" size={16} />
            </button>
            <button
              type="button"
              className={wiki.newPageIcon}
              aria-label={t('templates.new')}
              title={t('templates.new')}
              aria-haspopup="dialog"
              // En la carpeta de la abierta
              onClick={() => setDialog({ kind: 'new-template', folderId: current?.folderId ?? null })}
            >
              <Plus aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
        <TemplateSideTree folders={folders} templates={all} current={current?.id} onDialog={setDialog} />
      </aside>
      {dialog && (
        <SideDialogView
          key={dialog.n}
          dialog={dialog.which}
          folders={folders}
          onClose={() => setOpenDialog((now) => (now?.n === dialog.n ? null : now))}
        />
      )}
      <div className={`${wiki.content} ${styles.content}`}>
        <WorldPageContext value={worldPage}>
          <CollabSocket>{children}</CollabSocket>
        </WorldPageContext>
      </div>
    </div>
  )
}

/** La página de la plantilla, con sus pestañas llevando a la plantilla (no a la wiki de un mundo) */
function TemplatePage({
  page,
  template,
  nuevo,
  pestana
}: {
  page: Page
  template: Listed
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
        template={{ id: template.id, side: <TemplateSide template={template} page={page} /> }}
      />
    </TabTargetContext.Provider>
  )
}

/**
 * El panel de la plantilla: sus campos (nombre y tipo) y los bloques de su panel, que se definen. Se guarda solo, en
 * fila; mientras quede algo por guardar, lo que llega de fuera no pisa lo de aquí
 */
function TemplateSide({ template, page }: { template: PageTemplate; page: Page }) {
  const { t } = useTranslation()
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
  // El campo desplegado (sus opciones) y el recién añadido (con el foco en su nombre)
  const [openField, setOpenField] = useState<string | null>(null)
  const [freshField, setFreshField] = useState<string | null>(null)
  // «Añadir bloque › Propiedad» o «› Etiquetas»: un campo, como una propiedad de una página
  const addField = (kind: 'tags' | 'property') => {
    const added = withNewField(draft.fields, kind, t('templateEditor.newField', { n: draft.fields.length + 1 }))
    if (added.fields.length !== draft.fields.length) change({ fields: added.fields })
    setOpenField(added.key)
    setFreshField(added.key)
  }
  const fields = (
    <FieldsEditor
      fields={draft.fields}
      readOnly={page.locked}
      open={openField}
      fresh={freshField}
      onOpen={(key) => {
        setOpenField(key)
        setFreshField(null)
      }}
      onChange={(next: PageProperty[]) => change({ fields: next })}
    />
  )
  return (
    <div className={styles.side}>
      <BlocksEditor
        blocks={draft.panel}
        properties={fields}
        empty={draft.fields.length === 0}
        readOnly={page.locked}
        onChange={(panel) => change({ panel })}
        onAddProperty={addField}
      />
      <FormError message={save.error ? errorText(save.error) : null} />
    </div>
  )
}

/** Los bloques del panel de la plantilla: se añaden, se titulan, se recolocan y se quitan; las tablas, con sus desplegables */
function BlocksEditor({
  blocks,
  properties,
  empty,
  readOnly,
  onChange,
  onAddProperty
}: {
  blocks: readonly PanelBlock[]
  /** Los campos, como las propiedades de una página: arriba, o tras la imagen si el panel empieza por una */
  properties: ReactNode
  /** Sin campos: con el panel sin bloques, «Panel vacío» como en una página */
  empty: boolean
  readOnly: boolean
  onChange: (blocks: PanelBlock[]) => void
  onAddProperty: (kind: 'tags' | 'property') => void
}) {
  const { t } = useTranslation()
  // El bloque desplegado (sus opciones), como un campo
  const [open, setOpen] = useState<string | null>(null)
  const update = (index: number, patch: Partial<PanelBlock>) =>
    onChange(blocks.map((block, i) => (i === index ? ({ ...block, ...patch } as PanelBlock) : block)))
  const reorder = (from: number, to: number) => onChange(moved(blocks, from, to))
  const drag = useReorder(reorder)
  const lead = blocks[0]?.type === 'image'
  const row = (block: PanelBlock, index: number) => {
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
                <button type="button" disabled={index === blocks.length - 1} onClick={() => reorder(index, index + 1)}>
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
  }
  return (
    <>
      {/* El retrato (o la imagen del lugar) va arriba del todo, antes que los campos, como en una página */}
      {!lead && properties}
      {empty && blocks.length === 0 && (
        <div className={panelStyles.empty}>
          <p className={panelStyles.emptyTitle}>{t('panelBlocks.empty')}</p>
          <p>{t('panelBlocks.emptyHint')}</p>
        </div>
      )}
      {blocks.length > 0 && (
        <section className={styles.block} aria-label={t('templates.inPanel')}>
          {lead ? (
            <>
              <ul className={styles.fields}>{blocks.slice(0, 1).map((block) => row(block, 0))}</ul>
              {properties}
              <ul className={styles.fields}>{blocks.slice(1).map((block, i) => row(block, i + 1))}</ul>
            </>
          ) : (
            <ul className={styles.fields}>{blocks.map(row)}</ul>
          )}
        </section>
      )}
      {/* «Añadir bloque», el de una página: sus datos (Etiquetas y Propiedad, que son campos) y los bloques */}
      {!readOnly && (
        <AddBlock
          onAdd={(kind) => {
            const block = blockOf(kind)
            onChange([...blocks, block])
            setOpen(block.id)
          }}
          onAddProperty={onAddProperty}
        />
      )}
    </>
  )
}
