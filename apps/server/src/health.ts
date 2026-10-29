import type { FastifyInstance } from 'fastify'

/** Cada comprobación termina bien si el servicio responde */
export type HealthChecks = Record<'postgres' | 'valkey', () => Promise<void>>

type Status = 'ok' | 'down'

function within(check: () => Promise<void>, ms: number): Promise<Status> {
  const timeout = new Promise<Status>((resolve) => setTimeout(() => resolve('down'), ms).unref())
  return Promise.race([
    check().then(
      (): Status => 'ok',
      (): Status => 'down'
    ),
    timeout
  ])
}

export function registerHealth(app: FastifyInstance, checks: HealthChecks, timeoutMs: number) {
  app.get('/api/health', async (_request, reply) => {
    const [postgres, valkey] = await Promise.all([within(checks.postgres, timeoutMs), within(checks.valkey, timeoutMs)])
    const status: Status = postgres === 'ok' && valkey === 'ok' ? 'ok' : 'down'
    return reply.code(status === 'ok' ? 200 : 503).send({ status, postgres, valkey })
  })
}
