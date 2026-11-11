/**
 * «Plantillas», en la zona de Mis mundos (ADR-0009, ADR-0024): las de la cuenta, cada una con su engranaje. Al pasar
 * por una, a la izquierda, lo que trae. «Plantilla nueva» va como un recuadro más, tras ellas: crea una y la abre
 */
import type { PageTemplate } from '@crisol/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { useId, useRef, useState } from 'react'
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
import { NewCard } from '../components/new-card.tsx'
import { Screen } from '../components/screen.tsx'
import { Tour } from '../components/tour.tsx'
import { ENTER_ITEM, enterItem, itemTransition } from '../components/world-transition.ts'
import cards from '../routes/world-card.module.css'
import { IconChoices } from '../wiki/icon.tsx'
import { TemplateIcon } from './icons.tsx'
import { useTemplates } from './picker.tsx'
import styles from './screen.module.css'

/** Lo que la describe en su tarjeta: de cuál se copió, o desde cero */
function useOrigin() {
  const { t } = useTranslation()
  const templates = useTemplates().data?.templates ?? []
  return (template: PageTemplate) => {
    const base = templates.find((each) => each.id === template.basedOn)
    return base ? t('templates.copyOf', { name: base.name }) : t('templates.fromScratch')
  }
}

export function TemplatesScreen() {
  const { t } = useTranslation()
  const { account, pending } = useAccounts().useAccount()
  const templates = useTemplates()
  const [hovered, setHovered] = useState<string | null>(null)
  const create = useNewTemplate()
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const all = templates.data?.templates ?? []
  const mine = all
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
            <li className={styles.newItem}>
              <NewCard
                label={t('templates.new')}
                data-tour="plantillas-nueva"
                disabled={create.isPending}
                onClick={() => create.mutate()}
              />
            </li>
          </ul>
          <FormError message={create.errorText} />
        </>
      )}
      {templates.data && (
        <Tour
          id="plantillas"
          steps={[{ target: '[data-tour="plantillas-nueva"]', text: t('tour.templates.create') }]}
        />
      )}
    </Screen>
  )
}

function TemplateCard({ template, onHover }: { template: PageTemplate; onHover: (id: string | null) => void }) {
  const { t } = useTranslation()
  const origin = useOrigin()
  const [settings, setSettings] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
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
      {/* Al volver de ella, su icono y su nombre vuelven aquí desde el título */}
      <span
        className={styles.icon}
        aria-hidden="true"
        data-elemento="icono"
        style={itemTransition(template.id, 'icono')}
      >
        <TemplateIcon icon={template.icon} size={24} />
      </span>
      <h3 className={styles.name}>
        {/* Entrar es entrar: su icono y su nombre viajan al título de la plantilla abierta */}
        <Link
          to="/plantillas/$templateId"
          params={{ templateId: template.id }}
          className={styles.open}
          viewTransition={ENTER_ITEM}
          onClick={(event) => enterItem(template.id, event.currentTarget.closest('li'))}
        >
          <span data-elemento="nombre" style={itemTransition(template.id, 'nombre')}>
            {template.name}
          </span>
        </Link>
      </h3>
      <p className={styles.meta}>{origin(template)}</p>
      <div className={styles.foot}>
        {/* Sus acciones, en su engranaje, siempre a la vista (docs/diseno.md) */}
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
      {settings && (
        <TemplateSettings
          template={template}
          onClose={(gone) => {
            setSettings(false)
            if (!gone) gear.current?.focus()
          }}
        />
      )}
    </li>
  )
}

function TemplatePreview({ template }: { template: PageTemplate }) {
  const { t } = useTranslation()
  const origin = useOrigin()
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
          <TemplateIcon icon={template.icon} size={20} />
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

/** Para comparar nombres como el servidor: sin mayúsculas, tildes ni espacios de más */
const nameKey = (name: string) =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim()

/**
 * «Plantilla nueva»: crea «Plantilla sin título» (con un número si ya hay una así) y la abre con el título listo para
 * escribir, como una página nueva
 */
export function useNewTemplate() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const templates = useTemplates().data?.templates ?? []
  const create = useMutation({
    mutationFn: () => {
      const base = t('templates.untitled')
      const taken = new Set(templates.map((each) => nameKey(each.name)))
      let name = base
      for (let n = 2; taken.has(nameKey(name)); n++) name = `${base} ${n}`
      return api.call('createTemplate', { name })
    },
    onSuccess: async (created) => {
      // Ya en la lista, para que su página la encuentre al abrirse (la lista de verdad llega después)
      queryClient.setQueryData(['templates'], (old: { templates: PageTemplate[]; deleted: unknown[] } | undefined) =>
        old ? { ...old, templates: [...old.templates.filter((each) => each.id !== created.id), created] } : old
      )
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      await navigate({ to: '/plantillas/$templateId', params: { templateId: created.id }, search: { nuevo: true } })
    }
  })
  return {
    mutate: () => create.mutate(),
    isPending: create.isPending,
    errorText: create.error ? errorText(create.error) : null
  }
}

/** La ventana de una plantilla tuya: su nombre, su icono y borrarla. onClose(gone): si se borró */
export function TemplateSettings({ template, onClose }: { template: PageTemplate; onClose: (gone: boolean) => void }) {
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
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
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
