import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Solo loopback por defecto: delante va Caddy
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8130),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  VALKEY_URL: z.url({ protocol: /^rediss?$/ }),
  // Carpeta de la web compilada; en desarrollo la sirve Vite
  WEB_DIR: z.string().optional()
})

export type Config = z.infer<typeof schema>

/** Valida las variables de entorno al arrancar; si algo falla, dice qué */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = schema.safeParse(env)
  if (!result.success) throw new Error(`Configuración no válida:\n${z.prettifyError(result.error)}`)
  return result.data
}
