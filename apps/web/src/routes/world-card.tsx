import { WORLD_COLORS, WORLD_ICONS, type World } from '@crisol/contracts'
import { TRASH_DAYS } from '@crisol/domain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Castle,
  Crown,
  Globe,
  type LucideIcon,
  Mountain,
  Settings,
  Ship,
  Sword,
  TreePine
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApi } from '../api/context.tsx'
import { useErrorText } from '../api/errors.ts'
import { BusyButton } from '../components/busy-button.tsx'
import { ConfirmByName, DangerZone } from '../components/danger.tsx'
import { FormError } from '../components/field.tsx'
import { focusAfterRemoving } from '../components/focus.ts'
import form from '../components/form.module.css'
import list from '../components/list.module.css'
import { CoverPicker, useWorldFiles } from '../wiki/cover.tsx'
import styles from './world-card.module.css'

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

/** Lo de encima del nombre en la tarjeta de un mundo: la portada (imagen o color) y el icono */
export function WorldCardHeader({ world }: { world: World }) {
  // Las imágenes del mundo solo las lista quien lo administra; quien juega ve el color
  const files = useWorldFiles(world.id, world.role === 'master' && world.cover !== null)
  const image = world.cover ? files.data?.files.find((f) => f.id === world.cover?.fileId) : undefined
  const Icon = world.icon ? ICONS[world.icon] : Globe
  return (
    <div className={styles.header}>
      <div className={styles.cover} style={{ background: COLORS[world.color ?? 'slate'] }}>
        {image && world.cover && (
          <img
            src={image.url}
            alt=""
            className={styles.image}
            style={{ objectPosition: `${world.cover.x}% ${world.cover.y}%` }}
          />
        )}
        <span className={styles.icon} aria-hidden="true">
          <span>
            <Icon size={28} strokeWidth={1.5} />
          </span>
        </span>
      </div>
    </div>
  )
}

/** La descripción, debajo del nombre */
export function WorldDescription({ world }: { world: World }) {
  return world.description ? <p className={styles.description}>{world.description}</p> : null
}

/**
 * El engranaje de la tarjeta (abajo a la derecha, para quien dirige el mundo): abre su ventana, con el nombre, la
 * descripción, el icono, el color, la portada y, al final, borrarlo. Ahí irá lo que se añada del mundo
 */
export function WorldSettings({ world }: { world: World }) {
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
  const save = useMutation({
    mutationFn: async () => {
      const next = name.trim()
      if (next !== world.name) await api.call('renameWorld', { worldId: world.id, name: next })
      await api.call('updateWorld', { worldId: world.id, description, icon, color })
    },
    onSuccess: async () => {
      await refresh()
      dialog.current?.close()
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
  // El cuadro solo existe mientras está abierto: cerrado, no queda nada suyo en la página
  const [isOpen, setOpen] = useState(false)
  useEffect(() => {
    if (isOpen) dialog.current?.showModal()
  }, [isOpen])
  const open = () => {
    setName(world.name)
    setDescription(world.description)
    setIcon(world.icon)
    setColor(world.color)
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
        <dialog
          ref={dialog}
          aria-labelledby={titleId}
          className={styles.dialog}
          // Al cerrarse (Guardar, Cancelar o Escape), el foco vuelve al engranaje
          onClose={() => {
            setOpen(false)
            if (!deleted.current) trigger.current?.focus()
          }}
        >
          <form
            method="dialog"
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              save.mutate()
            }}
          >
            <h2 id={titleId}>{t('worlds.settingsOf', { name: world.name })}</h2>
            <div className={styles.field}>
              <label htmlFor={`${titleId}-name`}>{t('worlds.name')}</label>
              <input
                id={`${titleId}-name`}
                type="text"
                value={name}
                required
                maxLength={120}
                autoComplete="off"
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={`${titleId}-input`}>{t('worlds.description')}</label>
              <input
                id={`${titleId}-input`}
                type="text"
                value={description}
                maxLength={280}
                aria-describedby={`${titleId}-description`}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
              <small id={`${titleId}-description`}>{t('worlds.descriptionHint')}</small>
            </div>
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
            {world.role === 'master' && (
              <CoverPicker
                worldId={world.id}
                cover={world.cover}
                onSave={async (cover) => {
                  await api.call('updateWorld', { worldId: world.id, cover })
                  await refresh()
                }}
              />
            )}
            <FormError message={save.error ? errorText(save.error) : null} />
            <div className={list.actions}>
              <BusyButton type="submit" className={form.button} busy={save.isPending}>
                {t('worlds.save')}
              </BusyButton>
              <button type="button" className={list.secondary} onClick={() => dialog.current?.close()}>
                {t('worlds.cancel')}
              </button>
            </div>
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
        </dialog>
      )}
    </>
  )
}
