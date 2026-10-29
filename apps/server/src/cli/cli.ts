/** Órdenes de mantenimiento del servidor: pnpm crisol <orden> */
import { parseArgs } from 'node:util'
import type { Database } from '@crisol/db'
import { BootstrapError, issueBootstrap } from '../bootstrap.ts'

const USAGE = 'Uso: pnpm crisol arranque [--org "Nombre de la organización"]'

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
