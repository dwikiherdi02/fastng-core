import type { FastifyInstance } from 'fastify'
import { updateProfileRouteSchema } from '../dto/update-profile.request.dto.js'
import { assignRolesRouteSchema } from '../dto/assign-roles.request.dto.js'
import { setUserPermissionsRouteSchema } from '../dto/set-user-permissions.request.dto.js'
import type { UserController } from '../controllers/user.controller.js'

const profileSchema = {
  tags: ['Users'],
  summary: 'Get own profile',
  security: [{ BearerAuth: [] }],
}

const listUsersSchema = {
  tags: ['Users'],
  summary: 'List all users (requires user_management:read)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: { page: { type: 'string' }, limit: { type: 'string' } },
  },
}

const getUserSchema = {
  tags: ['Users'],
  summary: 'Get user by ID (requires user_management:read)',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}

const deleteUserSchema = {
  tags: ['Users'],
  summary: 'Delete user by ID (requires user_management:delete)',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}

const getUserPermsSchema = {
  tags: ['Users'],
  summary: 'Get a user permission overrides',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}

export default async function userRoutes(
  fastify: FastifyInstance,
  controller: UserController
): Promise<void> {
  const auth = { preHandler: [fastify.authenticate] }
  const canRead = { preHandler: [fastify.authenticate, fastify.authorize('user_management', 'read')] }
  const canUpdate = {
    preHandler: [fastify.authenticate, fastify.authorize('user_management', 'update')],
  }
  const canDelete = {
    preHandler: [fastify.authenticate, fastify.authorize('user_management', 'delete')],
  }

  fastify.get('/me', { schema: profileSchema, ...auth }, (req, rep) => controller.getMe(req, rep))
  fastify.patch('/me', { schema: updateProfileRouteSchema, ...auth }, (req, rep) =>
    controller.updateMe(req, rep)
  )
  fastify.get('/', { schema: listUsersSchema, ...canRead }, (req, rep) =>
    controller.listUsers(req, rep)
  )
  fastify.get('/:id', { schema: getUserSchema, ...canRead }, (req, rep) =>
    controller.getUserById(req, rep)
  )
  fastify.delete('/:id', { schema: deleteUserSchema, ...canDelete }, (req, rep) =>
    controller.deleteUser(req, rep)
  )
  fastify.put('/:id/roles', { schema: assignRolesRouteSchema, ...canUpdate }, (req, rep) =>
    controller.assignRoles(req, rep)
  )
  fastify.get('/:id/permissions', { schema: getUserPermsSchema, ...canRead }, (req, rep) =>
    controller.getPermissions(req, rep)
  )
  fastify.put('/:id/permissions', { schema: setUserPermissionsRouteSchema, ...canUpdate }, (req, rep) =>
    controller.setPermissions(req, rep)
  )
}
