import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'
import type { PermissionService } from '../services/permission.service.js'

export class PermissionController {
  constructor(private service: PermissionService) {}

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.send(successResponse(await this.service.list()))
  }
}
