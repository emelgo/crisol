/**
 * El texto de cada página de un PDF (docs/specs/biblioteca.md), con pdf.js en el servidor: las líneas de cada página
 * juntas, sin los saltos de guion al final de línea. Un escaneado (sin texto) da páginas vacías
 */
type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

/**
 * pdf.js, al usarlo por primera vez: al cargarse avisa de que falta el lienzo de Node (`@napi-rs/canvas`), que solo
 * sirve para dibujar; ese aviso se calla
 */
let loaded: Promise<PdfJs> | null = null
function pdfjs(): Promise<PdfJs> {
  loaded ??= (async () => {
    const warn = console.warn
    console.warn = (...args: unknown[]) => {
      if (!String(args[0]).includes('@napi-rs/canvas') && !String(args[0]).includes('polyfill')) warn(...args)
    }
    try {
      return await import('pdfjs-dist/legacy/build/pdf.mjs')
    } finally {
      console.warn = warn
    }
  })()
  return loaded
}

/** Lo que pesa el texto de una página, como mucho (un libro raro no llena la base) */
const PAGE_CHARS = 20_000
/** Las páginas que se leen de un libro, como mucho, y el texto de todo él */
export const PDF_LIMITS = { pages: 3000, chars: 5_000_000 }

export async function pdfPages(
  bytes: Uint8Array,
  onPage?: (done: number, total: number) => void | Promise<void>
): Promise<string[]> {
  const { getDocument } = await pdfjs()
  // pdf.js se queda con el búfer: quien llama no lo vuelve a usar
  const task = getDocument({ data: bytes, useSystemFonts: false, verbosity: 0 })
  try {
    const document = await task.promise
    const pages: string[] = []
    let total = 0
    const last = Math.min(document.numPages, PDF_LIMITS.pages)
    for (let n = 1; n <= last; n++) {
      const page = await document.getPage(n)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items) {
        if (!('str' in item)) continue
        text += item.str
        if (item.hasEOL) text += '\n'
        else if (item.str && !item.str.endsWith(' ')) text += ' '
      }
      pages.push(
        text
          .replace(/(\p{L})-\n(\p{L})/gu, '$1$2')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          // Postgres no guarda el carácter nulo (de fuentes sin su tabla de letras)
          .replaceAll(String.fromCharCode(0), '')
          .trim()
          .slice(0, PAGE_CHARS)
      )
      total += (pages.at(-1) ?? '').length
      // Lo que pase del tope de texto, sin leer (las páginas que faltan, vacías)
      if (total > PDF_LIMITS.chars) break
      page.cleanup()
      await onPage?.(n, last)
    }
    return pages
  } finally {
    await task.destroy()
  }
}

/** Cuánto puede tardar un libro y cuánta memoria puede usar su hilo */
const PDF_WORKER = { timeoutMs: 10 * 60_000, memoryMb: 512 }

/**
 * Lo mismo que `pdfPages`, en un hilo aparte con tope de memoria y de tiempo: si el PDF lo desborda, falla él solo
 * (el libro queda «fallido») y la app sigue. Los bytes pasan al hilo sin copiarse (quien llama ya no los usa)
 */
export async function pdfPagesIsolated(
  bytes: Uint8Array,
  onPage?: (read: number, total: number) => void | Promise<void>
): Promise<string[]> {
  const { Worker } = await import('node:worker_threads')
  // Un trozo de un búfer compartido no se puede pasar: entonces, una copia propia
  const own = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice()
  return new Promise<string[]>((resolve, reject) => {
    const worker = new Worker(new URL('./text-worker.ts', import.meta.url), {
      workerData: { bytes: own },
      transferList: [own.buffer as ArrayBuffer],
      resourceLimits: { maxOldGenerationSizeMb: PDF_WORKER.memoryMb },
      execArgv: process.execArgv.filter((arg) => !arg.startsWith('--input-type'))
    })
    let settled = false
    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      outcome()
      void worker.terminate()
    }
    const timer = setTimeout(
      () => finish(() => reject(new Error('el PDF tarda demasiado en leerse'))),
      PDF_WORKER.timeoutMs
    )
    worker.on('message', (message: { read?: number; total?: number; pages?: string[]; error?: string }) => {
      if (message.pages) finish(() => resolve(message.pages as string[]))
      else if (message.error) finish(() => reject(new Error(message.error)))
      else if (message.read !== undefined) void onPage?.(message.read, message.total ?? 0)
    })
    worker.on('error', (error) => finish(() => reject(error)))
    worker.on('exit', (code) => finish(() => reject(new Error(`el hilo del PDF acabó sin terminar (${code})`))))
  })
}
