import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'FastNG API',
        description: 'Modular Clean Architecture REST API built with Fastify',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  })

  fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  })
}

export default fp(swaggerPlugin, { name: 'swagger-plugin' })
