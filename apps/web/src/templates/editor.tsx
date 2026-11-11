/**
 * Una plantilla abierta (/plantillas/:id), con el esqueleto común (Screen) y la forma de una página (ADR-0009): su
 * icono y su nombre arriba, sus campos y los bloques de su panel en la ficha de la derecha, y en la de la izquierda las
 * demás plantillas. Todo se guarda solo. Las de
 * serie se ven igual, sin poder cambiarlas, con «Copiar»
 */
import type { PageProperty, PageTemplate, PanelBlock } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useParams } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, Copy, LayoutTemplate, Lock, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { FormError } from '../components/field.tsx'
import { PageTitle } from '../components/page-title.tsx'
import layout from '../components/screen.module.css'
import { Screen } from '../components/screen.tsx'
import { itemTransition, SECTION } from '../components/world-transition.ts'
import { blockOf, type Kind, kindOf, PANEL_GROUPS } from '../wiki/panel-blocks.tsx'
import { RelatedOptions } from '../wiki/related-block.tsx'
import styles from './editor.module.css'
import { FieldsEditor } from './fields.tsx'
import { TEMPLATE_ICON } from './icons.tsx'
import { useTemplates } from './picker.tsx'
import { NewTemplateDialog } from './screen.tsx'
import { SkeletonEditor } from './skeleton.tsx'

type Patch = Partial<Pick<PageTemplate, 'name' | 'fields' | 'panel' | 'skeleton'>>

export function TemplateView() {
  const { account, pending } = useAccounts().useAccount()
  const { templateId } = useParams({ strict: false }) as { templateId: string }
  const templates = useTemplates()
  const template = templates.data?.templates.find((each) => each.id === templateId)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  // Una que no está (o que se borró) lleva a la lista; mientras la lista se está pidiendo, se espera
  if (templates.data && !template && !templates.isFetching) return <Navigate to="/plantillas" replace />
  if (!template) return null
  return <TemplateEditor key={template.id} template={template} all={templates.data?.templates ?? []} />
}

function TemplateEditor({ template, all }: { template: PageTemplate; all: readonly PageTemplate[] }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const readOnly = false
  const [draft, setDraft] = useState(template)
  const [copying, setCopying] = useState(false)
  // Los guardados van en fila; mientras quede alguno, lo que llega de fuera no pisa lo de aquí
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const inFlight = useRef(0)
  const [state, setState] = useState<'saved' | 'saving'>('saved')
  useEffect(() => {
    if (inFlight.current === 0) setDraft(template)
  }, [template])
  const save = useMutation({
    mutationFn: (patch: Patch) => {
      inFlight.current++
      setState('saving')
      const run = queue.current
        .catch(() => undefined)
        .then(() => api.call('updateTemplate', { templateId: template.id, ...patch }))
        .finally(() => {
          inFlight.current--
          if (inFlight.current === 0) setState('saved')
        })
      queue.current = run
      return run
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  })
  const change = (patch: Patch) => {
    setDraft((current) => ({ ...current, ...patch }))
    save.mutate(patch)
  }
  const Icon = TEMPLATE_ICON[draft.icon]
  const mine = all
  return (
    <Screen
      left={
        <div className={styles.list}>
          <p className={styles.listHead}>{t('templates.mine')}</p>
          <TemplateLinks templates={mine} current={template.id} />
        </div>
      }
      leftLabel={t('templates.title')}
      right={
        <div className={styles.panel}>
          <FieldsEditor
            fields={draft.fields}
            readOnly={readOnly}
            onChange={(fields: PageProperty[]) => change({ fields })}
          />
          <BlocksEditor blocks={draft.panel} readOnly={readOnly} onChange={(panel) => change({ panel })} />
        </div>
      }
      rightLabel={t('templateEditor.panel')}
    >
      {/* El título, donde en las demás pantallas: su icono, su nombre y, junto a él, «Plantilla» */}
      <div className={layout.top}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden="true" style={itemTransition(template.id, 'icono')}>
            <Icon size={22} strokeWidth={1.5} />
          </span>
          <div style={itemTransition(template.id, 'nombre')}>
            {readOnly ? (
              <PageTitle>{draft.name}</PageTitle>
            ) : (
              <TitleInput name={draft.name} onCommit={(name) => change({ name })} />
            )}
          </div>
          <span className={styles.kind}>
            <LayoutTemplate size={14} aria-hidden="true" />
            {t('templateEditor.kind')}
          </span>
        </div>
        <span className={styles.status} role="status">
          {readOnly ? '' : t(state === 'saving' ? 'templateEditor.saving' : 'templateEditor.saved')}
        </span>
      </div>
      {readOnly && (
        <p className={styles.note}>
          <Lock size={14} aria-hidden="true" />
          {t('templateEditor.builtInNote')}
          <button type="button" className={styles.copy} onClick={() => setCopying(true)}>
            <Copy size={14} aria-hidden="true" />
            {t('templates.copy')}
          </button>
        </p>
      )}
      <FormError message={save.error ? errorText(save.error) : null} />
      <div className={styles.skeleton}>
        <SkeletonEditor
          skeleton={template.skeleton}
          readOnly={readOnly}
          onChange={(skeleton) => change({ skeleton })}
        />
      </div>
      {copying && <NewTemplateDialog copyOf={template.id} onClose={() => setCopying(false)} />}
    </Screen>
  )
}

function TemplateLinks({ templates, current }: { templates: readonly PageTemplate[]; current: string }) {
  return (
    <ul className={styles.links}>
      {templates.map((each) => {
        const Icon = TEMPLATE_ICON[each.icon]
        return (
          <li key={each.id}>
            <Link
              to="/plantillas/$templateId"
              params={{ templateId: each.id }}
              aria-current={each.id === current ? 'page' : undefined}
              // De una a otra, como entre pestañas: rápido
              viewTransition={SECTION}
            >
              <Icon size={15} aria-hidden="true" />
              {each.name}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** El nombre, como el título de una página: se cambia en el sitio (Intro o salir lo guardan, Escape lo deja) */
function TitleInput({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(name)
  useEffect(() => setValue(name), [name])
  // Como PageTitle: el nombre, también en la pestaña del navegador
  useEffect(() => {
    document.title = t('app.pageTitle', { page: name })
  }, [name, t])
  return (
    // El encabezado se llama como la plantilla: su nombre se escribe dentro
    <h1 className={styles.title} tabIndex={-1} aria-label={value || name}>
      <input
        className={styles.titleInput}
        aria-label={t('templates.name')}
        value={value}
        // Del ancho de su texto: «Plantilla» va siempre junto al nombre
        size={Math.max(value.length, 4)}
        maxLength={60}
        onChange={(event) => setValue(event.currentTarget.value)}
        onBlur={() => {
          const trimmed = value.trim()
          if (trimmed && trimmed !== name) onCommit(trimmed)
          else setValue(name)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setValue(name)
            event.currentTarget.blur()
          }
        }}
      />
    </h1>
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
