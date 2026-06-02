import Fastify from 'fastify'
import env from './core/config/env.config.js'
import swaggerPlugin from './core/plugins/swagger.plugin.js'
import helmetPlugin from './core/plugins/helmet.plugin.js'
import corsPlugin from './core/plugins/cors.plugin.js'
import rateLimitPlugin from './core/plugins/rate-limit.plugin.js'
import dbPlugin from './core/plugins/db.plugin.js'
import jwtPlugin from './core/plugins/jwt.plugin.js'
import schedulePlugin from './core/plugins/schedule.plugin.js'
import errorHandler from './core/middlewares/error-handler.js'
import { loadModules } from './registry/module.loader.js'

export async function buildApp() {
  const fastify = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : true,
  })

  await fastify.register(swaggerPlugin)
  await fastify.register(helmetPlugin)
  await fastify.register(corsPlugin)
  await fastify.register(rateLimitPlugin)
  await fastify.register(dbPlugin)
  await fastify.register(jwtPlugin)
  await fastify.register(schedulePlugin)

  fastify.setErrorHandler(errorHandler)

  await loadModules(fastify)

  return fastify
}
