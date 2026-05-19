import { createUserRepository } from './repositories/user.repository.js'
import { UserService } from './services/user.service.js'
import { UserController } from './controllers/user.controller.js'
import userRoutes from './routes/user.routes.js'
import { createAuthRepository, AuthService } from '../auth/index.js'

/**
 * Users module entry point.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function usersModule(fastify) {
  const userRepository = createUserRepository(fastify.db)

  // Auth dependencies injected into UserService for:
  // 1. Multi-repo transaction (deleteUser atomically removes user + all tokens)
  // 2. Service-in-service (updateProfile revokes sessions on email change)
  const authRepository = createAuthRepository(fastify.db)
  const authService = new AuthService(authRepository, fastify)

  const service = new UserService({ userRepository, authRepository, authService, db: fastify.db })
  const controller = new UserController(service)

  fastify.register(
    async (instance) => {
      await userRoutes(instance, controller)
    },
    { prefix: '/api/v1/users' }
  )
}
