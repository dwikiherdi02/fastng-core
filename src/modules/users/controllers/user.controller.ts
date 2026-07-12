import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'
import { toUserResponse } from '../dto/user.response.dto.js'
import { updateProfileRequestSchema } from '../dto/update-profile.request.dto.js'
import { assignRolesSchema } from '../dto/assign-roles.request.dto.js'
import { setUserPermissionsSchema } from '../dto/set-user-permissions.request.dto.js'
import { ValidationError } from '../../../core/utils/errors.js'
import type { UserService } from '../services/user.service.js'

export class UserController {
  private service: UserService

  constructor(service: UserService) {
    this.service = service
  }

  async getMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const entity = await this.service.getProfile(request.user.sub)
    reply.send(successResponse(toUserResponse(entity)))
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = updateProfileRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const entity = await this.service.updateProfile(request.user.sub, parsed.data)
    reply.send(successResponse(toUserResponse(entity)))
  }

  async listUsers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { page?: string; limit?: string }
    const page = query.page ? parseInt(query.page) : 1
    const limit = query.limit ? parseInt(query.limit) : 20
    const { items, total } = await this.service.listUsers({ page, limit })
    reply.send(successResponse(items.map(toUserResponse), { total, page, limit }))
  }

  async getUserById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = request.params as { id: string }
    const entity = await this.service.getUserById(params.id)
    reply.send(successResponse(toUserResponse(entity)))
  }

  async deleteUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = request.params as { id: string }
    await this.service.deleteUser(request.user.sub, params.id)
    reply.code(204).send()
  }

  async assignRoles(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    const parsed = assignRolesSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    const entity = await this.service.assignRoles(id, parsed.data.roles)
    reply.send(successResponse(toUserResponse(entity)))
  }

  async getPermissions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    reply.send(successResponse(await this.service.getPermissionOverrides(id)))
  }

  async setPermissions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    const parsed = setUserPermissionsSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    }
    reply.send(successResponse(await this.service.setPermissionOverrides(id, parsed.data.overrides)))
  }
}
