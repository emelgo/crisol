/** «Grupo», en la barra de la campaña (docs/specs/grupo.md): el inventario del grupo y, al lado, sus movimientos */
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { PageTitle } from '../components/page-title.tsx'
import { Tour } from '../components/tour.tsx'
import styles from './party.module.css'
import { PartyInventory, PartyMoves } from './party.tsx'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/grupo')

export function PartyScreen() {
  const { t } = useTranslation()
  const { campaignId } = route.useParams()
  const { account, pending } = useAccounts().useAccount()
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  return (
    <div className={styles.page}>
      <section className={styles.main} data-tour="grupo-inventario">
        <PageTitle className={styles.title}>{t('party.title')}</PageTitle>
        <PartyInventory campaignId={campaignId} />
      </section>
      <aside className={styles.side} aria-label={t('party.moves')} data-tour="grupo-movimientos">
        <h2 className={styles.small}>{t('party.moves')}</h2>
        <PartyMoves campaignId={campaignId} />
      </aside>
      <Tour
        id="grupo"
        steps={[
          { target: '[data-tour="grupo-inventario"]', text: t('tour.party.items') },
          { target: '[data-tour="grupo-movimientos"]', text: t('tour.party.moves') }
        ]}
      />
    </div>
  )
}
