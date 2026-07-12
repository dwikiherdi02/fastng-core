import type { FastifyInstance } from 'fastify'
import type { MenuController } from '../controllers/menu.controller.js'

const catalogSchema = {
  tags: ['Menus'],
  summary: 'List the menu × permission catalog (for the admin permission checklist)',
  security: [{ BearerAuth: [] }],
}

export default async function menuRoutes(
  fastify: FastifyInstance,
  controller: MenuController
): Promise<void> {
  fastify.get('/', { schema: catalogSchema, preHandler: [fastify.authenticate] }, (req, rep) =>
    controller.listCatalog(req, rep)
  )
}
