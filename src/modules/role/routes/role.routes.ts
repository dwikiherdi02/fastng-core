import type { FastifyInstance } from 'fastify'
import { createRoleRouteSchema } from '../dto/create-role.request.dto.js'
import { updateRoleRouteSchema } from '../dto/update-role.request.dto.js'
import { setRoleGrantsRouteSchema } from '../dto/set-role-grants.request.dto.js'
import type { RoleController } from '../controllers/role.controller.js'

const listSchema = { tags: ['Roles'], summary: 'List roles', security: [{ BearerAuth: [] }] }
const getSchema = {
  tags: ['Roles'],
  summary: 'Get role by ID',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}
const deleteSchema = {
  tags: ['Roles'],
  summary: 'Delete role',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}
const getGrantsSchema = {
  tags: ['Roles'],
  summary: 'Get a role permission grants',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}

export default async function roleRoutes(
  fastify: FastifyInstance,
  controller: RoleController
): Promise<void> {
  const M = 'role_management'
  const read = { preHandler: [fastify.authenticate, fastify.authorize(M, 'read')] }
  const create = { preHandler: [fastify.authenticate, fastify.authorize(M, 'create')] }
  const update = { preHandler: [fastify.authenticate, fastify.authorize(M, 'update')] }
  const remove = { preHandler: [fastify.authenticate, fastify.authorize(M, 'delete')] }

  fastify.get('/', { schema: listSchema, ...read }, (req, rep) => controller.list(req, rep))
  fastify.get('/:id', { schema: getSchema, ...read }, (req, rep) => controller.getById(req, rep))
  fastify.post('/', { schema: createRoleRouteSchema, ...create }, (req, rep) =>
    controller.create(req, rep)
  )
  fastify.put('/:id', { schema: updateRoleRouteSchema, ...update }, (req, rep) =>
    controller.update(req, rep)
  )
  fastify.delete('/:id', { schema: deleteSchema, ...remove }, (req, rep) =>
    controller.delete(req, rep)
  )
  fastify.get('/:id/permissions', { schema: getGrantsSchema, ...read }, (req, rep) =>
    controller.getGrants(req, rep)
  )
  fastify.put('/:id/permissions', { schema: setRoleGrantsRouteSchema, ...update }, (req, rep) =>
    controller.setGrants(req, rep)
  )
}
