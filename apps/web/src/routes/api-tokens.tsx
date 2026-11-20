/**
 * Los tokens de acceso (ADR-0033), en Ajustes › IA, para quien crea mundos: para que la IA cargue mucho de una vez
 * (un sistema entero, la wiki de un mundo) con un programa. Valen como la cuenta; el token entero se ve una sola vez
 */
import { API_TOKEN_DAYS, type ApiToken } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { apiTokensQuery } from '../api/queries.ts'
import { useAnnounce } from '../components/announcer.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { CopyField } from '../components/copy-field.tsx'
import { Field, FormError } from '../components/field.tsx'
import { focusAfterRemoving, focusOnMount, useReturnFocus } from '../components/focus.ts'
import form from '../components/form.module.css'
import styles from '../components/list.module.css'
import { since } from '../components/since.ts'
import settings from './ai-settings.module.css'

type Days = (typeof API_TOKEN_DAYS)[number]

const day = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

export function ApiTokens() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const announce = useAnnounce()
  const list = useQuery(apiTokensQuery(api))
  const daysId = useId()
  const [name, setName] = useState('')
  const [days, setDays] = useState<Days>(30)
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: () => api.call('createApiToken', { name: name.trim(), days }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apiTokens'] })
      setSecret({ name: data.token.name, value: data.secret })
      setName('')
      announce(t('apiTokens.created', { name: data.token.name }))
    }
  })
  const remove = useMutation({
    mutationFn: (token: ApiToken & { refocus: () => void }) => api.call('deleteApiToken', { tokenId: token.id }),
    onSuccess: (data, token) => {
      queryClient.setQueryData(['apiTokens'], data)
      setConfirming(null)
      announce(t('apiTokens.removed', { name: token.name }))
      requestAnimationFrame(token.refocus)
    }
  })
  const tokens = list.data?.tokens ?? []
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!create.isPending && name.trim()) create.mutate()
  }
  return (
    <section aria-labelledby="tokens">
      <h2 id="tokens" tabIndex={-1}>
        {t('apiTokens.title')}
      </h2>
      <p>{t('apiTokens.hint')}</p>
      {secret && (
        <div className={settings.secret}>
          <CopyField label={t('apiTokens.secret', { name: secret.name })} value={secret.value} />
          <p className={styles.role}>{t('apiTokens.once')}</p>
          <button type="button" className={styles.secondary} onClick={() => setSecret(null)}>
            {t('apiTokens.done')}
          </button>
        </div>
      )}
      {tokens.length > 0 && (
        <ul className={styles.list}>
          {tokens.map((token) => (
            <TokenItem
              key={token.id}
              token={token}
              confirming={confirming === token.id}
              busy={remove.isPending}
              onStart={() => setConfirming(token.id)}
              onCancel={() => setConfirming(null)}
              onRemove={(refocus) => {
                if (!remove.isPending) remove.mutate({ ...token, refocus })
              }}
            />
          ))}
        </ul>
      )}
      <form className={settings.newToken} onSubmit={submit}>
        <Field
          label={t('apiTokens.name')}
          placeholder={t('apiTokens.namePlaceholder')}
          value={name}
          maxLength={80}
          required
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <div className={form.field}>
          <label htmlFor={daysId}>{t('apiTokens.expires')}</label>
          <select id={daysId} value={days} onChange={(event) => setDays(Number(event.currentTarget.value) as Days)}>
            {API_TOKEN_DAYS.map((d) => (
              <option key={d} value={d}>
                {t('apiTokens.days', { count: d })}
              </option>
            ))}
          </select>
        </div>
        <BusyButton type="submit" className={form.button} busy={create.isPending}>
          {t('apiTokens.create')}
        </BusyButton>
      </form>
      <FormError
        message={
          list.error || create.error || remove.error ? errorText(list.error ?? create.error ?? remove.error) : null
        }
      />
    </section>
  )
}

/** Un token: su nombre y, debajo, su principio, cuándo caduca y su último uso; «Quitar» pide confirmarlo en la fila */
function TokenItem({
  token,
  confirming,
  busy,
  onStart,
  onCancel,
  onRemove
}: {
  token: ApiToken
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
  const expired = new Date(token.expiresAt).getTime() <= Date.now()
  const expires = day.format(new Date(token.expiresAt))
  const details = [
    `${token.prefix}…`,
    expired ? t('apiTokens.expired', { date: expires }) : t('apiTokens.until', { date: expires }),
    token.lastUsedAt ? t('apiTokens.used', { when: since(token.lastUsedAt) }) : t('apiTokens.unused')
  ].join(' · ')
  return (
    <li ref={item} className={styles.item}>
      <span className={styles.name}>
        <span className={styles.entity}>{token.name}</span>
        <span className={settings.pause}>, </span>
        <span className={`${styles.role} ${settings.connection}`}>{details}</span>
      </span>
      {!confirming && (
        <button
          type="button"
          ref={opener.ref}
          className={styles.secondary}
          aria-label={t('apiTokens.removeButton', { name: token.name })}
          onClick={onStart}
        >
          {t('ai.remove')}
        </button>
      )}
      {confirming && (
        <div className={styles.confirm}>
          <p id={warningId}>{t('apiTokens.removeWarning', { name: token.name })}</p>
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

/** Tras quitar uno: el foco, al siguiente «Quitar» o, si no queda ninguno, al título de la sección */
function focusAfter(item: HTMLLIElement | null) {
  const next = focusAfterRemoving(item)
  return () => {
    if (item?.nextElementSibling || item?.previousElementSibling) next()
    else document.getElementById('tokens')?.focus()
  }
}
