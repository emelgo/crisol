/** «Grupo», en la barra de la campaña (docs/specs/grupo.md): el inventario del grupo y, al lado, sus movimientos */
import { getRouteApi, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { Screen } from '../components/screen.tsx'
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
    <Screen
      title={t('party.title')}
      right={
        <div className={styles.side} data-tour="grupo-movimientos">
          <h2 className={styles.small}>{t('party.moves')}</h2>
          <PartyMoves campaignId={campaignId} />
        </div>
      }
      rightLabel={t('party.moves')}
    >
      <section className={styles.main} aria-label={t('party.title')} data-tour="grupo-inventario">
        <PartyInventory campaignId={campaignId} />
      </section>
      <Tour
        id="grupo"
        steps={[
          { target: '[data-tour="grupo-inventario"]', text: t('tour.party.items') },
          { target: '[data-tour="grupo-movimientos"]', text: t('tour.party.moves') }
        ]}
      />
    </Screen>
  )
}
