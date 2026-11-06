/**
 * Los sistemas de ejemplo (ADR-0015): el 5e con el SRD, hecho para probar que el formato da para un juego entero. No
 * vienen de serie: se importan desde su archivo (`pnpm sistema-5e`), y las pruebas los usan de fixture
 */
import { type SystemFile, toFile } from '../file.ts'
import { fiveE } from './5e/system.ts'
import { exampleContent } from './content.ts'

export { fiveE } from './5e/system.ts'
export { exampleContent } from './content.ts'

/** El archivo de un sistema de ejemplo, listo para importar */
export function exampleFile(id: '5e'): SystemFile {
  const system = { '5e': fiveE }[id]
  return toFile(system, exampleContent(system.id))
}
