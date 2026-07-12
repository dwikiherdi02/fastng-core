import type { FastifyInstance } from 'fastify'
import { createMenuRepository } from './repositories/menu.repository.js'
import { MenuService } from './services/menu.service.js'
import { MenuController } from './controllers/menu.controller.js'
import menuRoutes from './routes/menu.routes.js'

export default async function menuModule(fastify: FastifyInstance): Promise<void> {
  const repository = createMenuRepository(fastify.db)
  const service = new MenuService(repository)
  const controller = new MenuController(service)

  fastify.register(
    async (instance) => {
      await menuRoutes(instance, controller)
    },
    { prefix: '/api/v1/menus' }
  )
}
