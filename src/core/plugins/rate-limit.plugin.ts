import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'
import env from '../config/env.config.js'

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyRateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
  })
}

export default fp(rateLimitPlugin, { name: 'rate-limit-plugin' })
