import type { FastifyInstance } from 'fastify'
import { createPermissionRepository } from './repositories/permission.repository.js'
import { PermissionService } from './services/permission.service.js'
import { PermissionController } from './controllers/permission.controller.js'
import permissionRoutes from './routes/permission.routes.js'

export default async function permissionModule(fastify: FastifyInstance): Promise<void> {
  const repository = createPermissionRepository(fastify.db)
  const service = new PermissionService(repository)
  const controller = new PermissionController(service)

  fastify.register(
    async (instance) => {
      await permissionRoutes(instance, controller)
    },
    { prefix: '/api/v1/permissions' }
  )
}
