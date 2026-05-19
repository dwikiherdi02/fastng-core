import { WelcomeController } from './controllers/welcome.controller.js'
import welcomeRoutes from './routes/welcome.routes.js'

/**
 * Welcome module entry point.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function welcomeModule(fastify) {
  const controller = new WelcomeController()

  fastify.register(
    async (instance) => {
      await welcomeRoutes(instance, controller)
    },
    { prefix: '/api/v1/welcome' }
  )
}
