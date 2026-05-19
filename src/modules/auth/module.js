import { createAuthRepository } from './repositories/auth.repository.js'
import { AuthService } from './services/auth.service.js'
import { AuthController } from './controllers/auth.controller.js'
import authRoutes from './routes/auth.routes.js'

/**
 * Auth module entry point.
 * Registers all auth routes under /api/v1/auth.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function authModule(fastify) {
  const repository = createAuthRepository(fastify.db)
  const service = new AuthService(repository, fastify)
  const controller = new AuthController(service)

  fastify.register(
    async (instance) => {
      await authRoutes(instance, controller)
    },
    { prefix: '/api/v1/auth' }
  )
}
