import type { System } from '@crisol/systems'

/** Un cambio en el borrador del editor: sobre una copia; con `undo`, lo que se quitó (sale «Deshacer») */
export type Change = (fn: (draft: System) => void, undo?: string) => void
