import env from '../../../core/config/env.config.js'
import { UserPrismaRepository } from './user.prisma.repository.js'
import { UserMongoRepository } from './user.mongo.repository.js'

/**
 * Factory — returns the correct repository implementation for the active DB driver.
 * @param {import('@prisma/client').PrismaClient | null} prisma
 */
export function createUserRepository(prisma) {
  if (env.DB_DRIVER === 'mongodb') {
    return new UserMongoRepository()
  }
  return new UserPrismaRepository(prisma)
}
