import type { FastifyInstance } from 'fastify'
import type { PermissionController } from '../controllers/permission.controller.js'

const listSchema = {
  tags: ['Permissions'],
  summary: 'List the global permission catalog',
  security: [{ BearerAuth: [] }],
}

export default async function permissionRoutes(
  fastify: FastifyInstance,
  controller: PermissionController
): Promise<void> {
  fastify.get('/', { schema: listSchema, preHandler: [fastify.authenticate] }, (req, rep) =>
    controller.list(req, rep)
  )
}
