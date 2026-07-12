import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { ForbiddenError } from '../utils/errors.js'
import { createRbacReader } from '../rbac/rbac.reader.js'

/**
 * Authorization guards. Must run AFTER `fastify.authenticate` in a route's
 * preHandler chain (they read `request.user` from the verified JWT).
 *
 *   preHandler: [fastify.authenticate, fastify.authorize('user_management', 'delete')]
 *   preHandler: [fastify.authenticate, fastify.requireMenuAccess('user_management')]
 *   preHandler: [fastify.authenticate, fastify.requireRole('admin')]
 *
 * Effective permission = user override (allow/deny) over role grant; `can_access`
 * gates the whole menu (a denied `can_access` fails every other permission on it).
 * Enforcement is route-middleware only — internal service-to-service calls are
 * never affected.
 */
const authGuardPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authorize', function (menuCode: string, permissionCode: string) {
    return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const roles = request.user?.roles ?? []
      const userId = request.user?.sub ?? ''
      const reader = createRbacReader(fastify.db)
      const allowed = await reader.hasPermission(userId, roles, menuCode, permissionCode)
      if (!allowed) {
        throw new ForbiddenError(`Missing permission "${permissionCode}" on "${menuCode}"`)
      }
    }
  })

  // Gate a whole route group on the menu's `can_access` permission.
  fastify.decorate('requireMenuAccess', function (menuCode: string) {
    return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
      const roles = request.user?.roles ?? []
      const userId = request.user?.sub ?? ''
      const reader = createRbacReader(fastify.db)
      if (!(await reader.hasPermission(userId, roles, menuCode, 'can_access'))) {
        throw new ForbiddenError(`No access to "${menuCode}"`)
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
