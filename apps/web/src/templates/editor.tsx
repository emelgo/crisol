/**
 * Una plantilla abierta (/plantillas/:id, ADR-0024): es una página del mundo oculto de la cuenta, así que se ve y se
 * edita como una página (portada, icono en el título, pestañas, texto y panel), con lo suyo: «Plantillas» arriba a la
 * izquierda para volver, la marca «Plantilla» junto al título, sin «Quién la conoce», «Marcar» ni «Mencionado en», y
 * en el panel sus campos y sus bloques, que se definen en vez de rellenarse. A la izquierda, las demás, para saltar
 */
import type { Page, PageProperty, PageTemplate, PanelBlock } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronUp, Plus, Settings, Trash2 } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { FormError } from '../components/field.tsx'
import { failed, LoadError } from '../components/load-error.tsx'
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
import { useTemplates } from './picker.tsx'
import { TemplateSettings, useNewTemplate } from './screen.tsx'

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
    <TemplateLayout current={template} all={templates.data?.templates ?? []}>
      {page.data && template ? (
        <TemplatePage key={template.id} page={page.data} template={template} nuevo={nuevo === true} pestana={pestana} />
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
  children
}: {
  current: PageTemplate | undefined
  all: readonly PageTemplate[]
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
          <h2 id={headingId}>{t('templates.mine')}</h2>
          <button
            type="button"
            className={wiki.newPageIcon}
            aria-label={t('templates.new')}
            title={t('templates.new')}
            disabled={create.isPending}
            onClick={() => create.mutate()}
          >
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
        <FormError message={create.errorText} />
        <TemplateLinks templates={all} current={current?.id} />
      </aside>
      <div className={wiki.content}>
        <CollabSocket>{children}</CollabSocket>
      </div>
    </div>
  )
}

function TemplateLinks({ templates, current }: { templates: readonly PageTemplate[]; current: string | undefined }) {
  return (
    <ul className={styles.links}>
      {templates.map((each) => (
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
  template: PageTemplate
  nuevo: boolean
  pestana: string | undefined
}) {
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
      <EntryView
        page={page}
        nuevo={nuevo}
        tabs={all}
        active={active}
        template={{
          id: template.id,
          more: <TemplateMore template={template} />,
          side: <TemplateSide template={template} page={page} />
        }}
      />
    </TabTargetContext.Provider>
  )
}

/** «⋯» de una plantilla: sus ajustes (nombre, icono y borrarla); borrada, a la lista */
function TemplateMore({ template }: { template: PageTemplate }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Settings aria-hidden="true" size={16} />
        {t('templates.settings')}
      </button>
      {open && (
        <TemplateSettings
          template={template}
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
  const update = (index: number, patch: Partial<PanelBlock>) =>
    onChange(blocks.map((block, i) => (i === index ? ({ ...block, ...patch } as PanelBlock) : block)))
  const move = (index: number, by: -1 | 1) => {
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    if (moved) next.splice(index + by, 0, moved)
    onChange(next)
  }
  return (
    <section className={styles.block} aria-label={t('templates.inPanel')}>
      <h2 className={styles.blockTitle}>{t('templates.inPanel')}</h2>
      <ul className={styles.fields}>
        {blocks.map((block, index) => {
          const kind = kindOf(block)
          const label = t(`panelBlocks.kinds.${kind}`)
          return (
            <li key={block.id} className={styles.field}>
              <fieldset className={styles.blockShape} disabled={readOnly}>
                <legend className={styles.hidden}>{('title' in block && block.title) || label}</legend>
                {'title' in block ? (
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
                ) : (
                  <span className={styles.blockName}>{label}</span>
                )}
                {block.type === 'related' && (
                  <RelatedOptions block={block} onChange={(patch) => update(index, patch as Partial<PanelBlock>)} />
                )}
                {!readOnly && (
                  <div className={styles.shapeActions}>
                    <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ChevronUp size={14} aria-hidden="true" />
                      {t('templateEditor.up')}
                    </button>
                    <button type="button" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>
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
            </li>
          )
        })}
      </ul>
      {blocks.length === 0 && <p className={styles.muted}>{t('templates.none')}</p>}
      {!readOnly && (
        <div className={styles.addWrap}>
          <button type="button" className={styles.add} aria-expanded={adding} onClick={() => setAdding(!adding)}>
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
                        onChange([...blocks, blockOf(kind as Kind)])
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
