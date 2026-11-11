/**
 * Elegir una plantilla (al crear una página o una pestaña, o desde un enlace sin resolver): por carpetas, con un
 * buscador. Es un grupo de opciones: las flechas pasan de una a otra
 */
import type { TemplateView } from '@crisol/contracts'
import { fieldKey } from '@crisol/domain'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { TemplateIcon } from './icons.tsx'
import styles from './picker.module.css'
import { templateGroups } from './tree.ts'

/** Las plantillas que se pueden usar */
export function useTemplates() {
  const api = useApi()
  return useQuery({ queryKey: ['templates'], queryFn: () => api.call('listTemplates', {}) })
}

/**
 * La lista de plantillas al crear una página o una pestaña (ADR-0024): un buscador y sus filas por carpetas (con su
 * camino), que se eligen como opciones; cada una con sus pestañas y cuántos campos trae
 */
export function TemplatePicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { t } = useTranslation()
  const name = useId()
  const data = useTemplates().data
  const [query, setQuery] = useState('')
  const shown = (data?.templates ?? []).filter(
    (template) => !query.trim() || fieldKey(template.name).includes(fieldKey(query))
  )
  const groups = templateGroups(data?.folders ?? [], shown)
  // Sin elegir, la primera de la lista
  const first = groups[0]?.templates[0]?.id
  useEffect(() => {
    if (!value && first) onChange(first)
  }, [value, first, onChange])
  const hintOf = (template: TemplateView) =>
    [
      [t('pageTabs.text'), ...template.tabs.map((tab) => tab.name)].join(', '),
      t('templates.fieldsCount', { count: template.fields.length })
    ].join(' · ')
  return (
    <div className={styles.picker}>
      <label className={styles.search}>
        <Search size={15} aria-hidden="true" />
        <input
          value={query}
          placeholder={t('templates.search')}
          aria-label={t('templates.search')}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <fieldset className={styles.list}>
        <legend className={styles.hidden}>{t('templates.label')}</legend>
        {groups.map((group) => (
          <div key={group.id ?? 'arriba'} className={styles.group}>
            {(group.label ?? (groups.length > 1 ? t('templates.loose') : null)) && (
              <p className={styles.groupLabel} aria-hidden="true">
                {group.label ?? t('templates.loose')}
              </p>
            )}
            {group.templates.map((template) => {
              return (
                <label key={template.id} className={styles.row}>
                  <input
                    type="radio"
                    name={name}
                    value={template.id}
                    checked={value === template.id}
                    onChange={() => onChange(template.id)}
                  />
                  <span className={styles.icon} aria-hidden="true">
                    <TemplateIcon icon={template.icon} size={16} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{template.name}</span>
                    <span className={styles.hint}>{hintOf(template)}</span>
                  </span>
                </label>
              )
            })}
          </div>
        ))}
        {groups.length === 0 && (
          <p className={styles.none}>{data?.templates.length ? t('templates.noneFound') : t('templates.empty')}</p>
        )}
      </fieldset>
    </div>
  )
}
