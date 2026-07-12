import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import type { AuthEntity } from '../entities/auth.entity.js'
import env from '../../../core/config/env.config.js'
import { AuthPrismaRepository } from './auth.prisma.repository.js'
import { AuthMongoRepository } from './auth.mongo.repository.js'

/** A user-level permission override (allow/deny) keyed by menu + permission code. */
export interface UserPermissionOverride {
  menuCode: string
  permissionCode: string
  effect: 'allow' | 'deny'
}

export interface IAuthRepository {
  findByEmail(email: string): Promise<{ entity: AuthEntity; passwordHash: string } | null>
  findById(id: string): Promise<AuthEntity | null>
  /** Create a user and assign the default `user` role (if seeded). */
  createUser(data: { username: string; email: string; passwordHash: string }): Promise<AuthEntity>
  /** Role codes assigned to a user (via user_roles). */
  getUserRoleCodes(userId: string): Promise<string[]>
  /** Replace a user's role assignments (admin). */
  setUserRoles(userId: string, roleCodes: string[]): Promise<void>
  /** Current user-level permission overrides. */
  getUserPermissionOverrides(userId: string): Promise<UserPermissionOverride[]>
  /** Replace a user's permission overrides (admin checklist). */
  setUserPermissionOverrides(userId: string, overrides: UserPermissionOverride[]): Promise<void>
  withClient(tx: TransactionClient): IAuthRepository
}

export function createAuthRepository(prisma: PrismaClient | null): IAuthRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new AuthMongoRepository()
  }
  return new AuthPrismaRepository(prisma!)
}
