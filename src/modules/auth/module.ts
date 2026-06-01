import type { FastifyInstance } from 'fastify'
import { createAuthRepository } from './repositories/auth.repository.js'
import { AuthService } from './services/auth.service.js'
import { AuthController } from './controllers/auth.controller.js'
import authRoutes from './routes/auth.routes.js'

export default async function authModule(fastify: FastifyInstance): Promise<void> {
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
