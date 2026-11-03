/**
 * «Aplicar plantilla…» en «⋯» de una página ya hecha (ADR-0009): se elige la plantilla y se ve lo que añade (campos,
 * bloques y apartados al final), con lo que ya tiene marcado. No se borra nada
 */
import type { Page, PageTemplate } from '@crisol/contracts'
import { applyTemplate, type PageTemplate as DomainTemplate } from '@crisol/domain'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { Modal } from '../components/modal.tsx'
import cards from '../routes/world-card.module.css'
import { TemplatePicker, useTemplates } from '../templates/picker.tsx'
import styles from './apply-template.module.css'

export function ApplyTemplate({ page }: { page: Page }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={list.secondary}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {t('applyTemplate.open')}
      </button>
      {open && (
        <ApplyDialog
          page={page}
          onClose={() => {
            setOpen(false)
            trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

function ApplyDialog({ page, onClose }: { page: Page; onClose: () => void }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const templates = useTemplates().data?.templates ?? []
  const [chosen, setChosen] = useState<string | null>(page.template)
  const template = templates.find((each) => each.id === chosen)
  // Los títulos que ya tiene el texto, para no repetir sus apartados
  const read = useQuery({
    queryKey: ['pages', page.worldId, 'markdown', page.id],
    queryFn: () => api.call('readPage', { pageId: page.id })
  })
  const headings = [...(read.data?.markdown ?? '').matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((m) => m[1] ?? '')
  const preview = template
    ? applyTemplate(
        template as unknown as DomainTemplate,
        { properties: page.properties, panel: page.panel, headings },
        () => 'vista'
      )
    : null
  const apply = useMutation({
    mutationFn: () => api.call('editPage', { pageId: page.id, template: chosen ?? '' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', page.worldId] })
      dialog.current?.close()
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={`${cards.dialog} ${styles.dialog}`} onClose={onClose}>
      <div className={cards.form}>
        <h2 id={titleId}>{t('applyTemplate.title')}</h2>
        <div className={styles.columns}>
          <TemplatePicker value={chosen} onChange={setChosen} />
          {preview && template && <Summary template={template} preview={preview} />}
        </div>
        <FormError message={apply.error ? errorText(apply.error) : null} />
        <BusyButton
          type="button"
          className={form.button}
          busy={apply.isPending}
          disabled={!template || !read.data}
          onClick={() => apply.mutate()}
        >
          {t('applyTemplate.apply', { name: template?.name ?? '' })}
        </BusyButton>
      </div>
    </Modal>
  )
}

function Summary({ template, preview }: { template: PageTemplate; preview: ReturnType<typeof applyTemplate> }) {
  const { t } = useTranslation()
  return (
    <section className={styles.summary} aria-label={t('applyTemplate.summary', { name: template.name })}>
      <p className={styles.label}>{t('templates.fields')}</p>
      <ul className={styles.list}>
        {preview.fields.map((field) => (
          <li key={field.name} data-added={field.added || undefined}>
            {field.added ? <Plus size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {field.name}
            {!field.added && <span className={styles.has}>{t('applyTemplate.has')}</span>}
          </li>
        ))}
        {preview.fields.length === 0 && <li className={styles.none}>{t('templates.none')}</li>}
      </ul>
      <p className={styles.label}>{t('templates.inPanel')}</p>
      <ul className={styles.list}>
        {preview.blocks.map((block) => (
          <li key={block} data-added="">
            <Plus size={14} aria-hidden="true" />
            {block}
          </li>
        ))}
        {preview.blocks.length === 0 && <li className={styles.none}>{t('applyTemplate.nothing')}</li>}
      </ul>
      <p className={styles.label}>{t('applyTemplate.atTheEnd')}</p>
      <ul className={styles.list}>
        {preview.sections.map((section) => (
          <li key={section} data-added="">
            <Plus size={14} aria-hidden="true" />
            {section}
          </li>
        ))}
        {preview.sections.length === 0 && <li className={styles.none}>{t('applyTemplate.nothing')}</li>}
      </ul>
    </section>
  )
}
