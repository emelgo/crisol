/**
 * «Plantillas», en la zona de Mis mundos (ADR-0009): las tuyas y las de serie (con su candado), cada una con su
 * engranaje; el de las de serie, para copiarlas. Al pasar por una, a la izquierda, lo que trae. «Plantilla nueva» va como un recuadro más, tras las tuyas
 */
import type { PageTemplate } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Copy, Lock, Plus, Settings } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import cards from '../routes/world-card.module.css'
import { TEMPLATE_ICON } from './icons.tsx'
import { useTemplates } from './picker.tsx'
import styles from './screen.module.css'

/** Lo que la describe en su tarjeta: de cuál se copió, o desde cero */
function useOrigin() {
  const { t } = useTranslation()
  const templates = useTemplates().data?.templates ?? []
  return (template: PageTemplate) => {
    if (template.builtIn) {
      return template.fields
        .slice(0, 3)
        .map((field) => field.name)
        .join(', ')
    }
    const base = templates.find((each) => each.id === template.basedOn)
    return base ? t('templates.copyOf', { name: base.name }) : t('templates.fromScratch')
  }
}

export function TemplatesScreen() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  const templates = useTemplates()
  const [hovered, setHovered] = useState<string | null>(null)
  const [creating, setCreating] = useState<{ copyOf: string | null } | null>(null)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const all = templates.data?.templates ?? []
  const mine = all.filter((template) => !template.builtIn)
  const builtIn = all.filter((template) => template.builtIn)
  const preview = all.find((template) => template.id === hovered)
  return (
    <Screen
      title={t('templates.title')}
      left={preview && <TemplatePreview template={preview} />}
      leftLabel={t('templates.preview')}
    >
      {failed(templates) && <LoadError error={templates.error} onRetry={() => templates.refetch()} />}
      {templates.data && (
        <>
          <h2 className={styles.section}>{t('templates.mine')}</h2>
          <ul className={styles.grid} aria-label={t('templates.mine')} data-tour="plantillas-tuyas">
            {mine.map((template) => (
              <TemplateCard key={template.id} template={template} onHover={setHovered} />
            ))}
            <li>
              <button
                type="button"
                className={styles.newCard}
                data-tour="plantillas-nueva"
                onClick={() => setCreating({ copyOf: null })}
              >
                <Plus aria-hidden="true" size={22} />
                {t('templates.new')}
              </button>
            </li>
          </ul>
          <h2 className={styles.section}>{t('templates.builtIn')}</h2>
          <ul className={styles.grid} aria-label={t('templates.builtIn')} data-tour="plantillas-serie">
            {builtIn.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onHover={setHovered}
                onCopy={() => setCreating({ copyOf: template.id })}
              />
            ))}
          </ul>
        </>
      )}
      {creating && <NewTemplateDialog copyOf={creating.copyOf} onClose={() => setCreating(null)} />}
      {templates.data && (
        <Tour
          id="plantillas"
          steps={[
            { target: '[data-tour="plantillas-nueva"]', text: t('tour.templates.create') },
            { target: '[data-tour="plantillas-serie"]', text: t('tour.templates.builtIn') }
          ]}
        />
      )}
    </Screen>
  )
}

function TemplateCard({
  template,
  onHover,
  onCopy
}: {
  template: PageTemplate
  onHover: (id: string | null) => void
  onCopy?: () => void
}) {
  const { t } = useTranslation()
  const origin = useOrigin()
  const [settings, setSettings] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  const Icon = TEMPLATE_ICON[template.icon]
  return (
    <li
      className={styles.card}
      onPointerEnter={() => onHover(template.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={(event) => {
        // El foco en su ventana no vuelve a sacar la vista previa
        if (!(event.target as Element).closest('dialog')) onHover(template.id)
      }}
    >
      {template.builtIn && <Lock className={styles.lock} size={14} aria-label={t('templates.locked')} />}
      <span className={styles.icon} aria-hidden="true">
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <h3 className={styles.name}>
        <Link to="/plantillas/$templateId" params={{ templateId: template.id }} className={styles.open}>
          {template.name}
        </Link>
      </h3>
      <p className={styles.meta}>{origin(template)}</p>
      <div className={styles.foot}>
        {/* Sus acciones, en su engranaje, siempre a la vista (docs/diseno.md); en las de serie, «Copiar» */}
        <button
          ref={gear}
          type="button"
          className={styles.gear}
          aria-label={t('templates.settingsOf', { name: template.name })}
          title={t('templates.settingsOf', { name: template.name })}
          aria-haspopup="dialog"
          onClick={() => {
            // Con su ventana encima, la vista previa de al lado se quita (docs/diseno.md)
            onHover(null)
            setSettings(true)
          }}
        >
          <Settings size={16} aria-hidden="true" />
        </button>
      </div>
      {settings &&
        (template.builtIn ? (
          <BuiltInWindow
            template={template}
            onClose={(copy) => {
              setSettings(false)
              if (copy) onCopy?.()
              else gear.current?.focus()
            }}
          />
        ) : (
          <TemplateSettings
            template={template}
            onClose={(gone) => {
              setSettings(false)
              if (!gone) gear.current?.focus()
            }}
          />
        ))}
    </li>
  )
}

/** La ventana de una de serie: no se cambia, se copia. onClose(copy): si se pidió copiarla */
function BuiltInWindow({ template, onClose }: { template: PageTemplate; onClose: (copy: boolean) => void }) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const copy = useRef(false)
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(copy.current)}>
      <div className={cards.form}>
        <h2 id={titleId}>{template.name}</h2>
        <p className={styles.builtInNote}>
          <Lock size={14} aria-hidden="true" />
          {t('templateEditor.builtInNote')}
        </p>
        <dl className={styles.rows}>
          <div>
            <dt>{t('templates.copy')}</dt>
            <dd>
              {t('templates.copyHint')}
              <button
                type="button"
                className={styles.rowAction}
                onClick={() => {
                  copy.current = true
                  dialog.current?.close()
                }}
              >
                <Copy size={14} aria-hidden="true" />
                {t('templates.copy')}
              </button>
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  )
}

/** Lo que trae una plantilla, a un lado: sus campos con su tipo, los bloques de su panel y los apartados del texto */
function TemplatePreview({ template }: { template: PageTemplate }) {
  const { t } = useTranslation()
  const origin = useOrigin()
  const Icon = TEMPLATE_ICON[template.icon]
  const sections = [...template.skeleton.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1] ?? '')
  const blocks = template.panel.map((block) =>
    'title' in block && block.title
      ? block.title
      : t(`panelBlocks.kinds.${block.type === 'meter' ? block.style : block.type}`)
  )
  return (
    <div className={styles.preview}>
      <div className={styles.previewTop}>
        <span className={styles.icon} aria-hidden="true">
          <Icon size={20} strokeWidth={1.5} />
        </span>
        <div>
          <p className={styles.previewName}>{template.name}</p>
          <p className={styles.meta}>{origin(template)}</p>
        </div>
      </div>
      <p className={styles.label}>{t('templates.fields')}</p>
      <ul className={styles.list}>
        {template.fields.map((field) => (
          <li key={field.field ?? field.name}>
            {field.name}
            <span>{t(`properties.types.${field.type}`)}</span>
          </li>
        ))}
        {template.fields.length === 0 && <li className={styles.none}>{t('templates.none')}</li>}
      </ul>
      <p className={styles.label}>{t('templates.inPanel')}</p>
      <ul className={styles.list}>
        {blocks.map((block, i) => (
          <li key={template.panel[i]?.id ?? block}>{block}</li>
        ))}
        {blocks.length === 0 && <li className={styles.none}>{t('templates.none')}</li>}
      </ul>
      <p className={styles.label}>{t('templates.inText')}</p>
      <ul className={styles.list}>
        {sections.map((section) => (
          <li key={section}>{section}</li>
        ))}
        {sections.length === 0 && <li className={styles.none}>{t('templates.none')}</li>}
      </ul>
    </div>
  )
}

/** Elegir el icono de una plantilla: un grupo de opciones */
export function IconChoices({
  value,
  onChange
}: {
  value: PageTemplate['icon']
  onChange: (icon: PageTemplate['icon']) => void
}) {
  const { t } = useTranslation()
  const name = useId()
  return (
    <fieldset className={styles.icons}>
      <legend>{t('templates.icon')}</legend>
      {(Object.keys(TEMPLATE_ICON) as PageTemplate['icon'][]).map((icon) => {
        const Icon = TEMPLATE_ICON[icon]
        return (
          <label key={icon} className={styles.iconChoice} title={t(`templates.icons.${icon}`)}>
            <input
              type="radio"
              name={name}
              checked={value === icon}
              aria-label={t(`templates.icons.${icon}`)}
              onChange={() => onChange(icon)}
            />
            <Icon size={18} aria-hidden="true" />
          </label>
        )
      })}
    </fieldset>
  )
}

/** «Plantilla nueva»: desde cero o copiando otra, con su nombre y su icono. Creada, se abre para cambiarla */
export function NewTemplateDialog({ copyOf, onClose }: { copyOf: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const baseId = useId()
  const templates = useTemplates().data?.templates ?? []
  const [mode, setMode] = useState<'scratch' | 'copy'>(copyOf ? 'copy' : 'scratch')
  const [base, setBase] = useState(copyOf ?? templates[0]?.id ?? 'pnj')
  const chosen = templates.find((each) => each.id === base)
  const [name, setName] = useState(chosen && copyOf ? t('templates.copyName', { name: chosen.name }) : '')
  const [icon, setIcon] = useState<PageTemplate['icon']>(chosen && copyOf ? chosen.icon : 'template')
  useEffect(() => {
    if (mode === 'copy' && chosen) setIcon(chosen.icon)
  }, [mode, chosen])
  const create = useMutation({
    mutationFn: () =>
      api.call('createTemplate', { name: name.trim(), icon, ...(mode === 'copy' ? { copyOf: base } : {}) }),
    onSuccess: async (created) => {
      // Ya en la lista, para que su página la encuentre al abrirse (la lista de verdad llega después)
      queryClient.setQueryData(['templates'], (old: { templates: PageTemplate[]; deleted: unknown[] } | undefined) =>
        old ? { ...old, templates: [...old.templates.filter((each) => each.id !== created.id), created] } : old
      )
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      dialog.current?.close()
      onClose()
      await navigate({ to: '/plantillas/$templateId', params: { templateId: created.id } })
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={onClose}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) create.mutate()
        }}
      >
        <h2 id={titleId}>{t('templates.new')}</h2>
        <fieldset className={styles.modes}>
          <legend className={styles.hidden}>{t('templates.how')}</legend>
          {(['scratch', 'copy'] as const).map((each) => (
            <label key={each} className={styles.mode}>
              <input type="radio" name={`${titleId}-modo`} checked={mode === each} onChange={() => setMode(each)} />
              {each === 'scratch' ? <Plus size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              {t(each === 'scratch' ? 'templates.fromScratch' : 'templates.copying')}
            </label>
          ))}
        </fieldset>
        {mode === 'copy' && (
          <div className={styles.baseField}>
            <label htmlFor={baseId}>{t('templates.copyWhich')}</label>
            <select id={baseId} value={base} onChange={(event) => setBase(event.currentTarget.value)}>
              {templates.map((each) => (
                <option key={each.id} value={each.id}>
                  {each.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Field
          label={t('templates.name')}
          value={name}
          required
          maxLength={60}
          autoComplete="off"
          data-autofocus=""
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <IconChoices value={icon} onChange={setIcon} />
        <FormError message={create.error ? errorText(create.error) : null} />
        <BusyButton type="submit" className={form.button} busy={create.isPending}>
          {t('templates.create')}
        </BusyButton>
      </form>
    </Modal>
  )
}

/** La ventana de una plantilla tuya: su nombre, su icono y borrarla. onClose(gone): si se borró */
function TemplateSettings({ template, onClose }: { template: PageTemplate; onClose: (gone: boolean) => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const gone = useRef(false)
  const [name, setName] = useState(template.name)
  const [icon, setIcon] = useState(template.icon)
  const changed = name.trim() !== template.name || icon !== template.icon
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['templates'] })
  const save = useMutation({
    mutationFn: async () => {
      await api.call('updateTemplate', {
        templateId: template.id,
        ...(name.trim() !== template.name ? { name: name.trim() } : {}),
        ...(icon !== template.icon ? { icon } : {})
      })
      await refresh()
    },
    onSuccess: () => dialog.current?.close()
  })
  const remove = async () => {
    await api.call('deleteTemplate', { templateId: template.id })
    gone.current = true
    dialog.current?.close()
    await refresh()
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed && name.trim()) save.mutate()
        }}
      >
        <h2 id={titleId}>{t('templates.settingsOf', { name: template.name })}</h2>
        <Field
          label={t('templates.name')}
          value={name}
          required
          maxLength={60}
          autoComplete="off"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <IconChoices value={icon} onChange={setIcon} />
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('templates.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(template.name)
              setIcon(template.icon)
            }}
          >
            {t('templates.cancel')}
          </button>
        </ChangesBar>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={template.name}
            action={t('templates.delete')}
            title={t('templates.deleteTitle', { name: template.name })}
            warning={t('templates.deleteWarning')}
            label={t('templates.name')}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}
