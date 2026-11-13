/**
 * Copia las fuentes de Excalidraw (OFL; docs/terceros.md) a public/excalidraw/fonts, para que la pizarra las pida a
 * Crisol y no a su CDN (EXCALIDRAW_ASSET_PATH = '/excalidraw/'). Sin Xiaolai (13 MB de caracteres chinos). Se pasa al
 * cambiar de versión de Excalidraw: pnpm --filter @crisol/web fuentes:excalidraw
 */
import { cpSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
// Su entrada es dist/prod/index.js (su package.json no se exporta); las fuentes, a su lado
const from = join(dirname(require.resolve('@excalidraw/excalidraw')), 'fonts')
const to = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'excalidraw', 'fonts')
const SKIP = new Set(['Xiaolai'])

rmSync(to, { recursive: true, force: true })
for (const family of readdirSync(from)) {
  if (!SKIP.has(family)) cpSync(join(from, family), join(to, family), { recursive: true })
}
console.log(`Fuentes de Excalidraw en ${to}`)
