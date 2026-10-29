import { connect } from '@crisol/db'
import { loadConfig } from '../config.ts'
import { runCli } from './cli.ts'

const config = loadConfig(process.env)
const conn = connect(config.DATABASE_URL, { max: 1 })
try {
  process.exitCode = await runCli(process.argv.slice(2), {
    db: conn.db,
    publicUrl: config.PUBLIC_URL,
    out: (text) => console.log(text),
    err: (text) => console.error(text)
  })
} finally {
  await conn.close()
}
