import { TRASH_DAYS } from '@crisol/domain'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { Globe } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { FormError } from '../components/field.tsx'
import { failed } from '../components/load-error.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import cards from './world-card.module.css'
import { NewWorld, WorldCard } from './world-card.tsx'

export function Worlds() {
  const { t } = useTranslation()
  const api = useApi()
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
  // Los mundos ya vistos: los que lleguen después (recién creados) entran animados; al cargar, ninguno
  const seen = useRef<Set<string> | null>(null)
  if (worlds.data && !seen.current) seen.current = new Set(worlds.data.worlds.map((w) => w.id))
  useEffect(() => {
    for (const world of worlds.data?.worlds ?? []) seen.current?.add(world.id)
  }, [worlds.data])

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const canCreate = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false

  const empty = worlds.data?.worlds.length === 0

  return (
    <section className={cards.page}>
      <div className={cards.top}>
        <PageTitle>{t('worlds.title')}</PageTitle>
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
            {canCreate && <NewWorld big />}
          </div>
        ) : (
          <ul className={cards.list} aria-label={t('worlds.listLabel')}>
            {worlds.data.worlds.map((world) => (
              <WorldCard key={world.id} world={world} fresh={!seen.current?.has(world.id)} />
            ))}
            {/* Tras el último, el recuadro vacío para crear otro */}
            {canCreate && <NewWorld />}
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
