import { loadConfig } from './config.ts'
import { startServer } from './server.ts'

const server = await startServer(loadConfig(process.env), { logger: true })
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void server.stop())
