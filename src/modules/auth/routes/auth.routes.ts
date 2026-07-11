import type { FastifyInstance } from 'fastify'
import { registerRouteSchema } from '../dto/register.request.dto.js'
import { loginRouteSchema } from '../dto/login.request.dto.js'
import type { AuthController } from '../controllers/auth.controller.js'

const refreshSchema = {
  tags: ['Auth'],
  summary: 'Refresh access token (rotates the refresh token)',
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string' } },
  },
}

const logoutSchema = {
  tags: ['Auth'],
  summary: 'Logout and end the current session',
  security: [{ BearerAuth: [] }],
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string' } },
  },
}

const menusSchema = {
  tags: ['Auth'],
  summary: 'Sidebar menu tree the current user can access',
  security: [{ BearerAuth: [] }],
}

const sessionsSchema = {
  tags: ['Auth'],
  summary: 'List the current user active sessions/devices',
  security: [{ BearerAuth: [] }],
}

const revokeSessionSchema = {
  tags: ['Auth'],
  summary: 'Force-logout one of the current user sessions',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
}

export default async function authRoutes(
  fastify: FastifyInstance,
  controller: AuthController
): Promise<void> {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.post('/register', { schema: registerRouteSchema }, (req, rep) =>
    controller.register(req, rep)
  )
  fastify.post('/login', { schema: loginRouteSchema }, (req, rep) => controller.login(req, rep))
  fastify.post('/refresh', { schema: refreshSchema }, (req, rep) => controller.refresh(req, rep))
  fastify.post('/logout', { schema: logoutSchema, ...auth }, (req, rep) =>
    controller.logout(req, rep)
  )

  fastify.get('/me/menus', { schema: menusSchema, ...auth }, (req, rep) =>
    controller.getMenus(req, rep)
  )
  fastify.get('/me/sessions', { schema: sessionsSchema, ...auth }, (req, rep) =>
    controller.listSessions(req, rep)
  )
  fastify.delete('/sessions/:id', { schema: revokeSessionSchema, ...auth }, (req, rep) =>
    controller.revokeSession(req, rep)
  )
}
