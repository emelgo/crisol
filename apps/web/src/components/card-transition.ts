/**
 * Crear y borrar mundos y campañas con transición de vista, como entrar en un mundo: las demás tarjetas se recolocan
 * deslizándose; la nueva sale de su ventana, que se encoge en ella al rojo; la borrada arde y queda en ceniza antes de
 * que las demás cierren el hueco (base.css). Mientras dura, la lista no cambia por su cuenta (el aviso en tiempo real
 * podría ponerla al día antes de tiempo): la nueva se retiene hasta que la transición la enseña y la borrada se
 * mantiene hasta que arde. La lista lleva data-card-list y cada tarjeta, data-card con su id
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let version = 0
const changed = () => {
  version++
  for (const listener of listeners) listener()
}

/** Recién creadas que aún no se enseñan */
const held = new Set<string>()
/** Borradas que aún se enseñan, con lo que tenían, su lista y su sitio */
const kept = new Map<string, { list: string; item: { id: string }; index: number }>()
/** Las que enseña la transición: sin su animación propia en la lista (forjarse o arder) */
export const quiet = new Set<string>()

/** Para la lista: se vuelve a pintar cuando cambia lo retenido o lo mantenido */
function useCardHolds() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
  return { held, kept }
}

/**
 * Lo que enseña una lista de tarjetas: sus elementos y, cada uno, si se acaba de crear (entra animado; al cargar,
 * ninguno) o si se acaba de ir (borrado aquí, por la IA o en otra pestaña: se queda en su sitio, ardiendo, hasta que se
 * consume y llama a burnt). Los que se crean o se borran aquí los enseña su transición: el nuevo, retenido hasta que
 * la enseña; el borrado, mantenido hasta que arde. name: la lista (la de los mundos, las campañas de uno…)
 */
export function useCardList<T extends { id: string }>(name: string, items: T[] | undefined) {
  const seen = useRef<Set<string> | null>(null)
  if (items && !seen.current) seen.current = new Set(items.map((item) => item.id))
  useEffect(() => {
    for (const item of items ?? []) seen.current?.add(item.id)
  }, [items])
  const { held, kept } = useCardHolds()
  // Los que se van se calculan al pintar, no después: si no, la tarjeta desaparecería un instante antes de arder
  const [burning, setBurning] = useState<{ item: T; index: number }[]>([])
  const [shown, setShown] = useState(items)
  if (items !== shown) {
    const gone = (shown ?? []).flatMap((item, index) =>
      (items ?? []).some((c) => c.id === item.id) || quiet.has(item.id) ? [] : [{ item, index }]
    )
    setShown(items)
    if (gone.length > 0) setBurning((list) => [...list, ...gone])
  }
  const list = (items ?? []).filter((item) => !held.has(item.id))
  const mine = [...kept.values()].filter((k) => k.list === name) as unknown as { item: T; index: number }[]
  for (const { item, index } of [...burning, ...mine]) {
    if (!list.some((i) => i.id === item.id)) list.splice(Math.min(index, list.length), 0, item)
  }
  return list.map((item) => ({
    item,
    fresh: !seen.current?.has(item.id) && !quiet.has(item.id),
    burning: burning.some((b) => b.item.id === item.id),
    burnt: () => setBurning((all) => all.filter((b) => b.item.id !== item.id))
  }))
}

/** Retiene una recién creada: no sale en la lista hasta que la transición la enseña */
export function holdCard(id: string) {
  quiet.add(id)
  held.add(id)
  changed()
}

/** Mantiene una borrada en su lista (name), en su sitio, hasta que la transición la quema */
export function keepCard(name: string, item: { id: string }, index: number) {
  quiet.add(item.id)
  kept.set(item.id, { list: name, item, index })
  changed()
}

// Con temporizador, no con fotogramas: mientras la transición pone al día la página, el navegador no da fotogramas
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 16))

/** Espera a que pase algo en la página (como mucho, unos segundos) */
async function until(check: () => boolean, ms = 3000) {
  const end = Date.now() + ms
  while (!check() && Date.now() < end) await tick()
}

const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-card="${id}"]`)

/** Cada tarjeta de la lista con su nombre de transición, para que se recoloque deslizándose */
function nameCards(list: Element) {
  for (const card of list.querySelectorAll<HTMLElement>(':scope > li')) {
    card.style.setProperty('view-transition-name', `tarjeta-${card.dataset.card ?? 'crear'}`)
  }
}

function unnameCards() {
  for (const card of document.querySelectorAll<HTMLElement>('[data-card-list] > li')) {
    card.style.removeProperty('view-transition-name')
    card.style.removeProperty('view-transition-class')
  }
}

/** Cierra un cuadro al momento, sin su animación de salida: la transición se encarga */
export function closeAtOnce(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) return
  dialog.style.transition = 'none'
  dialog.close()
}

/** Corre la transición; sin transiciones de vista (o sin la lista), solo el cambio */
async function run(type: 'crear-mundo' | 'borrar-mundo', update: () => Promise<void>, before: (list: Element) => void) {
  const list = document.querySelector('[data-card-list]')
  if (typeof document.startViewTransition !== 'function' || !list) return update()
  nameCards(list)
  before(list)
  let transition: ViewTransition
  try {
    transition = document.startViewTransition({ update, types: [type] })
  } catch {
    // Sin tipos (navegadores algo más viejos): la transición sin más
    transition = document.startViewTransition(update)
  }
  try {
    await transition.updateCallbackDone
    await transition.finished
  } finally {
    unnameCards()
  }
}

/**
 * Unas brasas sobre una tarjeta (base.css, .brasas-tarjeta): suben de su borde de abajo y se apagan. Van aparte en la
 * transición (su nombre), por encima; luego se quitan
 */
function embersOver(card: HTMLElement | null) {
  if (!card) return
  const box = card.getBoundingClientRect()
  const layer = document.createElement('div')
  layer.className = 'brasas-tarjeta'
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`
  })
  document.body.append(layer)
  window.setTimeout(() => layer.remove(), 2200)
}

/**
 * La tarjeta nueva sale de la ventana en la que se creó (from), que se encoge en ella al rojo. refresh: pone la lista
 * al día (la nueva ya está en el servidor)
 */
export function revealCard(id: string, from: HTMLDialogElement | null, refresh: () => Promise<unknown>) {
  return run(
    'crear-mundo',
    async () => {
      closeAtOnce(from)
      held.delete(id)
      changed()
      await refresh()
      await until(() => Boolean(cardOf(id)))
      const card = cardOf(id)
      card?.style.setProperty('view-transition-name', `tarjeta-${id}`)
      card?.style.setProperty('view-transition-class', 'forjando')
      embersOver(card)
    },
    () => {
      from?.style.setProperty('view-transition-name', `tarjeta-${id}`)
      from?.style.setProperty('view-transition-class', 'forjando')
    }
  )
}

/** La borrada arde en su sitio y queda en ceniza; después, las demás cierran el hueco */
export async function burnCard(id: string, refresh: () => Promise<unknown>) {
  await tick()
  return run(
    'borrar-mundo',
    async () => {
      kept.delete(id)
      changed()
      await refresh()
      await until(() => !cardOf(id))
    },
    () => {
      const card = cardOf(id)
      card?.style.setProperty('view-transition-class', 'ardiendo')
      embersOver(card)
    }
  )
}
