import { successResponse } from '../../../core/utils/response.js'
import { toUserResponse } from '../dto/user.response.dto.js'
import { updateProfileRequestSchema } from '../dto/update-profile.request.dto.js'
import { ValidationError, ForbiddenError } from '../../../core/utils/errors.js'

export class UserController {
  /** @param {import('../services/user.service.js').UserService} service */
  constructor(service) {
    this.service = service
  }

  async getMe(request, reply) {
    const entity = await this.service.getProfile(request.user.sub)
    return reply.send(successResponse(toUserResponse(entity)))
  }

  async updateMe(request, reply) {
    const parsed = updateProfileRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const entity = await this.service.updateProfile(request.user.sub, parsed.data)
    return reply.send(successResponse(toUserResponse(entity)))
  }

  async listUsers(request, reply) {
    if (request.user.role !== 'admin') throw new ForbiddenError('Admin access required')
    const page = parseInt(request.query.page ?? '1')
    const limit = parseInt(request.query.limit ?? '20')
    const { items, total } = await this.service.listUsers({ page, limit })
    return reply.send(
      successResponse(items.map(toUserResponse), { total, page, limit })
    )
  }

  async getUserById(request, reply) {
    if (request.user.role !== 'admin') throw new ForbiddenError('Admin access required')
    const entity = await this.service.getUserById(request.user.sub, request.params.id)
    return reply.send(successResponse(toUserResponse(entity)))
  }

  async deleteUser(request, reply) {
    if (request.user.role !== 'admin') throw new ForbiddenError('Admin access required')
    await this.service.deleteUser(request.user.sub, request.params.id)
    return reply.code(204).send()
  }
}
