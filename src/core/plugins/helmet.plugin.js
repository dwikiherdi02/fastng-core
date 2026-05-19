import fp from 'fastify-plugin'
import fastifyHelmet from '@fastify/helmet'

async function helmetPlugin(fastify) {
  fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Disable for Swagger UI compatibility
  })
}

export default fp(helmetPlugin, { name: 'helmet-plugin' })
