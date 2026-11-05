/**
 * «Personajes», en la vista de la campaña (docs/specs/personajes.md § campana): sus tarjetas (el máster ve todas; cada
 * jugador, las suyas), «Personaje nuevo» como un recuadro más, la vista previa al pasar y la ventana de cada uno
 */
import type { CharacterCard } from '@crisol/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, useNavigate } from '@tanstack/react-router'
import { Plus, Settings, UserRound } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAccounts } from '../account/context.tsx'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { Loading } from '../components/brand.tsx'
import { BusyButton } from '../components/busy-button.tsx'
import { ChangesBar } from '../components/changes.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import form from '../components/form.module.css'
import { failed, LoadError } from '../components/load-error.tsx'
import { Modal } from '../components/modal.tsx'
import { PageTitle } from '../components/page-title.tsx'
import cards from '../routes/world-card.module.css'
import screen from '../templates/screen.module.css'
import styles from './characters.module.css'

const route = getRouteApi('/mundos/$worldId/campanas/$campaignId/personajes')

/** Los personajes de una campaña (los que ve quien pide) */
export function useCharacters(campaignId: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['characters', campaignId],
    queryFn: () => api.call('listCharacters', { campaignId })
  })
}

/** «(!)»: le falta algo; con cuántas, si se sabe */
export function Pending({ count, label }: { count?: number; label: string }) {
  return (
    <span className={styles.pending} role="img" aria-label={label}>
      !{count && count > 1 ? count : ''}
    </span>
  )
}

export function CharactersScreen() {
  const { t } = useTranslation()
  const { worldId, campaignId } = route.useParams()
  const api = useApi()
  const { account, pending } = useAccounts().useAccount()
  const characters = useCharacters(campaignId)
  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.call('getCampaign', { campaignId }),
    enabled: Boolean(account)
  })
  const [hovered, setHovered] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  if (pending) return null
  if (!account) return <Navigate to="/entrar" replace />
  if (!characters.data || !campaign.data) {
    const error = failed(characters) ? characters : failed(campaign) ? campaign : null
    return error ? <LoadError error={error.error} onRetry={() => error.refetch()} /> : <Loading />
  }
  const master = campaign.data.campaign.role === 'master'
  const list = characters.data.characters
  const preview = list.find((c) => c.id === hovered)
  const noSystem = !campaign.data.campaign.system
  return (
    <section className={screen.page}>
      <aside className={screen.side} aria-label={t('characters.preview')}>
        {preview && <CharacterPreview character={preview} master={master} />}
      </aside>
      <div className={screen.center}>
        <PageTitle>{t('characters.title')}</PageTitle>
        {noSystem ? (
          <p className={styles.note}>{t('characters.noSystem')}</p>
        ) : (
          <ul className={screen.grid} aria-label={t('characters.title')}>
            {list.map((character) => (
              <CharacterTile
                key={character.id}
                character={character}
                worldId={worldId}
                master={master}
                onHover={setHovered}
              />
            ))}
            <li>
              <button type="button" className={screen.newCard} onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" size={22} />
                {t('characters.new')}
              </button>
            </li>
          </ul>
        )}
      </div>
      {creating && (
        <NewCharacterDialog
          worldId={worldId}
          campaignId={campaignId}
          master={master}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  )
}

function CharacterTile({
  character,
  worldId,
  master,
  onHover
}: {
  character: CharacterCard
  worldId: string
  master: boolean
  onHover: (id: string | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const gear = useRef<HTMLButtonElement>(null)
  const creating = character.status === 'creating'
  return (
    <li
      className={`${screen.card} ${styles.card}`}
      onPointerEnter={() => onHover(character.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(character.id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onHover(null)
      }}
    >
      <span className={styles.portrait} aria-hidden="true">
        <UserRound size={40} strokeWidth={1.25} />
      </span>
      {creating && (
        <span className={styles.creating}>
          {t('characters.creating')}
          <Pending label={t('characters.pending')} />
        </span>
      )}
      <h2 className={`${screen.name} ${styles.name}`}>
        <Link
          to="/mundos/$worldId/campanas/$campaignId/personajes/$characterId"
          params={{ worldId, campaignId: character.campaignId, characterId: character.id }}
          className={screen.open}
        >
          {character.name}
        </Link>
      </h2>
      <p className={screen.meta}>{character.summary.line || t('characters.noClass')}</p>
      <div className={`${screen.foot} ${styles.foot}`}>
        <span className={styles.owner}>
          {character.owner && (
            <>
              <span className={styles.avatar} aria-hidden="true">
                {character.owner.name.charAt(0).toUpperCase()}
              </span>
              {character.owner.name}
            </>
          )}
        </span>
        <button
          ref={gear}
          type="button"
          className={screen.gear}
          aria-label={t('characters.settingsOf', { name: character.name })}
          title={t('characters.settingsOf', { name: character.name })}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Settings size={16} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <CharacterWindow
          character={character}
          master={master}
          onClose={(gone) => {
            setOpen(false)
            if (!gone) gear.current?.focus()
          }}
        />
      )}
    </li>
  )
}

/** Lo que se ve al pasar por uno: su nivel y sus valores, su línea y quién lo juega */
function CharacterPreview({ character, master }: { character: CharacterCard; master: boolean }) {
  const { t } = useTranslation()
  return (
    <div className={screen.preview}>
      <div className={screen.previewTop}>
        <span className={screen.icon} aria-hidden="true">
          <UserRound size={20} strokeWidth={1.5} />
        </span>
        <div>
          <p className={screen.previewName}>{character.name}</p>
          <p className={screen.meta}>{character.summary.line || t('characters.noClass')}</p>
        </div>
      </div>
      {(character.summary.stats?.length ?? 0) > 0 && (
        <dl className={styles.stats}>
          {character.summary.stats?.map((stat) => (
            <div key={stat.key}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {master && character.owner && (
        <>
          <p className={screen.label}>{t('characters.owner')}</p>
          <p className={screen.meta}>{character.owner.name}</p>
        </>
      )}
    </div>
  )
}

/** Los miembros de la campaña, para elegir quién juega uno (el máster) */
function useMembers(campaignId: string, enabled: boolean) {
  const api = useApi()
  return useQuery({
    queryKey: ['members', campaignId],
    queryFn: () => api.call('listMembers', { campaignId }),
    enabled
  })
}

/** «Personaje nuevo»: su nombre y, si lo hace el máster, quién lo juega. Creado, se abre en el creador */
function NewCharacterDialog({
  worldId,
  campaignId,
  master,
  onClose
}: {
  worldId: string
  campaignId: string
  master: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const ownerId = useId()
  const members = useMembers(campaignId, master)
  const { account } = useAccounts().useAccount()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api.call('createCharacter', {
        campaignId,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(owner ? { ownerId: owner } : {})
      }),
    onSuccess: async ({ character }) => {
      void queryClient.invalidateQueries({ queryKey: ['characters', campaignId] })
      dialog.current?.close()
      onClose()
      await navigate({
        to: '/mundos/$worldId/campanas/$campaignId/personajes/$characterId',
        params: { worldId, campaignId, characterId: character.id }
      })
    }
  })
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={onClose}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate()
        }}
      >
        <h2 id={titleId}>{t('characters.new')}</h2>
        <Field
          label={t('characters.name')}
          value={name}
          maxLength={120}
          autoComplete="off"
          placeholder={t('characters.unnamed')}
          data-autofocus=""
          onChange={(event) => setName(event.currentTarget.value)}
        />
        {master && (
          <div className={screen.baseField}>
            <label htmlFor={ownerId}>{t('characters.whoPlays')}</label>
            <select id={ownerId} value={owner} onChange={(event) => setOwner(event.currentTarget.value)}>
              <option value="">{t('characters.me', { name: account?.name ?? '' })}</option>
              {members.data?.members
                .filter((m) => m.role === 'player')
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <FormError message={create.error ? errorText(create.error) : null} />
        <BusyButton type="submit" className={form.button} busy={create.isPending}>
          {t('characters.create')}
        </BusyButton>
      </form>
    </Modal>
  )
}

/** La ventana de un personaje: su nombre, quién lo juega (el máster lo cambia) y borrarlo. onClose(gone): si se borró */
function CharacterWindow({
  character,
  master,
  onClose
}: {
  character: CharacterCard
  master: boolean
  onClose: (gone: boolean) => void
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const ownerId = useId()
  const gone = useRef(false)
  const members = useMembers(character.campaignId, master)
  const [name, setName] = useState(character.name)
  const [owner, setOwner] = useState(character.owner?.id ?? '')
  const changed = name.trim() !== character.name || owner !== (character.owner?.id ?? '')
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['characters', character.campaignId] })
  const save = useMutation({
    mutationFn: async () => {
      await api.call('updateCharacter', {
        characterId: character.id,
        version: character.version,
        ...(name.trim() !== character.name ? { name: name.trim() } : {}),
        ...(owner !== (character.owner?.id ?? '') ? { ownerId: owner || null } : {})
      })
      await refresh()
    },
    onSuccess: () => dialog.current?.close()
  })
  const remove = async () => {
    await api.call('deleteCharacter', { characterId: character.id })
    gone.current = true
    dialog.current?.close()
    await refresh()
  }
  return (
    <Modal ref={dialog} aria-labelledby={titleId} className={cards.dialog} onClose={() => onClose(gone.current)}>
      <form
        className={cards.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (changed && name.trim()) save.mutate()
        }}
      >
        <h2 id={titleId}>{t('characters.settingsOf', { name: character.name })}</h2>
        <Field
          label={t('characters.name')}
          value={name}
          required
          maxLength={120}
          autoComplete="off"
          onChange={(event) => setName(event.currentTarget.value)}
        />
        {master && (
          <div className={screen.baseField}>
            <label htmlFor={ownerId}>{t('characters.whoPlays')}</label>
            <select id={ownerId} value={owner} onChange={(event) => setOwner(event.currentTarget.value)}>
              {members.data?.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <FormError message={save.error ? errorText(save.error) : null} />
        <ChangesBar shown={changed}>
          <BusyButton type="submit" className={form.button} busy={save.isPending}>
            {t('characters.save')}
          </BusyButton>
          <button
            type="button"
            className={dialogStyles.cancel}
            onClick={() => {
              setName(character.name)
              setOwner(character.owner?.id ?? '')
            }}
          >
            {t('characters.cancel')}
          </button>
        </ChangesBar>
      </form>
      <div className={cards.dangerArea}>
        <DangerZone>
          <ConfirmByName
            name={character.name}
            action={t('characters.delete')}
            title={t('characters.deleteTitle', { name: character.name })}
            warning={t('characters.deleteWarning')}
            label={t('characters.name')}
            onConfirm={remove}
          />
        </DangerZone>
      </div>
    </Modal>
  )
}
