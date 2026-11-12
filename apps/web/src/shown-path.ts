/**
 * La dirección que se ve: la de la ruta montada, no la pedida. Al navegar, el router cambia la dirección enseguida y lo
 * nuevo se monta después, dentro de la transición de vista; lo que se elige por la dirección (el ancho de la página, la
 * barra, los dados…) tiene que cambiar con lo nuevo, no antes (si no, lo de antes se recolocaba antes de su foto y la
 * transición salía rara: Enrique, 2026-11-12, al salir de un mundo)
 */
import type { AnyRouter, RouterState } from '@tanstack/react-router'

export const shownPath = (state: RouterState<AnyRouter['routeTree']>) =>
  state.matches.at(-1)?.pathname ?? state.location.pathname
