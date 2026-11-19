import type { AiConnection, AiMode } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from '@tanstack/react-router'
import type { TFunction } from 'i18next'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { aiConnectionsQuery, aiSettingsQuery } from '../api/queries.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { FormError } from '../components/field.tsx'
import { focusAfterRemoving, focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'
import settings from './ai-settings.module.css'
import { clientLabel } from './consent.tsx'

const MODES: AiMode[] = ['readOnly', 'assistant', 'copilot']

/** «Hace 5 minutos», «ayer»… */
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['minute', 60],
  ['hour', 60],
  ['day', 24],
  ['week', 7],
  ['month', 4.35],
  ['year', 12]
]

export function since(at: string, now = Date.now()): string {
  let value = (new Date(at).getTime() - now) / 1000
  if (Math.abs(value) < 60) return relative.format(0, 'second')
  value /= 60
  for (const [unit, next] of STEPS) {
    if (Math.abs(value) < next || unit === 'year') return relative.format(Math.round(value), unit)
    value /= next
  }
  return relative.format(Math.round(value), 'year')
}

/**
 * Los ajustes de la IA, dentro de «Ajustes» (docs/diseno.md): el conector de Mundos (quien crea mundos), el modo (quien
 * dirige algo) y tus conexiones, con su último uso y «Quitar» (ADR-0030). El de cada campaña está en su Inicio
 */
export function AiSettings({
  creates = false,
  player = false,
  campaigns = []
}: {
  creates?: boolean
  player?: boolean
  /** Las campañas en las que está, para llevar a su Inicio (donde está su conector) a quien no crea mundos */
  campaigns?: ReadonlyArray<{ id: string; worldId: string; name: string }>
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const { account, pending } = useAccounts().useAccount()
  const current = useQuery({ ...aiSettingsQuery(api), enabled: Boolean(account) })
  // Optimista: la opción cambia en el mismo clic y vuelve atrás si el servidor falla
  const [pendingMode, setPendingMode] = useState<AiMode | null>(null)
  const setMode = useMutation({
    mutationFn: (mode: AiMode) => api.call('setAiMode', { mode }),
    onSuccess: (data) => {
      queryClient.setQueryData(['aiSettings'], data)
      announce(t('ai.saved'))
    },
    onSettled: () => setPendingMode(null)
  })

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const mode = pendingMode ?? current.data?.mode

  const body = (
    <>
      {current.data && (
        <>
          <section aria-labelledby="conector">
            <h2 id="conector">{t('ai.connectorTitle')}</h2>
            {creates ? (
              <>
                <p>{t('ai.connectorHint')}</p>
                <CopyField label={t('ai.connector')} value={current.data.connectorUrl} />
                <p className={styles.role}>{t('ai.perCampaign')}</p>
              </>
            ) : (
              <>
                <p>{t('ai.campaignOnly')}</p>
                <ul className={settings.campaigns}>
                  {campaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <Link
                        to="/mundos/$worldId/campanas/$campaignId"
                        params={{ worldId: campaign.worldId, campaignId: campaign.id }}
                      >
                        {campaign.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          {!player && (
            <fieldset className={settings.modes}>
              <legend>{t('ai.modeTitle')}</legend>
              {MODES.map((option) => (
                <label key={option} className={settings.mode}>
                  <input
                    type="radio"
                    name="mode"
                    value={option}
                    checked={mode === option}
                    onChange={() => {
                      // Mientras se guarda otro, se ignora: deshabilitarlas sacaría el foco y no se podría seguir con flechas
                      if (setMode.isPending) return
                      setPendingMode(option)
                      setMode.mutate(option)
                    }}
                  />
                  <span>
                    <strong>{t(`ai.modes.${option}`)}</strong>
                    <span className={styles.role}>{t(`ai.modeHints.${option}`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {setMode.isSuccess && <p>{t('ai.saved')}</p>}
          <Connections />
        </>
      )}
      <FormError message={current.error || setMode.error ? errorText(current.error ?? setMode.error) : null} />
    </>
  )
  return <div className={settings.embedded}>{body}</div>
}

/** El nombre del conector: Mundos o la campaña */
export function connectorName(t: TFunction, connector: AiConnection['connector']) {
  if (connector.kind === 'worlds') return t('ai.worldsName')
  return connector.campaign ? t('ai.campaignName', { name: connector.campaign.name }) : t('ai.goneCampaign')
}

/** Las apps de IA conectadas: cuál, a qué conector y cuándo se usó por última vez; «Quitar» la desconecta al momento */
function Connections() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const list = useQuery(aiConnectionsQuery(api))
  const [confirming, setConfirming] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: (connection: AiConnection & { refocus: () => void }) =>
      api.call('removeAiConnection', { clientId: connection.clientId, url: connection.url }),
    onSuccess: (data, connection) => {
      queryClient.setQueryData(['aiConnections'], data)
      setConfirming(null)
      announce(t('ai.removed', { client: clientLabel(connection.clientId, connection.clientName) }))
      // Tras quitarla, a la siguiente (o al título de la sección)
      requestAnimationFrame(connection.refocus)
    }
  })
  const connections = list.data?.connections ?? []
  return (
    <section aria-labelledby="conexiones">
      <h2 id="conexiones" tabIndex={-1}>
        {t('ai.connectionsTitle')}
      </h2>
      {list.data && connections.length === 0 && <p className={styles.role}>{t('ai.noConnections')}</p>}
      {connections.length > 0 && (
        <ul className={styles.list}>
          {connections.map((connection) => {
            const key = `${connection.clientId} ${connection.url}`
            return (
              <ConnectionItem
                key={key}
                connection={connection}
                confirming={confirming === key}
                busy={remove.isPending}
                onStart={() => setConfirming(key)}
                onCancel={() => setConfirming(null)}
                onRemove={(refocus) => {
                  if (!remove.isPending) remove.mutate({ ...connection, refocus })
                }}
              />
            )
          })}
        </ul>
      )}
      <FormError message={list.error || remove.error ? errorText(list.error ?? remove.error) : null} />
    </section>
  )
}

/** Una conexión: a qué conector (el nombre) y, debajo, la app y cuándo; «Quitar» pide confirmarlo en la misma fila */
function ConnectionItem({
  connection,
  confirming,
  busy,
  onStart,
  onCancel,
  onRemove
}: {
  connection: AiConnection
  confirming: boolean
  busy: boolean
  onStart(): void
  onCancel(): void
  onRemove(refocus: () => void): void
}) {
  const { t } = useTranslation()
  const item = useRef<HTMLLIElement>(null)
  const opener = useReturnFocus()
  const warningId = useId()
  const client = clientLabel(connection.clientId, connection.clientName)
  const target = connectorName(t, connection.connector)
  return (
    <li ref={item} className={styles.item}>
      <span className={styles.name}>
        <span className={styles.entity}>{target}</span>
        <span className={settings.pause}>, </span>
        <span className={`${styles.role} ${settings.connection}`}>
          {t('ai.usedBy', { client, when: since(connection.lastUsedAt) })}
        </span>
      </span>
      {!confirming && (
        <button
          type="button"
          ref={opener.ref}
          className={styles.secondary}
          aria-label={t('ai.removeButton', { client, target })}
          onClick={onStart}
        >
          {t('ai.remove')}
        </button>
      )}
      {confirming && (
        <div className={styles.confirm}>
          <p id={warningId}>{t('ai.removeWarning', { client, target })}</p>
          <div className={styles.actions}>
            <BusyButton
              ref={focusOnMount}
              className={form.button}
              aria-describedby={warningId}
              busy={busy}
              onClick={() => onRemove(focusAfter(item.current))}
            >
              {t('ai.remove')}
            </BusyButton>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                opener.back()
                onCancel()
              }}
            >
              {t('list.cancel')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** Tras quitar una conexión: el foco, al siguiente «Quitar» o, si no queda ninguna, al título de la sección */
function focusAfter(item: HTMLLIElement | null) {
  const next = focusAfterRemoving(item)
  return () => {
    if (item?.nextElementSibling || item?.previousElementSibling) next()
    else document.getElementById('conexiones')?.focus()
  }
}
