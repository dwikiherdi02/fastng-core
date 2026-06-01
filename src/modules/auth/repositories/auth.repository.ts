import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import type { AuthEntity } from '../entities/auth.entity.js'
import env from '../../../core/config/env.config.js'
import { AuthPrismaRepository } from './auth.prisma.repository.js'
import { AuthMongoRepository } from './auth.mongo.repository.js'

export interface RefreshTokenRecord {
  token: string
  userId: string | { toString(): string }
  expiresAt: Date
}

export interface IAuthRepository {
  findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null>
  findById(id: string): Promise<AuthEntity | null>
  createUser(data: { username: string; email: string; passwordHash: string }): Promise<AuthEntity>
  saveRefreshToken(data: { token: string; userId: string; expiresAt: Date }): Promise<void>
  findRefreshToken(token: string): Promise<RefreshTokenRecord | null>
  deleteRefreshToken(token: string): Promise<void>
  deleteAllRefreshTokensForUser(userId: string): Promise<void>
  withClient(tx: TransactionClient): IAuthRepository
}

export function createAuthRepository(prisma: PrismaClient | null): IAuthRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new AuthMongoRepository()
  }
  return new AuthPrismaRepository(prisma!)
}
