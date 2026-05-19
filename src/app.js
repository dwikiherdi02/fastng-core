import Fastify from 'fastify'
import env from './core/config/env.config.js'
import errorHandler from './core/middlewares/error-handler.js'

// Plugins
import dbPlugin from './core/plugins/db.plugin.js'
import jwtPlugin from './core/plugins/jwt.plugin.js'
import corsPlugin from './core/plugins/cors.plugin.js'
import helmetPlugin from './core/plugins/helmet.plugin.js'
import rateLimitPlugin from './core/plugins/rate-limit.plugin.js'
import swaggerPlugin from './core/plugins/swagger.plugin.js'

// Module loader
import { loadModules } from './registry/module.loader.js'

export async function buildApp() {
  const fastify = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: 'info', transport: { target: 'pino-pretty' } }
        : { level: 'info' },
  })

  // ── Global plugins (order matters) ────────────────────────────────────────────
  await fastify.register(swaggerPlugin)
  await fastify.register(helmetPlugin)
  await fastify.register(corsPlugin)
  await fastify.register(rateLimitPlugin)
  await fastify.register(dbPlugin)
  await fastify.register(jwtPlugin)

  // ── Global error handler ───────────────────────────────────────────────────────
  fastify.setErrorHandler(errorHandler)

  // ── Feature modules ────────────────────────────────────────────────────────────
  await loadModules(fastify)

  return fastify
}
