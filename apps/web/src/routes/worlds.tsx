import { TRASH_DAYS } from '@crisol/domain'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { CreateDialog } from '../components/create-dialog.tsx'
import { FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import cards from './world-card.module.css'
import { WorldCard } from './world-card.tsx'

export function Worlds() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const { account, pending } = useAccounts().useAccount()
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.call('listOrganizations', {}),
    enabled: Boolean(account)
  })
  const worlds = useQuery({
    queryKey: ['worlds'],
    queryFn: () => api.call('listWorlds', {}),
    enabled: Boolean(account)
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['worlds'] })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const canCreate = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false

  const createWorld = (name: string) => api.call('createWorld', { name }).then(refresh)
  const newWorld = (big: boolean) => (
    <CreateDialog
      trigger={t(big ? 'worlds.createFirst' : 'worlds.newTitle')}
      triggerClassName={big ? `${form.button} ${cards.big}` : undefined}
      title={t('worlds.newTitle')}
      label={t('worlds.name')}
      submit={t('worlds.create')}
      tour="nuevo-mundo"
      onCreate={createWorld}
    />
  )
  const empty = worlds.data?.worlds.length === 0

  return (
    <section className={cards.page}>
      <div className={cards.top}>
        <PageTitle>{t('worlds.title')}</PageTitle>
        {canCreate && !empty && newWorld(false)}
      </div>
      <FormError message={failed(worlds) ? errorText(worlds.error) : null} />
      {!worlds.data && !failed(worlds) && <Loading />}
      {worlds.data &&
        (empty ? (
          // Sin mundos: qué es un mundo y el botón grande para crear el primero
          <div className={cards.empty}>
            <Globe aria-hidden="true" size={44} strokeWidth={1.25} />
            <h2>{t('worlds.empty')}</h2>
            {!canCreate && <p>{t('worlds.emptyPlayer')}</p>}
            {canCreate && newWorld(true)}
          </div>
        ) : (
          <ul className={cards.list} aria-label={t('worlds.listLabel')}>
            {worlds.data.worlds.map((world) => (
              <WorldCard key={world.id} world={world} />
            ))}
          </ul>
        ))}
      <Tour
        id="mundos"
        steps={[
          {
            target: '[data-tour="nuevo-mundo"]',
            text: t('tour.worlds.create'),
            also: [{ target: '[data-tour="barra-mundos"]', text: t('tour.worlds.ribbon') }]
          },
          { target: '[data-tour="barra-historial"]', text: t('tour.worlds.history'), placement: 'right' },
          {
            target: '[data-tour="barra-papelera"]',
            text: t('tour.worlds.trash', { days: TRASH_DAYS }),
            placement: 'right'
          },
          { target: '[data-tour="cuenta"]', text: t('tour.worlds.account'), placement: 'right' }
        ]}
      />
    </section>
  )
}
