import type { FastifyInstance } from 'fastify'
import type { WelcomeController } from '../controllers/welcome.controller.js'

const greetSchema = {
  tags: ['Welcome'],
  summary: 'Greet the authenticated user',
  security: [{ BearerAuth: [] }],
}

export default async function welcomeRoutes(
  fastify: FastifyInstance,
  controller: WelcomeController
): Promise<void> {
  fastify.get('/', { schema: greetSchema, preHandler: [fastify.authenticate] }, (req, rep) =>
    controller.greet(req, rep)
  )
}
