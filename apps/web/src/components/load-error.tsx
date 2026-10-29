import type { UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useErrorText } from '../api/errors.ts'
import { FormError } from './field.tsx'
import list from './list.module.css'
import { PageTitle } from './page-title.tsx'

/** Si una consulta se ha quedado sin datos porque falló. Sin datos pero cargando (o reintentando), aún no */
export function failed(query: Pick<UseQueryResult, 'data' | 'isError' | 'isFetching'>) {
  return query.data === undefined && query.isError && !query.isFetching
}

/** La página, cuando no llega lo que necesita (el servidor o la red han fallado): lo dice y deja reintentarlo */
export function LoadError({ error, onRetry }: { error: unknown; onRetry(): void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  return (
    <section>
      <PageTitle>{t('load.title')}</PageTitle>
      <FormError message={errorText(error)} />
      <button type="button" className={list.secondary} onClick={onRetry}>
        {t('load.retry')}
      </button>
    </section>
  )
}
