import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import env from '../config/env.config.js'

const jwtPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  })

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (_err) {
      reply.code(401).send({ success: false, message: 'Unauthorized' })
    }
  })
}

export default fp(jwtPlugin, { name: 'jwt-plugin' })
