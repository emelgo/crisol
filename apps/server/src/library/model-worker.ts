/**
 * El hilo del modelo (docs/specs/biblioteca.md): multilingual-e5-small cuantizado con onnxruntime-node y su
 * tokenizador SentencePiece en wasm. Recibe textos y devuelve sus vectores (la media de sus tokens, normalizada)
 */
import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'
import { SentencePieceProcessor } from '@sctg/sentencepiece-js'
import ort from 'onnxruntime-node'

const { dir, threads } = workerData as { dir: string; threads: number }
/** Lo más que lee el modelo de un texto */
const MAX_TOKENS = 512

const spm = new SentencePieceProcessor()
await spm.load(join(dir, 'sentencepiece.bpe.model'))
const session = await ort.InferenceSession.create(join(dir, 'model.onnx'), {
  intraOpNumThreads: threads,
  interOpNumThreads: 1,
  enableCpuMemArena: false,
  enableMemPattern: false
})

/** Los tokens de XLM-R: el de SentencePiece desplazado uno (el 0 es <unk>, que pasa al 3), entre <s> y </s> */
const tokens = (text: string) => [
  0,
  ...spm
    .encodeIds(text)
    .slice(0, MAX_TOKENS - 2)
    .map((id) => (id === 0 ? 3 : id + 1)),
  2
]

async function embed(text: string): Promise<number[]> {
  const ids = tokens(text)
  const tensor = (values: readonly number[]) =>
    new ort.Tensor(
      'int64',
      BigInt64Array.from(values, (v) => BigInt(v)),
      [1, values.length]
    )
  const out = await session.run({
    input_ids: tensor(ids),
    attention_mask: tensor(ids.map(() => 1)),
    token_type_ids: tensor(ids.map(() => 0))
  })
  const hidden = out[session.outputNames[0] as string] as ort.Tensor
  const width = hidden.dims[2] as number
  const data = hidden.data as Float32Array
  const vector = new Float64Array(width)
  for (let i = 0; i < ids.length; i++)
    for (let j = 0; j < width; j++) vector[j] = (vector[j] ?? 0) + (data[i * width + j] ?? 0)
  const norm = Math.hypot(...vector) || 1
  return Array.from(vector, (x) => x / norm)
}

parentPort?.on('message', async (message: { id: number; texts: string[] }) => {
  try {
    const vectors: number[][] = []
    for (const text of message.texts) vectors.push(await embed(text))
    parentPort?.postMessage({ id: message.id, vectors })
  } catch (error) {
    parentPort?.postMessage({ id: message.id, error: error instanceof Error ? error.message : String(error) })
  }
})
parentPort?.postMessage({ ready: true })
