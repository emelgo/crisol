import { join } from 'node:path'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Solo loopback por defecto: delante va Caddy
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8130),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  VALKEY_URL: z.url({ protocol: /^rediss?$/ }),
  // El espacio de nombres de las colas en Valkey: dos servidores con el mismo Valkey (desarrollo y e2e), cada uno el suyo
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('crisol'),
  // Firma las sesiones de Better Auth: largo y aleatorio (openssl rand -hex 32)
  AUTH_SECRET: z.string().min(32),
  // Dirección pública del sitio (en desarrollo, la de Vite)
  PUBLIC_URL: z.url({ protocol: /^https?$/ }),
  // Carpeta de la web compilada; en desarrollo la sirve Vite
  WEB_DIR: z.string().optional(),
  // Donde se guardan los datos que no van en Postgres (los bytes de los archivos, en archivos/)
  DATA_DIR: z.string().default('datos-locales'),
  // El Chromium del sistema para sacar los PDF de las hojas (en la imagen); sin él, el que instala Playwright
  CHROMIUM_PATH: z.string().optional(),
  // El modelo de la búsqueda por significado (model.onnx y sentencepiece.bpe.model); sin él, solo por palabras
  MODEL_DIR: z
    .string()
    .default(join(import.meta.dirname, '..', '..', '..', 'datos-locales', 'modelos', 'multilingual-e5-small'))
})

export type Config = z.infer<typeof schema>

/** Valida las variables de entorno al arrancar; si algo falla, dice qué */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = schema.safeParse(env)
  if (!result.success) throw new Error(`Configuración no válida:\n${z.prettifyError(result.error)}`)
  return result.data
}
