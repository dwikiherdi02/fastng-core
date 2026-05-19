import { successResponse } from '../../../core/utils/response.js'

export class WelcomeController {
  async greet(request, reply) {
    return reply.send(
      successResponse({ message: `Hello, ${request.user.username}!` })
    )
  }
}
