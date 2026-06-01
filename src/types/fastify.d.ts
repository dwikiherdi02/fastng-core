import type { PrismaClient } from '@prisma/client'
import type { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient | null
    dbDriver: string
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; [key: string]: unknown }
    user: { sub: string; username: string; role: string }
  }
}
