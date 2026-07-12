import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import scalarApiReference from '@scalar/fastify-api-reference'
import env from '../config/env.config.js'

/**
 * API documentation: @fastify/swagger generates the OpenAPI spec from route
 * schemas; the interactive UI is served at the path from DOC_PATH (default
 * /docs). DOC_PROVIDER selects the renderer: 'swagger' (@fastify/swagger-ui,
 * default) or 'scalar' (@scalar/fastify-api-reference).
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

  if (env.DOC_PROVIDER === 'scalar') {
    await fastify.register(scalarApiReference, {
      routePrefix: env.DOC_PATH,
      configuration: {
        title: 'FastNG API',
        // Lazily read the live spec so routes registered later are included.
        content: () => fastify.swagger(),
      },
    })
  } else {
    await fastify.register(fastifySwaggerUi, {
      routePrefix: env.DOC_PATH,
      uiConfig: { docExpansion: 'list', deepLinking: true },
    })
  }
}

export default fp(swaggerPlugin, { name: 'swagger-plugin' })
