import type { World } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { ApiError } from '../api/client.ts'
import { useApi } from '../api/context.tsx'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import styles from './worlds.module.css'

/** El texto de error de un fallo de la API */
function useErrorText() {
  const { t } = useTranslation()
  return (error: unknown) => {
    const code = error instanceof ApiError ? error.code : 'UNKNOWN'
    return t(`errors.${code}`, { defaultValue: t('errors.UNKNOWN') })
  }
}

export function Worlds() {
  const { t } = useTranslation()
  const api = useApi()
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

  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  const canCreate = organizations.data?.organizations.some((o) => o.role === 'owner') ?? false

  return (
    <section>
      <h1>{t('worlds.title')}</h1>
      {worlds.data &&
        (worlds.data.worlds.length === 0 ? (
          <p>{t('worlds.empty')}</p>
        ) : (
          <ul className={styles.list} aria-label={t('worlds.listLabel')}>
            {worlds.data.worlds.map((world) => (
              <WorldItem key={world.id} world={world} />
            ))}
          </ul>
        ))}
      {canCreate && <CreateWorld />}
    </section>
  )
}

function CreateWorld() {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const create = useMutation({
    mutationFn: (name: string) => api.call('createWorld', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worlds'] })
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = event.currentTarget
    create.mutate(String(new FormData(target).get('name')), { onSuccess: () => target.reset() })
  }

  return (
    <form className={form.form} onSubmit={submit}>
      <h2>{t('worlds.newTitle')}</h2>
      <Field label={t('worlds.name')} name="name" maxLength={120} required />
      <FormError message={create.error ? errorText(create.error) : null} />
      <button type="submit" className={form.button} disabled={create.isPending}>
        {t('worlds.create')}
      </button>
    </form>
  )
}

function WorldItem({ world }: { world: World }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const [editing, setEditing] = useState(false)
  const rename = useMutation({
    mutationFn: (name: string) => api.call('renameWorld', { worldId: world.id, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['worlds'] })
      setEditing(false)
    }
  })

  if (editing) {
    return (
      <li className={styles.item}>
        <form
          className={styles.rename}
          onSubmit={(event) => {
            event.preventDefault()
            rename.mutate(String(new FormData(event.currentTarget).get('name')))
          }}
        >
          <Field
            label={t('worlds.renameLabel', { name: world.name })}
            name="name"
            defaultValue={world.name}
            maxLength={120}
            required
          />
          <FormError message={rename.error ? errorText(rename.error) : null} />
          <div className={styles.actions}>
            <button type="submit" className={form.button} disabled={rename.isPending}>
              {t('worlds.save')}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setEditing(false)}>
              {t('worlds.cancel')}
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className={styles.item}>
      <span className={styles.name}>{world.name}</span>
      <span className={styles.role}>{t(`roles.${world.role}`)}</span>
      <button
        type="button"
        className={styles.secondary}
        aria-label={t('worlds.renameButton', { name: world.name })}
        onClick={() => setEditing(true)}
      >
        {t('worlds.rename')}
      </button>
    </li>
  )
}
