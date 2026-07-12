import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import scalarApiReference from '@scalar/fastify-api-reference'

/**
 * API documentation: @fastify/swagger generates the OpenAPI spec from route
 * schemas; Scalar (@scalar/fastify-api-reference) renders the interactive UI at
 * /docs (replacing @fastify/swagger-ui).
 */
const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'FastNG API',
        description: 'Modular Clean Architecture REST API built with Fastify',
        version: '3.0.0',
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

  await fastify.register(scalarApiReference, {
    routePrefix: '/docs',
    configuration: {
      title: 'FastNG API',
      // Lazily read the live spec so routes registered later are included.
      content: () => fastify.swagger(),
    },
  })
}

export default fp(swaggerPlugin, { name: 'swagger-plugin' })
