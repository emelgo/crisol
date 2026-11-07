/**
 * El hilo de la visión (ADR-0018 § 5): la vista del grupo y el recorte de las teselas corren aquí, no en el de la app,
 * para no parar a nadie mientras se calculan. Cada petición lleva su número y vuelve con él
 */
import { parentPort } from 'node:worker_threads'
import { type CropRequest, cropTile } from './tile-crop.ts'
import { computeView, type ViewRequest } from './vision-compute.ts'

type Message = { id: number } & ({ type: 'view'; request: ViewRequest } | { type: 'crop'; request: CropRequest })

parentPort?.on('message', async (message: Message) => {
  try {
    if (message.type === 'view') {
      const result = computeView(message.request)
      const transfer = [result.visible, result.explored, result.exploredShown, ...result.lit.map((l) => l.cells)]
      parentPort?.postMessage(
        { id: message.id, result },
        transfer.map((b) => b.buffer as ArrayBuffer)
      )
    } else {
      const bytes = await cropTile(message.request)
      parentPort?.postMessage({ id: message.id, result: bytes }, [bytes.buffer as ArrayBuffer])
    }
  } catch (error) {
    parentPort?.postMessage({ id: message.id, error: error instanceof Error ? error.message : String(error) })
  }
})
