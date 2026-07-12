import type { FastifyInstance } from 'fastify'
import { createUserRepository } from './repositories/user.repository.js'
import { UserService } from './services/user.service.js'
import { UserController } from './controllers/user.controller.js'
import { createAuthRepository } from '../auth/index.js'
import { createSessionRepository } from '../session/index.js'
import userRoutes from './routes/user.routes.js'

export default async function usersModule(fastify: FastifyInstance): Promise<void> {
  const userRepository = createUserRepository(fastify.db)
  const authRepository = createAuthRepository(fastify.db)
  const sessionRepository = createSessionRepository(fastify.db)
  const userService = new UserService({
    userRepository,
    authRepository,
    sessionRepository,
    db: fastify.db,
  })
  const controller = new UserController(userService)

  fastify.register(
    async (instance) => {
      await userRoutes(instance, controller)
    },
    { prefix: '/api/v1/users' }
  )
}
