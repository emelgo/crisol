/** Salida de los scripts, inyectable para probarlos */
export interface Io {
  out(text: string): void
  err(text: string): void
}

export const consoleIo: Io = {
  out: (text) => console.log(text),
  err: (text) => console.error(text)
}

/** Io que guarda lo escrito, para las pruebas */
export function memoryIo() {
  const out: string[] = []
  const err: string[] = []
  const io: Io = { out: (text) => out.push(text), err: (text) => err.push(text) }
  return { io, out, err }
}
