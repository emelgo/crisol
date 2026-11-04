/** Los sistemas de serie (ADR-0011): en el código, de solo lectura y con su id fijo */
import type { System } from '../format.ts'
import { fiveE } from './5e/system.ts'
import { blank } from './blank.ts'

export const CATALOG: readonly System[] = [fiveE, blank]

export const catalogSystem = (id: string) => CATALOG.find((s) => s.id === id) ?? null
