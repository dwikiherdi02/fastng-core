import type { PrismaClient } from '@prisma/client'
import type { FastifyRequest, FastifyReply } from 'fastify'

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient | null
    dbDriver: string
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>
    /** Guard factory: requires the given permission on the given menu (dynamic RBAC). */
    authorize(menuCode: string, permissionCode: string): PreHandler
    /** Guard factory: requires `can_access` on the given menu (gates a whole route group). */
    requireMenuAccess(menuCode: string): PreHandler
    /** Guard factory: requires at least one of the given role codes. */
    requireRole(...roleCodes: string[]): PreHandler
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; [key: string]: unknown }
    user: { sub: string; sid: string; jti: string; username: string; roles: string[] }
  }
}
