import { successResponse } from '../../../core/utils/response.js'
import { toAuthResponse } from '../dto/auth.response.dto.js'
import { registerRequestSchema } from '../dto/register.request.dto.js'
import { loginRequestSchema } from '../dto/login.request.dto.js'
import { ValidationError } from '../../../core/utils/errors.js'

export class AuthController {
  /** @param {import('../services/auth.service.js').AuthService} service */
  constructor(service) {
    this.service = service
  }

  async register(request, reply) {
    const parsed = registerRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const { entity, tokens } = await this.service.register(parsed.data)
    return reply.code(201).send(successResponse(toAuthResponse(entity, tokens)))
  }

  async login(request, reply) {
    const parsed = loginRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const { entity, tokens } = await this.service.login(parsed.data)
    return reply.send(successResponse(toAuthResponse(entity, tokens)))
  }

  async refresh(request, reply) {
    const { refreshToken } = request.body ?? {}
    if (!refreshToken) throw new ValidationError('refreshToken is required')
    const { entity, tokens } = await this.service.refreshToken(refreshToken)
    return reply.send(successResponse(toAuthResponse(entity, tokens)))
  }

  async logout(request, reply) {
    const { refreshToken } = request.body ?? {}
    if (!refreshToken) throw new ValidationError('refreshToken is required')
    await this.service.logout(refreshToken)
    return reply.send(successResponse({ message: 'Logged out successfully' }))
  }
}
