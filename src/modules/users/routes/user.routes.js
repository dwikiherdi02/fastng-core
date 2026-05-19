import { updateProfileRouteSchema } from '../dto/update-profile.request.dto.js'

const getMeSchema = {
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
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
}

const getUserByIdSchema = {
  tags: ['Users'],
  summary: 'Get user by ID (admin)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
}

const deleteUserSchema = {
  tags: ['Users'],
  summary: 'Delete user by ID (admin)',
  security: [{ BearerAuth: [] }],
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('../controllers/user.controller.js').UserController} controller
 */
export default async function userRoutes(fastify, controller) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.get('/me', { ...auth, schema: getMeSchema }, (req, rep) =>
    controller.getMe(req, rep)
  )

  fastify.patch('/me', { ...auth, schema: updateProfileRouteSchema }, (req, rep) =>
    controller.updateMe(req, rep)
  )

  fastify.get('/', { ...auth, schema: listUsersSchema }, (req, rep) =>
    controller.listUsers(req, rep)
  )

  fastify.get('/:id', { ...auth, schema: getUserByIdSchema }, (req, rep) =>
    controller.getUserById(req, rep)
  )

  fastify.delete('/:id', { ...auth, schema: deleteUserSchema }, (req, rep) =>
    controller.deleteUser(req, rep)
  )
}
