/**
 * El hilo que lee un PDF (docs/specs/biblioteca.md): pdf.js corre aquí, no en el de la app, así que un PDF enorme o
 * malicioso solo puede tumbar este hilo (con su tope de memoria), no el servidor
 */
import { parentPort, workerData } from 'node:worker_threads'
import { pdfPages } from './text.ts'

const { bytes } = workerData as { bytes: Uint8Array }
try {
  const pages = await pdfPages(bytes, (read, total) => {
    parentPort?.postMessage({ read, total })
  })
  parentPort?.postMessage({ pages })
} catch (error) {
  parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) })
}
