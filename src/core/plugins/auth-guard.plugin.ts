import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '../utils/errors.js'
import { createRbacReader } from '../rbac/rbac.reader.js'

/**
 * Authorization guards. Must run AFTER `fastify.authenticate` in a route's
 * preHandler chain (they read `request.user` from the verified JWT).
 *
 *   preHandler: [fastify.authenticate, fastify.authorize('user_management', 'delete')]
 *   preHandler: [fastify.authenticate, fastify.requireRole('admin')]
 */
const authGuardPlugin: FastifyPluginAsync = async (fastify) => {
  // Dynamic RBAC: does any of the user's roles grant `permissionCode` on `menuCode`?
  fastify.decorate('authorize', function (menuCode: string, permissionCode: string) {
    return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const roles = request.user?.roles ?? []
      const reader = createRbacReader(fastify.db)
      const allowed = await reader.hasPermission(roles, menuCode, permissionCode)
      if (!allowed) {
        throw new ForbiddenError(`Missing permission "${permissionCode}" on "${menuCode}"`)
      }
    }
  })

  // Coarse role check (union): user must hold at least one of the given role codes.
  fastify.decorate('requireRole', function (...roleCodes: string[]) {
    return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const roles = request.user?.roles ?? []
      if (!roleCodes.some((code) => roles.includes(code))) {
        throw new ForbiddenError(`Requires one of roles: ${roleCodes.join(', ')}`)
      }
    }
  })
}

export default fp(authGuardPlugin, { name: 'auth-guard' })
