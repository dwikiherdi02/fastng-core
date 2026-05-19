import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import env from '../config/env.config.js'

async function jwtPlugin(fastify) {
  fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
  })

  // Decorate with a reusable authenticate hook
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ success: false, message: 'Unauthorized' })
    }
  })
}

export default fp(jwtPlugin, { name: 'jwt-plugin' })
