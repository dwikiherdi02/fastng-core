import fp from 'fastify-plugin'
import fastifyCors from '@fastify/cors'
import env from '../config/env.config.js'

async function corsPlugin(fastify) {
  fastify.register(fastifyCors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
}

export default fp(corsPlugin, { name: 'cors-plugin' })
