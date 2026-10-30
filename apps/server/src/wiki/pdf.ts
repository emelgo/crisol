/**
 * El PDF de una hoja, sacado en el servidor con Chromium (permiso de Enrique, 2026-10-30): abre la ruta de impresión
 * de la web en el propio servidor, con la sesión de quien lo pide, espera a que la hoja esté paginada y la imprime con
 * su papel. De uno en uno: Chromium pesa y la app tiene la memoria justa
 */
import { type Browser, chromium } from 'playwright-core'

export interface PdfRenderer {
  /** El PDF de la ruta (relativa a la web) con la cookie de la sesión */
  render(path: string, cookie: string): Promise<Buffer>
  close(): Promise<void>
}

export function pdfRenderer(options: {
  /** Donde escucha el servidor por dentro (http://127.0.0.1:PUERTO) */
  baseUrl: string
  /** El Chromium del sistema (en la imagen); sin él, el que instala Playwright */
  executablePath?: string | undefined
}): PdfRenderer {
  let browser: Promise<Browser> | null = null
  let queue: Promise<unknown> = Promise.resolve()
  const launch = () => {
    browser ??= chromium.launch({
      ...(options.executablePath
        ? // En el contenedor no hay espacios de nombres para su sandbox: lo que abre es la propia web
          { executablePath: options.executablePath, chromiumSandbox: false }
        : {}),
      args: ['--disable-dev-shm-usage']
    })
    return browser
  }
  const render = async (path: string, cookie: string) => {
    const context = await (await launch()).newContext({ extraHTTPHeaders: { cookie } })
    try {
      const page = await context.newPage()
      await page.goto(new URL(path, options.baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForSelector('body[data-sheet-ready="true"]', { timeout: 30_000 })
      await page.emulateMedia({ media: 'print' })
      return await page.pdf({ preferCSSPageSize: true, printBackground: true })
    } finally {
      await context.close()
    }
  }
  return {
    render(path, cookie) {
      const next = queue.then(() => render(path, cookie))
      // Lo que falle no para la cola
      queue = next.catch(() => undefined)
      return next
    },
    async close() {
      const open = browser
      browser = null
      if (open) await (await open).close().catch(() => undefined)
    }
  }
}
