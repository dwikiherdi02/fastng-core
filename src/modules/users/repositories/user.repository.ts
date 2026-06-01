import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import type { UserEntity } from '../entities/user.entity.js'
import env from '../../../core/config/env.config.js'
import { UserPrismaRepository } from './user.prisma.repository.js'
import { UserMongoRepository } from './user.mongo.repository.js'

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>
  findAll(options?: { page?: number; limit?: number }): Promise<{
    items: UserEntity[]
    total: number
  }>
  update(id: string, data: { username?: string; email?: string }): Promise<UserEntity>
  delete(id: string): Promise<void>
  withClient(tx: TransactionClient): IUserRepository
}

export function createUserRepository(prisma: PrismaClient | null): IUserRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new UserMongoRepository()
  }
  return new UserPrismaRepository(prisma!)
}
