/** Órdenes de mantenimiento del servidor: pnpm crisol <orden> */
import { parseArgs } from 'node:util'
import type { Database } from '@crisol/db'
import { BootstrapError, issueBootstrap } from '../bootstrap.ts'
import { diceToText } from './quitar-dados.ts'
import { moveBuiltIn5e } from './sistema-5e.ts'

const USAGE =
  'Uso: pnpm crisol arranque [--org "Nombre de la organización"] | pnpm crisol sistema-5e | pnpm crisol quitar-dados'

const MESSAGES: Partial<Record<BootstrapError['code'], string>> = {
  OWNER_EXISTS: 'Ya hay propietario: el arranque solo sirve para crear la primera cuenta',
  ORGANIZATION_NAME_REQUIRED: 'Aún no hay organización: indica su nombre con --org "…"'
}

export interface CliDeps {
  db: Database
  publicUrl: string
  out: (text: string) => void
  err: (text: string) => void
}

/** Devuelve el código de salida */
export async function runCli(argv: string[], { db, publicUrl, out, err }: CliDeps): Promise<number> {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch {
    err(USAGE)
    return 2
  }
  if (parsed.positionals[0] === 'sistema-5e') {
    const moved = await moveBuiltIn5e(db)
    out(
      `El 5e, a una copia en ${moved.organizations} cuentas: ${moved.campaigns} campañas y ${moved.characters} personajes`
    )
    return 0
  }
  if (parsed.positionals[0] === 'quitar-dados') {
    // Con nadie escribiendo (mejor con la app parada): un documento abierto ya se convierte solo al abrirlo
    const swept = await diceToText(db)
    out(`Tiradas escritas pasadas a texto en código: ${swept.rolls} en ${swept.documents} documentos`)
    return 0
  }
  if (parsed.positionals[0] !== 'arranque') {
    err(USAGE)
    return 2
  }
  try {
    const { secret, organizationName, expiresAt } = await issueBootstrap(db, { organizationName: parsed.values.org })
    out(`Organización: ${organizationName}`)
    out(`Enlace para crear la cuenta del propietario (un solo uso, caduca el ${expiresAt.toISOString()}):`)
    out(new URL(`/arranque/${secret}`, publicUrl).toString())
    return 0
  } catch (error) {
    const message = error instanceof BootstrapError ? MESSAGES[error.code] : undefined
    if (!message) throw error
    err(message)
    return 1
  }
}

function parse(argv: string[]) {
  return parseArgs({ args: argv, allowPositionals: true, strict: true, options: { org: { type: 'string' } } })
}
