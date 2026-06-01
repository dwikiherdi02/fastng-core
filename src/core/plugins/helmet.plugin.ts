import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifyHelmet from '@fastify/helmet'

const helmetPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  })
}

export default fp(helmetPlugin, { name: 'helmet-plugin' })
