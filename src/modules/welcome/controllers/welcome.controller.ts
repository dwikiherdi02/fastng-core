import type { FastifyRequest, FastifyReply } from 'fastify'
import { successResponse } from '../../../core/utils/response.js'

export class WelcomeController {
  async greet(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    reply.send(successResponse({ message: `Hello, ${request.user.username}!` }))
  }
}
