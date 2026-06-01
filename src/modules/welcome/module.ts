import type { FastifyInstance } from 'fastify'
import { WelcomeController } from './controllers/welcome.controller.js'
import welcomeRoutes from './routes/welcome.routes.js'

export default async function welcomeModule(fastify: FastifyInstance): Promise<void> {
  const controller = new WelcomeController()

  fastify.register(
    async (instance) => {
      await welcomeRoutes(instance, controller)
    },
    { prefix: '/api/v1/welcome' }
  )
}
