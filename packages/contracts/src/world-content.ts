/**
 * El compendio de un mundo (docs/specs/compendio-mundo.md): contenido hecho para un sistema de la cuenta, que ven las
 * campañas del mundo que lo usan. Se lee con el compendio de la campaña (getCampaignCompendium, searchCampaignContent,
 * getCampaignContent); aquí, guardarlo, quitarlo, copiar entre capas y traer los cambios de su original
 */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { contentItem, systemProblem } from './systems.ts'

const key = z.string().max(100)

/** Una entrada del mundo: como el contenido de un sistema, sin fuente; con la versión que se leyó para cambiarla */
const worldItem = contentItem.omit({ source: true }).extend({
  version: z
    .int()
    .min(1)
    .optional()
    .describe('La versión que se leyó (de getCampaignContent), para cambiar una que ya está')
})

export const putWorldContent = defineAction({
  name: 'putWorldContent',
  kind: 'write',
  description:
    'Guarda entradas en el compendio de un mundo, hechas para un sistema de la cuenta, con su mecánica (como putSystemContent): las que ya están (por su clave) se cambian, si se da su versión solo si es la que tienen (CONTENT_CHANGED). Se validan con el sistema: con un error no se guarda ninguna (SYSTEM_INVALID). Las ven las campañas del mundo con ese sistema; hasta el módulo 5, solo quien lleva el mundo',
  input: z.object({
    worldId: z.uuid(),
    systemId: z.uuid(),
    items: z.array(worldItem).min(1).max(100)
  }),
  output: z.object({
    saved: z.array(z.object({ key: z.string(), version: z.int() })),
    created: z.int().describe('Cuántas son nuevas'),
    warnings: z.array(systemProblem)
  })
})

export const deleteWorldContent = defineAction({
  name: 'deleteWorldContent',
  kind: 'delete',
  description: 'Quita entradas del compendio de un mundo por su clave. Se deshace desde el historial',
  input: z.object({ worldId: z.uuid(), systemId: z.uuid(), keys: z.array(key).min(1).max(100) }),
  output: z.object({ deleted: z.array(z.string()), missing: z.array(z.string()) })
})

export const copyContent = defineAction({
  name: 'copyContent',
  kind: 'write',
  description:
    'Copia una entrada entre las capas del compendio. Al mundo (to: world): una del sistema pasa a ser una entrada nueva del mundo, con otra clave, todo lo suyo y su origen (para avisar si el original cambia); su nombre, el que se dé o el suyo con «(copia)». Al sistema (to: system): una del mundo pasa al sistema de la cuenta para usarla en otros mundos, con la versión del sistema que se leyó; con remove, la del mundo se quita',
  input: z.object({
    worldId: z.uuid(),
    systemId: z.uuid(),
    key,
    to: z.enum(['world', 'system']),
    name: z.string().trim().min(1).max(200).optional().describe('El nombre de la copia'),
    newKey: z.string().max(100).optional().describe('La clave de la copia; sin ella, una nueva a partir del nombre'),
    remove: z.boolean().optional().describe('Al llevarla al sistema, quitar la del mundo'),
    version: z.int().min(1).optional().describe('Al llevarla al sistema: la versión del sistema que se leyó')
  }),
  output: z.object({
    key: z.string().describe('La clave de la copia'),
    to: z.enum(['world', 'system']),
    version: z.int().describe('La de la entrada nueva del mundo, o la nueva del sistema')
  })
})

/** Un valor tal cual (un texto en dos idiomas, un número, una lista, la mecánica entera) */
const value = z.unknown()

export const getContentOrigin = defineAction({
  name: 'getContentOrigin',
  kind: 'read',
  description:
    'De una entrada del mundo copiada de otra: su original y lo que ha cambiado en él desde que se copió (o se trajeron sus cambios), campo a campo, con lo que tiene la copia en cada uno',
  input: z.object({ worldId: z.uuid(), systemId: z.uuid(), key, language: z.enum(['es', 'en']).optional() }),
  output: z.object({
    origin: z
      .object({
        layer: z.enum(['system', 'world']),
        systemId: z.uuid(),
        key: z.string(),
        name: z.string().nullable(),
        missing: z.boolean()
      })
      .nullable()
      .describe('Sin origen, no es una copia'),
    changes: z.array(
      z.object({
        key: z.string().describe('La clave del campo, «name» o «mechanics»'),
        label: z.string(),
        before: value.describe('Lo que tenía el original al copiarlo'),
        after: value.describe('Lo que tiene ahora'),
        copy: value.describe('Lo que tiene la copia')
      })
    )
  })
})

export const pullContentOrigin = defineAction({
  name: 'pullContentOrigin',
  kind: 'write',
  description:
    'Trae a una copia del mundo los cambios de su original: los campos elegidos (los de getContentOrigin; «mechanics», toda su mecánica). Lo demás se queda como está, y el aviso de que el original ha cambiado se va. Con la versión de la copia que se leyó',
  input: z.object({
    worldId: z.uuid(),
    systemId: z.uuid(),
    key,
    version: z.int().min(1),
    fields: z.array(z.string().max(60)).max(200)
  }),
  output: z.object({ version: z.int() })
})
