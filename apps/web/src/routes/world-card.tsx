import { type PageCover as Cover, WORLD_COLORS, WORLD_ICONS, type World } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  Castle,
  Crown,
  Globe,
  ImagePlus,
  type LucideIcon,
  Maximize2,
  Mountain,
  Settings,
  Ship,
  Sword,
  TreePine
} from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import dialogStyles from '../components/dialog.module.css'
import { Field, FormError } from '../components/field.tsx'
import { focusAfterRemoving } from '../components/focus.ts'
import form from '../components/form.module.css'
import { Modal } from '../components/modal.tsx'
import { coverStyle, useWorldFiles } from '../wiki/cover.tsx'
import styles from './world-card.module.css'
import { CoverDialog, CoverViewer } from './world-cover.tsx'

const ICONS: Record<NonNullable<World['icon']>, LucideIcon> = {
  tower: Castle,
  mountain: Mountain,
  sword: Sword,
  ship: Ship,
  crown: Crown,
  tree: TreePine,
  book: BookOpen
}

/** El color de la portada sin imagen: oscuros y apagados, para que el icono y el texto destaquen */
const COLORS: Record<NonNullable<World['color']>, string> = {
  wine: '#4a2a2c',
  moss: '#2e3a33',
  slate: '#2d3440',
  ochre: '#4a3b22',
  sea: '#22394a',
  plum: '#3a2d44'
}

/**
 * La tarjeta de un mundo: la portada, el nombre, la descripción y, abajo, el papel y el engranaje de quien lo dirige.
 * Toda la tarjeta lleva al mundo (el enlace del nombre la cubre), salvo sus botones
 */
export function WorldCard({ world }: { world: World }) {
  const { t } = useTranslation()
  return (
    <li className={styles.card}>
      <WorldCover world={world} />
      <div className={styles.body}>
        <Link to="/mundos/$worldId" params={{ worldId: world.id }} className={styles.name}>
          {world.name}
        </Link>
        {world.description && <p className={styles.description}>{world.description}</p>}
        <div className={styles.footer}>
          <span className={styles.role}>{t(`roles.${world.role}`)}</span>
          {world.role === 'master' && <WorldSettings world={world} />}
        </div>
      </div>
    </li>
  )
}

/**
 * La portada (imagen o color) con el icono medio dentro. Al pasar el ratón se acerca un poco y, a quien dirige el
 * mundo, deja verla; en su ventana (editable), también cambiarla. icon y color: lo que se está eligiendo, aún sin
 * guardar
 */
function WorldCover({
  world,
  icon = world.icon,
  color = world.color,
  editable = false
}: {
  world: World
  icon?: World['icon']
  color?: World['color']
  editable?: boolean
}) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  // Las imágenes del mundo solo las lista quien lo administra; quien juega ve el color
  const master = world.role === 'master'
  const files = useWorldFiles(world.id, master && world.cover !== null)
  const image = world.cover ? files.data?.files.find((f) => f.id === world.cover?.fileId) : undefined
  const [viewing, setViewing] = useState(false)
  const [changing, setChanging] = useState(false)
  const Icon = icon ? ICONS[icon] : Globe
  const background = COLORS[color ?? 'slate']
  const saveCover = async (cover: Cover | null) => {
    await api.call('updateWorld', { worldId: world.id, cover })
    await queryClient.invalidateQueries({ queryKey: ['worlds'] })
  }
  return (
    <div className={editable ? `${styles.header} ${styles.large}` : styles.header}>
      <div className={styles.frame}>
        <div className={styles.picture} style={{ background }}>
          {image && world.cover && (
            <img src={image.url} alt="" className={styles.image} style={coverStyle(world.cover)} />
          )}
        </div>
        {master && (image || editable) && (
          <div className={styles.coverActions}>
            {image && (
              <button type="button" aria-haspopup="dialog" onClick={() => setViewing(true)}>
                <Maximize2 aria-hidden="true" size={14} />
                {t('cover.view')}
              </button>
            )}
            {editable && (
              <button type="button" aria-haspopup="dialog" onClick={() => setChanging(true)}>
                <ImagePlus aria-hidden="true" size={14} />
                {t(world.cover ? 'cover.change' : 'cover.add')}
              </button>
            )}
          </div>
        )}
      </div>
      <span className={styles.icon} aria-hidden="true">
        <span>
          <Icon size={editable ? 32 : 28} strokeWidth={1.5} />
        </span>
      </span>
      {viewing && image && (
        <CoverViewer url={image.url} label={t('cover.of', { name: world.name })} onClose={() => setViewing(false)} />
      )}
      {changing && (
        <CoverDialog
          worldId={world.id}
          title={t('cover.of', { name: world.name })}
          cover={world.cover}
          background={background}
          onSave={saveCover}
          onClose={() => setChanging(false)}
        />
      )}
    </div>
  )
}

/**
 * El engranaje de la tarjeta (para quien dirige el mundo): abre su ventana, con la portada arriba, el nombre, la
 * descripción, el icono y el color y, al final, la zona de peligro. Ahí irá lo que se añada del mundo. «Cancelar» (deshace
 * lo cambiado) y «Guardar» solo salen si hay cambios
 */
function WorldSettings({ world }: { world: World }) {
  const { t } = useTranslation()
  const api = useApi()
  const queryClient = useQueryClient()
  const errorText = useErrorText()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const [name, setName] = useState(world.name)
  const [description, setDescription] = useState(world.description)
  const [icon, setIcon] = useState(world.icon)
  const [color, setColor] = useState(world.color)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['worlds'] })
  const changed =
    name.trim() !== world.name ||
    description.trim() !== world.description ||
    icon !== world.icon ||
    color !== world.color
  const revert = () => {
    setName(world.name)
    setDescription(world.description)
    setIcon(world.icon)
    setColor(world.color)
  }
  const save = useMutation({
    mutationFn: async () => {
      const next = name.trim()
      if (next !== world.name) await api.call('renameWorld', { worldId: world.id, name: next })
      await api.call('updateWorld', { worldId: world.id, description, icon, color })
      await refresh()
    }
  })
  // Borrado, la tarjeta desaparece: el foco, a la siguiente (o al título)
  const deleted = useRef(false)
  const remove = async () => {
    await api.call('deleteWorld', { worldId: world.id })
    const after = focusAfterRemoving(trigger.current?.closest('li'))
    deleted.current = true
    dialog.current?.close()
    await refresh()
    after()
  }
  // La ventana solo existe mientras está abierta: cerrada, no queda nada suyo en la página
  const [isOpen, setOpen] = useState(false)
  const open = () => {
    revert()
    save.reset()
    setOpen(true)
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.gear}
        aria-label={t('worlds.settingsOf', { name: world.name })}
        title={t('worlds.settingsOf', { name: world.name })}
        aria-haspopup="dialog"
        onClick={open}
      >
        <Settings aria-hidden="true" size={18} />
      </button>
      {isOpen && (
        <Modal
          ref={dialog}
          aria-labelledby={titleId}
          className={styles.dialog}
          // Al cerrarse (Guardar, Cancelar, la X, fuera o Escape), el foco vuelve al engranaje
          onClose={() => {
            setOpen(false)
            if (!deleted.current) trigger.current?.focus()
          }}
        >
          <WorldCover world={world} icon={icon} color={color} editable />
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate()
            }}
          >
            <h2 id={titleId}>{t('worlds.settingsOf', { name: world.name })}</h2>
            <Field
              label={t('worlds.name')}
              value={name}
              required
              maxLength={120}
              autoComplete="off"
              onChange={(event) => setName(event.currentTarget.value)}
            />
            <Field
              label={t('worlds.description')}
              hint={t('worlds.descriptionHint')}
              value={description}
              maxLength={280}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
            <fieldset className={styles.choices}>
              <legend>{t('worlds.icon')}</legend>
              {WORLD_ICONS.map((id) => {
                const Icon = ICONS[id]
                return (
                  <label key={id} className={styles.iconChoice} title={t(`worlds.icons.${id}`)}>
                    <input type="radio" name="icon" checked={icon === id} onChange={() => setIcon(id)} />
                    <Icon aria-hidden="true" size={22} strokeWidth={1.5} />
                    <span className={styles.hidden}>{t(`worlds.icons.${id}`)}</span>
                  </label>
                )
              })}
            </fieldset>
            <fieldset className={styles.choices}>
              <legend>{t('worlds.color')}</legend>
              {WORLD_COLORS.map((id) => (
                <label key={id} className={styles.colorChoice} title={t(`worlds.colors.${id}`)}>
                  <input type="radio" name="color" checked={color === id} onChange={() => setColor(id)} />
                  <span aria-hidden="true" style={{ background: COLORS[id] }} />
                  <span className={styles.hidden}>{t(`worlds.colors.${id}`)}</span>
                </label>
              ))}
              <small className={styles.hint}>{t('worlds.colorHint')}</small>
            </fieldset>
            <FormError message={save.error ? errorText(save.error) : null} />
            {changed && (
              <div className={dialogStyles.actions}>
                <button type="button" className={dialogStyles.cancel} onClick={revert}>
                  {t('worlds.cancel')}
                </button>
                <BusyButton type="submit" className={form.button} busy={save.isPending}>
                  {t('worlds.save')}
                </BusyButton>
              </div>
            )}
          </form>
          {/* Aparte, al final y fuera del formulario: borrar el mundo, escribiendo su nombre para confirmarlo */}
          <div className={styles.dangerArea}>
            <DangerZone>
              <ConfirmByName
                name={world.name}
                action={t('worlds.deleteWorld')}
                title={t('worlds.deleteTitle', { name: world.name })}
                warning={t('worlds.deleteWarning', { days: TRASH_DAYS })}
                label={t('worlds.name')}
                onConfirm={remove}
              />
            </DangerZone>
          </div>
        </Modal>
      )}
    </>
  )
}
