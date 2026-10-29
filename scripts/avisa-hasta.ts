/**
 * Ejecuta una comprobación que solo avisa hasta una fecha y bloquea a partir de ella (CONSTRAINTS.md).
 * Uso: node scripts/avisa-hasta.ts AAAA-MM-DD <orden> [argumentos…]
 */
import { spawnSync } from 'node:child_process'
import { consoleIo, type Io } from './io.ts'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function modeFor(today: string, deadline: string): 'avisa' | 'bloquea' {
  if (!DATE.test(today) || !DATE.test(deadline)) throw new Error('Las fechas van como AAAA-MM-DD')
  return today < deadline ? 'avisa' : 'bloquea'
}

/** Ejecuta una orden y devuelve su código de salida (null si no llegó a salir) */
export type Run = (command: string, args: string[]) => number | null

/** argv: fecha límite, orden y argumentos. Devuelve el código de salida */
export function runUntil(argv: string[], today: string, run: Run, io: Io): number {
  const [deadline = '', command, ...args] = argv
  if (!command) {
    io.err('Uso: node scripts/avisa-hasta.ts AAAA-MM-DD <orden> [argumentos…]')
    return 2
  }
  const mode = modeFor(today, deadline)
  const status = run(command, args)
  if (status === 0) return 0
  if (mode === 'bloquea') return status ?? 1
  // Anotación de GitHub Actions: se ve en el PR pero no lo pone en rojo
  io.out(`::warning::«${[command, ...args].join(' ')}» ha fallado; avisa hasta el ${deadline}, luego bloqueará`)
  return 0
}

const spawn: Run = (command, args) => spawnSync(command, args, { stdio: 'inherit' }).status

if (import.meta.main) {
  process.exitCode = runUntil(process.argv.slice(2), new Date().toISOString().slice(0, 10), spawn, consoleIo)
}
