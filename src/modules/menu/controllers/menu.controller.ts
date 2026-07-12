import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'
import type { MenuService } from '../services/menu.service.js'

export class MenuController {
  constructor(private service: MenuService) {}

  async listCatalog(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.send(successResponse(await this.service.listCatalog()))
  }
}
