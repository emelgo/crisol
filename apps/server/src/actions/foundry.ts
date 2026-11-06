/**
 * Traer a Crisol un sistema o un módulo de contenido de Foundry VTT, desde su zip: se lee (foundry/read.ts), se convierte
 * en el archivo de un sistema (@crisol/systems/foundry), se valida entero y se guarda como uno subido (saveFile). Con
 * into, su contenido entra en uno propio sin quitarle nada
 */
import { importFoundry, inspectFoundry } from '@crisol/contracts'
import { systemsRepo } from '@crisol/db'
import { authorize } from '@crisol/domain'
import { type System, validateFile } from '@crisol/systems'
import { convertFoundry, FoundryError, mergeFoundry } from '@crisol/systems/foundry'
import { inspectFoundryZip, readFoundryZip } from '../foundry/read.ts'
import { targetOrganization } from './access.ts'
import { type ActionContext, InvalidRequestError } from './context.ts'
import { implement } from './registry.ts'
import { contentOf, invalid, ownWritable, saveFile } from './systems.ts'

/** Los errores de leerlo o convertirlo, con su código y lo que pasa */
async function guarded<T>(run: () => Promise<T> | T): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof FoundryError) throw new InvalidRequestError(error.code, error.message)
    throw error
  }
}

/** Antes de leer nada: que la cuenta pueda crear sistemas (o cambiar ese) */
async function allowed(ctx: ActionContext, organizationId: string | undefined, into: { systemId: string } | undefined) {
  if (into) return ownWritable(ctx, into.systemId)
  authorize(ctx.actor, 'systems.write', { organizationId: targetOrganization(ctx, organizationId) })
  return null
}

export const foundryActions = [
  implement(inspectFoundry, async (ctx, { organizationId, zip }) => {
    await allowed(ctx, organizationId, undefined)
    const { manifest, packs } = await guarded(() => inspectFoundryZip(Buffer.from(zip, 'base64')))
    return {
      kind: manifest.kind,
      id: manifest.id,
      title: manifest.title,
      version: manifest.version,
      system: manifest.system,
      languages: manifest.languages.map((l) => l.lang),
      packs
    }
  }),

  implement(importFoundry, async (ctx, { organizationId, into, zip, packs, language }) => {
    const row = await allowed(ctx, organizationId, into)
    const read = await guarded(() =>
      readFoundryZip(Buffer.from(zip, 'base64'), { ...(packs ? { packs } : {}), language })
    )
    const converted = await guarded(() => convertFoundry({ ...read, language }))
    const file = row
      ? await guarded(async () =>
          mergeFoundry(
            {
              system: row.document as unknown as System,
              content: (await systemsRepo.listContent(ctx.db, row.id)).map(contentOf)
            },
            converted.file
          )
        )
      : converted.file
    const { file: valid, problems } = validateFile(file)
    if (!valid) return invalid(problems)
    const notes = converted.notes.map((message) => ({
      path: '',
      where: 'Importación',
      message,
      severity: 'warning' as const
    }))
    return saveFile(ctx, valid, [...notes, ...problems.filter((p) => p.severity === 'warning')], {
      organizationId,
      into
    })
  })
]
