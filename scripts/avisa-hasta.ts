/**
 * Ejecuta una comprobación que solo avisa hasta una fecha y bloquea a partir de ella (CONSTRAINTS.md).
 * Uso: node scripts/avisa-hasta.ts AAAA-MM-DD <orden> [argumentos…]
 */
import { spawnSync } from 'node:child_process'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function modeFor(today: string, deadline: string): 'avisa' | 'bloquea' {
  if (!DATE.test(today) || !DATE.test(deadline)) throw new Error('Las fechas van como AAAA-MM-DD')
  return today < deadline ? 'avisa' : 'bloquea'
}

if (import.meta.main) {
  const [deadline = '', command, ...args] = process.argv.slice(2)
  if (!command) throw new Error('Uso: node scripts/avisa-hasta.ts AAAA-MM-DD <orden> [argumentos…]')
  const mode = modeFor(new Date().toISOString().slice(0, 10), deadline)
  const { status } = spawnSync(command, args, { stdio: 'inherit' })
  if (status !== 0) {
    if (mode === 'avisa') {
      // Anotación de GitHub Actions: se ve en el PR pero no lo pone en rojo
      console.log(
        `::warning::«${[command, ...args].join(' ')}» ha fallado; avisa hasta el ${deadline}, luego bloqueará`
      )
    } else {
      process.exitCode = status ?? 1
    }
  }
}
