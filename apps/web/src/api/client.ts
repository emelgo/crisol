/**
 * Cliente de las acciones de la API (POST /api/actions/<name>). De los contratos solo se importan tipos: zod no entra
 * en el navegador, la entrada y la salida ya las valida el servidor.
 */
import type { Actions, ExportInput, FileView } from '@crisol/contracts'
import type { z } from 'zod'

export type ActionName = keyof Actions
export type ActionInput<N extends ActionName> = z.input<Actions[N]['input']>
export type ActionOutput<N extends ActionName> = z.output<Actions[N]['output']>

/** Fallo de una acción, con el código que da el servidor (NOT_FOUND, FORBIDDEN…) */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
    this.name = 'ApiError'
  }
}

export interface ApiClient {
  call<N extends ActionName>(name: N, input: ActionInput<N>): Promise<ActionOutput<N>>
  /** Exporta la wiki (o una página) en un .zip: sus bytes y su nombre */
  exportWiki(input: ExportInput): Promise<{ name: string; data: Blob }>
  /** Sube un archivo al mundo, o reemplaza los bytes de uno, diciendo cuánto lleva (de 0 a 1) */
  uploadFile(target: UploadTarget, file: Blob, onProgress?: (fraction: number) => void): Promise<FileView>
}

/** Adónde va una subida: un archivo nuevo del mundo, con su nombre, o los bytes nuevos de uno que ya está */
export type UploadTarget = { worldId: string; name: string } | { fileId: string }

/** El nombre del archivo que da el servidor (filename* en UTF-8, o filename) */
function attachmentName(disposition: string | null) {
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '')?.[1]
  if (utf8) return decodeURIComponent(utf8)
  return /filename="([^"]+)"/i.exec(disposition ?? '')?.[1] ?? 'wiki.zip'
}

export function createApiClient(): ApiClient {
  return {
    async call(name, input) {
      const response = await fetch(`/api/actions/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      })
      const body = (await response.json().catch(() => ({}))) as { code?: string }
      if (!response.ok) throw new ApiError(body.code ?? 'UNKNOWN', response.status)
      return body as never
    },
    async exportWiki(input) {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { code?: string }
        throw new ApiError(body.code ?? 'UNKNOWN', response.status)
      }
      return { name: attachmentName(response.headers.get('content-disposition')), data: await response.blob() }
    },
    // Con XHR, no fetch: fetch aún no dice cuánto lleva subido
    uploadFile(target, file, onProgress) {
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest()
        if ('fileId' in target) request.open('PUT', `/api/files/${target.fileId}`)
        else {
          const query = new URLSearchParams({ worldId: target.worldId, name: target.name })
          request.open('POST', `/api/files?${query}`)
        }
        request.setRequestHeader('content-type', 'application/octet-stream')
        request.responseType = 'json'
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress?.(event.loaded / event.total)
        }
        request.onload = () => {
          const body = request.response as { code?: string } | null
          if (request.status >= 200 && request.status < 300) resolve(body as FileView)
          else reject(new ApiError(body?.code ?? 'UNKNOWN', request.status))
        }
        request.onerror = () => reject(new ApiError('NETWORK', 0))
        request.send(file)
      })
    }
  }
}
