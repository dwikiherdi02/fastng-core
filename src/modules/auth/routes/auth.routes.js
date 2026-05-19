import { registerRouteSchema } from '../dto/register.request.dto.js'
import { loginRouteSchema } from '../dto/login.request.dto.js'

const refreshSchema = {
  tags: ['Auth'],
  summary: 'Refresh access token',
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string' } },
  },
}

const logoutSchema = {
  tags: ['Auth'],
  summary: 'Logout and revoke refresh token',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string' } },
  },
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('../controllers/auth.controller.js').AuthController} controller
 */
export default async function authRoutes(fastify, controller) {
  fastify.post('/register', { schema: registerRouteSchema }, (req, rep) =>
    controller.register(req, rep)
  )

  fastify.post('/login', { schema: loginRouteSchema }, (req, rep) =>
    controller.login(req, rep)
  )

  fastify.post('/refresh', { schema: refreshSchema }, (req, rep) =>
    controller.refresh(req, rep)
  )

  fastify.post(
    '/logout',
    { schema: logoutSchema, preHandler: [fastify.authenticate] },
    (req, rep) => controller.logout(req, rep)
  )
}
