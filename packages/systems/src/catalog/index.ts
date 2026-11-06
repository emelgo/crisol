/**
 * Los sistemas de serie (ADR-0011): en el código, de solo lectura y con su id fijo. Desde ADR-0015 solo «En blanco»:
 * Crisol viene vacío y cada sistema se crea o se importa en la cuenta
 */
import type { System } from '../format.ts'
import { blank } from './blank.ts'

export const CATALOG: readonly System[] = [blank]

export const catalogSystem = (id: string) => CATALOG.find((s) => s.id === id) ?? null
