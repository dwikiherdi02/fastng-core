// Public API for the auth module.
// Only this file may be imported by other modules.

export { AuthService } from './services/auth.service.js'
export { createAuthRepository } from './repositories/auth.repository.js'

/**
 * Reusable authenticate preHandler.
 * Relies on fastify.authenticate decorated by jwt.plugin.
 *
 * Usage in another module's route:
 *   import { authenticate } from '../auth/index.js'
 *   fastify.get('/protected', { preHandler: [fastify.authenticate] }, handler)
 *
 * The authenticate decorator is added by jwt.plugin — no need to re-export.
 * This file documents it as the canonical access point.
 */
