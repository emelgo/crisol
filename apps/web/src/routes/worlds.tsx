import type { World } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { Globe } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { quiet, useCardHolds } from '../components/card-transition.ts'
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
  // Los que se acaban de ir (borrados aquí, por la IA o en otra pestaña) se quedan en su sitio, ardiendo, hasta que se
  // consumen. Se calcula al pintar, no después: si no, la tarjeta desaparecería un instante antes de arder
  // Los que se crean o se borran aquí los enseña su transición (card-transition.ts): la nueva, retenida hasta que la
  // enseña; la borrada, mantenida hasta que arde
  const { held, kept } = useCardHolds()
  const [burning, setBurning] = useState<{ world: World; index: number }[]>([])
  const [shown, setShown] = useState(worlds.data)
  if (worlds.data !== shown) {
    const current = worlds.data?.worlds ?? []
    const gone = (shown?.worlds ?? []).flatMap((world, index) =>
      current.some((c) => c.id === world.id) || quiet.has(world.id) ? [] : [{ world, index }]
    )
    setShown(worlds.data)
    if (gone.length > 0) setBurning((list) => [...list, ...gone])
  }
  const list = (worlds.data?.worlds ?? []).filter((world) => !held.has(world.id))
  for (const { world, index } of [...burning, ...kept.values()]) {
    if (!list.some((w) => w.id === world.id)) list.splice(Math.min(index, list.length), 0, world)
  }

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const canCreate = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false

  const empty = list.length === 0

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
          <ul className={cards.list} aria-label={t('worlds.listLabel')} data-world-list>
            {list.map((world) => {
              const ashes = burning.some((b) => b.world.id === world.id)
              return (
                <WorldCard
                  key={world.id}
                  world={world}
                  fresh={!seen.current?.has(world.id) && !quiet.has(world.id)}
                  burning={ashes}
                  onBurnt={() => setBurning((all) => all.filter((b) => b.world.id !== world.id))}
                />
              )
            })}
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
