import type { FastifyInstance } from 'fastify'
import { updateProfileRouteSchema } from '../dto/update-profile.request.dto.js'
import type { UserController } from '../controllers/user.controller.js'

const profileSchema = {
  tags: ['Users'],
  summary: 'Get own profile',
  security: [{ BearerAuth: [] }],
}

const listUsersSchema = {
  tags: ['Users'],
  summary: 'List all users (admin)',
  security: [{ BearerAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'string' },
      limit: { type: 'string' },
    },
  },
}

const getUserSchema = {
  tags: ['Users'],
  summary: 'Get user by ID (admin)',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}

const deleteUserSchema = {
  tags: ['Users'],
  summary: 'Delete user by ID (admin)',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}

export default async function userRoutes(
  fastify: FastifyInstance,
  controller: UserController
): Promise<void> {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.get('/me', { schema: profileSchema, ...auth }, (req, rep) =>
    controller.getMe(req, rep)
  )
  fastify.patch('/me', { schema: updateProfileRouteSchema, ...auth }, (req, rep) =>
    controller.updateMe(req, rep)
  )
  fastify.get('/', { schema: listUsersSchema, ...auth }, (req, rep) =>
    controller.listUsers(req, rep)
  )
  fastify.get('/:id', { schema: getUserSchema, ...auth }, (req, rep) =>
    controller.getUserById(req, rep)
  )
  fastify.delete('/:id', { schema: deleteUserSchema, ...auth }, (req, rep) =>
    controller.deleteUser(req, rep)
  )
}
