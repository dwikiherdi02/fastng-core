import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'
import { toAuthResponse } from '../dto/auth.response.dto.js'
import { toSessionResponse } from '../dto/session.response.dto.js'
import { registerRequestSchema } from '../dto/register.request.dto.js'
import { loginRequestSchema } from '../dto/login.request.dto.js'
import { ValidationError } from '../../../core/utils/errors.js'
import type { AuthService, RequestContext } from '../services/auth.service.js'

function contextOf(request: FastifyRequest): RequestContext {
  return { deviceInfo: request.headers['user-agent'], ipAddress: request.ip }
}

export class AuthController {
  private service: AuthService

  constructor(service: AuthService) {
    this.service = service
  }

  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = registerRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const { entity, tokens } = await this.service.register(parsed.data, contextOf(request))
    reply.code(201).send(successResponse(toAuthResponse(entity, tokens)))
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = loginRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const { entity, tokens } = await this.service.login(parsed.data, contextOf(request))
    reply.send(successResponse(toAuthResponse(entity, tokens)))
  }

  async refresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as Record<string, unknown>
    const refreshToken = body?.refreshToken
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new ValidationError('refreshToken is required')
    }
    const { entity, tokens } = await this.service.refreshToken(refreshToken)
    reply.send(successResponse(toAuthResponse(entity, tokens)))
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = request.body as Record<string, unknown>
    const refreshToken = body?.refreshToken
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new ValidationError('refreshToken is required')
    }
    await this.service.logout(refreshToken)
    reply.send(successResponse({ message: 'Logged out successfully' }))
  }

  async getMenus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const menus = await this.service.getMenus(request.user.roles)
    reply.send(successResponse(menus))
  }

  async listSessions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const sessions = await this.service.listSessions(request.user.sub)
    reply.send(successResponse(sessions.map(toSessionResponse)))
  }

  async revokeSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = request.params as { id: string }
    await this.service.revokeSession(request.user.sub, params.id)
    reply.send(successResponse({ message: 'Session revoked' }))
  }
}
