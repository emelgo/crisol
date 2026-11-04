import { z } from 'zod'
import { defineAction } from './action.ts'

/** Un sistema: uno de serie, por su id legible (`blank`), o uno de la cuenta, por su uuid */
export const systemRef = z.string().trim().min(1).max(100)

/** Un problema de un sistema: dónde está (por su ruta y por sus nombres), por qué y si impide guardarlo */
export const systemProblem = z.object({
  path: z.string(),
  where: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning'])
})

/** Lo que se ve de un sistema en la lista: su nombre, de cuál salió, sus tipos y sus tiradas */
export const systemSummary = z.object({
  id: systemRef,
  name: z.string(),
  summary: z.string(),
  builtIn: z.boolean().describe('De serie: no se cambia, pero se copia'),
  version: z.int().describe('Sube con cada cambio; guardar pide la que se tenía'),
  release: z.string().describe('La versión que le pone quien lo hace'),
  basedOn: z.object({ id: systemRef, name: z.string(), version: z.int() }).nullable().describe('De cuál se copió'),
  license: z.string().nullable(),
  types: z.array(
    z.object({ key: z.string(), label: z.string(), document: z.enum(['actor', 'item']), fields: z.int() })
  ),
  rolls: z.array(z.object({ key: z.string(), label: z.string() })),
  content: z.int().describe('Cuántos documentos de contenido trae (clases, conjuros…)'),
  campaigns: z.array(z.object({ id: z.uuid(), name: z.string() })).describe('Las campañas que lo usan')
})

/** El sistema entero: el documento con su formato (lo explica el recurso de la documentación de sistemas del MCP) */
export const systemFull = systemSummary.extend({ document: z.record(z.string(), z.unknown()) })

export type SystemSummary = z.infer<typeof systemSummary>
export type SystemFull = z.infer<typeof systemFull>

export const listSystems = defineAction({
  name: 'listSystems',
  kind: 'read',
  description:
    'Los sistemas de reglas para las campañas: los de serie (que no se cambian; se copian) y los de la cuenta. Sin organización, la única de la que la cuenta es propietaria',
  input: z.object({ organizationId: z.uuid().optional() }),
  output: z.object({ systems: z.array(systemSummary) })
})

export const getSystem = defineAction({
  name: 'getSystem',
  kind: 'read',
  description: 'Un sistema de reglas entero: su documento (tipos, campos, fórmulas, tiradas, dados, fuentes y ajustes)',
  input: z.object({ systemId: systemRef, organizationId: z.uuid().optional() }),
  output: systemFull
})

const systemName = z.string().trim().min(1).max(200)

export const createSystem = defineAction({
  name: 'createSystem',
  kind: 'write',
  description:
    'Crea un sistema de reglas de la cuenta copiando otro (from: uno de serie, como «blank» para empezar de cero, o uno propio), con el nombre que se le dé. La copia es de la cuenta y no cambia cuando cambia el original. Se cambia con updateSystem',
  input: z.object({ organizationId: z.uuid().optional(), name: systemName, from: systemRef.default('blank') }),
  output: systemFull
})

export const updateSystem = defineAction({
  name: 'updateSystem',
  kind: 'write',
  description:
    'Cambia un sistema de la cuenta: su documento entero, o solo su nombre. Pide la versión que se tenía (version): si otro lo cambió entre medias, no se guarda (SYSTEM_CHANGED). Se valida entero: con errores no se guarda (SYSTEM_INVALID, con cada problema); los avisos se devuelven',
  input: z.object({
    systemId: z.uuid(),
    version: z.int().min(1),
    document: z.record(z.string(), z.unknown()).optional(),
    name: systemName.optional()
  }),
  output: z.object({ system: systemFull, warnings: z.array(systemProblem) })
})

export const deleteSystem = defineAction({
  name: 'deleteSystem',
  kind: 'delete',
  description:
    'Borra un sistema de la cuenta, si no lo usa ninguna campaña (SYSTEM_IN_USE). Se deshace desde el historial',
  input: z.object({ systemId: z.uuid() }),
  output: z.object({ id: z.uuid(), name: z.string() })
})

export const exportSystem = defineAction({
  name: 'exportSystem',
  kind: 'read',
  description:
    'Baja un sistema (de serie o de la cuenta) en un archivo: su documento y su contenido, para subirlo en otra cuenta',
  input: z.object({ systemId: systemRef, organizationId: z.uuid().optional() }),
  output: z.object({ name: z.string().describe('El nombre del archivo'), file: z.record(z.string(), z.unknown()) })
})

export const importSystem = defineAction({
  name: 'importSystem',
  kind: 'write',
  description:
    'Sube el archivo de un sistema: crea uno nuevo en la cuenta o, con into, reemplaza uno propio (con la versión que se tenía), contenido incluido. Se valida entero: con un solo error no se guarda nada (SYSTEM_INVALID, con cada problema)',
  input: z.object({
    organizationId: z.uuid().optional(),
    file: z.record(z.string(), z.unknown()),
    into: z.object({ systemId: z.uuid(), version: z.int().min(1) }).optional()
  }),
  output: z.object({ system: systemFull, warnings: z.array(systemProblem) })
})
