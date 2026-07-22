import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'
import { ValidationError } from '../../../core/utils/errors.js'
import { toRoleResponse } from '../dto/role.response.dto.js'
import { createRoleSchema } from '../dto/create-role.request.dto.js'
import { updateRoleSchema } from '../dto/update-role.request.dto.js'
import { setRoleGrantsSchema } from '../dto/set-role-grants.request.dto.js'
import type { RoleService } from '../services/role.service.js'

export class RoleController {
  constructor(private service: RoleService) {}

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const roles = await this.service.list()
    reply.send(successResponse(roles.map(toRoleResponse)))
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    reply.send(successResponse(toRoleResponse(await this.service.getById(id))))
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = createRoleSchema.safeParse(request.body)
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    const role = await this.service.create(parsed.data)
    reply.code(201).send(successResponse(toRoleResponse(role)))
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    const parsed = updateRoleSchema.safeParse(request.body)
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    const role = await this.service.update(id, parsed.data)
    reply.send(successResponse(toRoleResponse(role)))
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    await this.service.delete(id)
    reply.code(204).send()
  }

  async getGrants(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    reply.send(successResponse(await this.service.getGrants(id)))
  }

  async setGrants(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string }
    const parsed = setRoleGrantsSchema.safeParse(request.body)
    if (!parsed.success)
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '))
    const grants = await this.service.setGrants(id, parsed.data.grants)
    reply.send(successResponse(grants))
  }
}
