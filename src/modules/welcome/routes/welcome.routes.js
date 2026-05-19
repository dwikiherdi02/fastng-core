/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {import('../controllers/welcome.controller.js').WelcomeController} controller
 */
export default async function welcomeRoutes(fastify, controller) {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Welcome'],
        summary: 'Returns a greeting for the authenticated user',
        security: [{ BearerAuth: [] }],
      },
    },
    (req, rep) => controller.greet(req, rep)
  )
}
