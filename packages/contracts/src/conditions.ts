import { z } from 'zod'

/** Poner o quitar un estado (docs/specs/fichas.md): del compendio por su clave o escrito a mano; con rondas, caduca */
export const conditionChange = z
  .object({
    add: z
      .object({
        name: z.string().trim().min(1).max(60),
        key: z.string().min(1).max(100).optional(),
        rounds: z.int().min(1).max(1000).optional()
      })
      .optional(),
    remove: z.string().min(1).max(60).optional().describe('El id del estado que se quita')
  })
  .refine((c) => (c.add === undefined) !== (c.remove === undefined), { message: 'add o remove' })
