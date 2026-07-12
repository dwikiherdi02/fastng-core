import type { FastifyInstance } from 'fastify'
import { createRoleRepository } from './repositories/role.repository.js'
import { RoleService } from './services/role.service.js'
import { RoleController } from './controllers/role.controller.js'
import roleRoutes from './routes/role.routes.js'

export default async function roleModule(fastify: FastifyInstance): Promise<void> {
  const repository = createRoleRepository(fastify.db)
  const service = new RoleService(repository)
  const controller = new RoleController(service)

  fastify.register(
    async (instance) => {
      await roleRoutes(instance, controller)
    },
    { prefix: '/api/v1/roles' }
  )
}
