import env from '../../../core/config/env.config.js'
import { AuthPrismaRepository } from './auth.prisma.repository.js'
import { AuthMongoRepository } from './auth.mongo.repository.js'

/**
 * Factory — returns the correct repository implementation for the active DB driver.
 * @param {import('@prisma/client').PrismaClient | null} prisma
 */
export function createAuthRepository(prisma) {
  if (env.DB_DRIVER === 'mongodb') {
    return new AuthMongoRepository()
  }
  return new AuthPrismaRepository(prisma)
}
