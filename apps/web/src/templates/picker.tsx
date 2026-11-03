/**
 * Elegir una plantilla (al crear una página o desde un enlace sin resolver): las tuyas primero y luego las de serie,
 * con un buscador. Es un grupo de opciones: las flechas pasan de una a otra
 */
import type { PageTemplate } from '@crisol/contracts'
import { fieldKey } from '@crisol/domain'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { TEMPLATE_ICON } from './icons.tsx'
import styles from './picker.module.css'

/** Las plantillas que se pueden usar */
export function useTemplates() {
  const api = useApi()
  return useQuery({ queryKey: ['templates'], queryFn: () => api.call('listTemplates', {}) })
}

/** Lo que la distingue a primera vista: sus primeros campos */
const hintOf = (template: PageTemplate) =>
  template.fields
    .slice(0, 3)
    .map((field) => field.name)
    .join(', ')

export function TemplatePicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { t } = useTranslation()
  const name = useId()
  const templates = useTemplates().data?.templates ?? []
  const [query, setQuery] = useState('')
  const shown = templates.filter((template) => !query.trim() || fieldKey(template.name).includes(fieldKey(query)))
  const groups = [
    { key: 'mine', label: t('templates.mine'), items: shown.filter((template) => !template.builtIn) },
    { key: 'builtIn', label: t('templates.builtIn'), items: shown.filter((template) => template.builtIn) }
  ].filter((group) => group.items.length > 0)
  // Sin elegir, la primera de la lista (las tuyas van delante)
  const first = groups[0]?.items[0]?.id
  useEffect(() => {
    if (!value && first) onChange(first)
  }, [value, first, onChange])
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
          <div key={group.key} className={styles.group}>
            <p className={styles.groupLabel} aria-hidden="true">
              {group.label}
            </p>
            {group.items.map((template) => {
              const Icon = TEMPLATE_ICON[template.icon]
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
                    <Icon size={16} />
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
        {groups.length === 0 && <p className={styles.none}>{t('templates.noneFound')}</p>}
      </fieldset>
    </div>
  )
}
