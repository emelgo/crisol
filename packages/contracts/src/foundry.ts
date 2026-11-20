/** Traer a Crisol un sistema o un módulo de contenido de Foundry VTT, desde su zip */
import { z } from 'zod'
import { defineAction } from './action.ts'
import { systemFull, systemProblem } from './systems.ts'

/** El zip, como mucho (en base64 ocupa un tercio más) */
export const FOUNDRY_ZIP_BYTES = 30 * 1024 * 1024
const zip = z
  .base64()
  .max(Math.ceil(FOUNDRY_ZIP_BYTES / 3) * 4)
  .describe('El zip del sistema o del módulo, en base64 (como mucho, 30 MB)')

/** Un paquete del zip: su nombre, su nombre para leer, su clase de documento y cuántos trae */
export const foundryPack = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string().describe('Item, Actor, JournalEntry, RollTable… (las demás no se traen)'),
  documents: z.int(),
  supported: z.boolean().describe('Si sus documentos se traen')
})

export const inspectFoundry = defineAction({
  name: 'inspectFoundry',
  kind: 'read',
  description:
    'Lee el zip de un sistema o un módulo de Foundry VTT sin guardar nada: qué es y sus paquetes, con cuántos documentos tiene cada uno, para elegir cuáles traer con importFoundry',
  input: z.object({ organizationId: z.uuid().optional(), zip }),
  output: z.object({
    kind: z.enum(['system', 'module']),
    id: z.string(),
    title: z.string(),
    version: z.string().nullable(),
    system: z.string().nullable().describe('De un módulo, el sistema para el que es'),
    languages: z.array(z.string()),
    packs: z.array(foundryPack)
  })
})

export const importFoundry = defineAction({
  name: 'importFoundry',
  kind: 'write',
  description:
    'Crea un sistema de la cuenta con un sistema o un módulo de contenido de Foundry VTT (su zip en base64): sus tipos de objeto y de actor, sus diarios (reglas) y sus tablas de tirar, con su compendio y una fuente por paquete. Con into, mete su contenido en uno propio (con la versión que se tenía) sin quitarle nada. packs: los paquetes que se traen (sin él, todos); language: el idioma de sus textos. Si no cabe (5000 documentos, 64 MB), FOUNDRY_TOO_BIG: hay que elegir menos paquetes',
  input: z.object({
    organizationId: z.uuid().optional(),
    into: z.object({ systemId: z.uuid(), version: z.int().min(1) }).optional(),
    zip,
    packs: z.array(z.string().min(1).max(200)).min(1).max(200).optional(),
    language: z.enum(['es', 'en'])
  }),
  output: z.object({
    system: systemFull,
    warnings: z.array(systemProblem),
    images: z
      .array(z.object({ path: z.string(), credit: z.string().nullable() }))
      .describe('Las imágenes que nombra lo importado (con el crédito del mapa de arte): se suben con putSystemImages')
  })
})

/** Lo que se sube de imágenes de una vez: unas pocas, para no pasar del cuerpo de una petición */
export const SYSTEM_IMAGES_BYTES = 6 * 1024 * 1024

export const putSystemImages = defineAction({
  name: 'putSystemImages',
  kind: 'write',
  description:
    'Sube imágenes de un sistema de la cuenta por su ruta, con su licencia y su crédito: las que nombra su contenido en img (retratos, fichas, iconos) o las que se incrustan en los capítulos de sus libros con ![[ruta]]. Las que ya estaban se cambian. En tandas: como mucho 6 MB y 100 imágenes por petición. Solo imágenes (png, jpeg, webp, gif, avif o svg)',
  input: z.object({
    systemId: z.uuid(),
    images: z
      .array(
        z.object({
          path: z.string().min(1).max(500),
          data: z
            .string()
            .max(Math.ceil(SYSTEM_IMAGES_BYTES / 3) * 4)
            .describe('Sus bytes, en base64'),
          license: z.enum(['foundry-only', 'cc-by', 'cc-by-nc-sa', 'mit', 'unknown']),
          credit: z.string().max(500).nullable()
        })
      )
      .min(1)
      .max(100)
  }),
  output: z.object({ saved: z.int(), skipped: z.array(z.string()).describe('Las que no eran imágenes') })
})
