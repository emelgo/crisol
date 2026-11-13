/**
 * Pulsar durante una transición de vista (Enrique, 2026-11-13: «al cambiar entre vistas no se puede hacer rápido»):
 * mientras dura, el navegador manda los clics a la raíz (su capa está encima de todo) y se perdían. Un clic así acaba
 * la transición al momento y se le pasa a lo que hay debajo en la vista nueva. Sin clics, se ve entera
 */
let active: ViewTransition | null = null

/** Lo que se puede pulsar */
const PRESSABLE = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], summary, label, input, select'

export function installTransitionClicks() {
  if (typeof document.startViewTransition !== 'function') return
  const start = document.startViewTransition.bind(document)
  document.startViewTransition = ((update?: Parameters<typeof start>[0]) => {
    const transition = start(update)
    active = transition
    void transition.finished
      .catch(() => undefined)
      .then(() => {
        if (active === transition) active = null
      })
    return transition
  }) as typeof document.startViewTransition
  document.addEventListener(
    'click',
    (event) => {
      const transition = active
      if (!transition || event.target !== document.documentElement) return
      const { clientX: x, clientY: y } = event
      transition.skipTransition()
      void transition.finished
        .catch(() => undefined)
        .then(() => document.elementFromPoint(x, y)?.closest<HTMLElement>(PRESSABLE)?.click())
    },
    true
  )
}
