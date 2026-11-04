/** Los sistemas de serie (ADR-0011): en el código, de solo lectura y con su id fijo. El 5e llega con srd-5e */
import type { System } from '../format.ts'
import { blank } from './blank.ts'

export const CATALOG: readonly System[] = [blank]

export const catalogSystem = (id: string) => CATALOG.find((s) => s.id === id) ?? null
