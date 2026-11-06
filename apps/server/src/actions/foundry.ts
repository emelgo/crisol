/**
 * Traer a Crisol un sistema o un módulo de contenido de Foundry VTT, desde su zip: se lee (foundry/read.ts), se convierte
 * en el archivo de un sistema (@crisol/systems/foundry), se valida entero y se guarda como uno subido (saveFile). Con
 * into, su contenido entra en uno propio sin quitarle nada
 */
import { Readable } from 'node:stream'
import { importFoundry, inspectFoundry, putSystemImages, SYSTEM_IMAGES_BYTES } from '@crisol/contracts'
import { systemImagesRepo, systemsRepo } from '@crisol/db'
import { authorize, sniff } from '@crisol/domain'
import { type System, validateFile } from '@crisol/systems'
import { convertFoundry, FoundryError, imagesOf, mergeFoundry } from '@crisol/systems/foundry'
import { inspectFoundryZip, readFoundryZip } from '../foundry/read.ts'
import { systemsChanged } from '../realtime/events.ts'
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
    const saved = await saveFile(ctx, valid, [...notes, ...problems.filter((p) => p.severity === 'warning')], {
      organizationId,
      into
    })
    // Las imágenes que nombra lo importado: la web las saca del zip y las sube
    return { ...saved, images: imagesOf(converted.file, read.art) }
  }),

  implement(putSystemImages, async (ctx, { systemId, images }) => {
    const row = await ownWritable(ctx, systemId)
    if (!ctx.storage) throw new InvalidRequestError('NO_STORAGE', 'el servidor no guarda archivos')
    const storage = ctx.storage
    const total = images.reduce((n, i) => n + Math.floor((i.data.length * 3) / 4), 0)
    if (total > SYSTEM_IMAGES_BYTES)
      throw new InvalidRequestError('TOO_LARGE', `como mucho, ${SYSTEM_IMAGES_BYTES / 1024 / 1024} MB por tanda`)
    const values: systemImagesRepo.SystemImageValues[] = []
    const skipped: string[] = []
    for (const image of images) {
      const bytes = Buffer.from(image.data, 'base64')
      // Solo imágenes, por sus bytes (no por lo que diga su nombre)
      const sniffed = sniff(new Uint8Array(bytes.subarray(0, 1024)), image.path)
      if (sniffed.kind !== 'image' || image.path.includes('..')) {
        skipped.push(image.path)
        continue
      }
      const stored = await storage.write(row.id, Readable.from([bytes]), SYSTEM_IMAGES_BYTES)
      values.push({
        path: image.path.replace(/^\/+/, ''),
        storageKey: stored.key,
        mime: sniffed.mime,
        bytes: stored.size,
        license: image.license,
        credit: image.credit
      })
    }
    const replaced = await systemImagesRepo.putImages(ctx.db, row.id, values)
    // Las que se cambian: sus bytes de antes ya no los nombra nadie
    for (const key of replaced) await storage.remove(key).catch(() => undefined)
    if (values.length > 0) ctx.realtime.publish(systemsChanged(row.organizationId))
    return { saved: values.length, skipped }
  })
]
