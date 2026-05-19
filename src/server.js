import { buildApp } from './app.js'
import env from './core/config/env.config.js'

const fastify = await buildApp()

try {
  await fastify.listen({ host: env.HOST, port: env.PORT })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
