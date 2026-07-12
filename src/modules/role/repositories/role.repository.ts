import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import env from '../../../core/config/env.config.js'
import { RolePrismaRepository } from './role.prisma.repository.js'
import { RoleMongoRepository } from './role.mongo.repository.js'

export interface RoleRecord {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/** A role's grant: for a menu (by code), which permission codes it holds. */
export interface RoleGrant {
  menuCode: string
  permissions: string[]
}

export interface IRoleRepository {
  list(): Promise<RoleRecord[]>
  findById(id: string): Promise<RoleRecord | null>
  findByCode(code: string): Promise<RoleRecord | null>
  create(data: { code: string; name: string; description?: string }): Promise<RoleRecord>
  update(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<RoleRecord | null>
  delete(id: string): Promise<void>
  /** Current grants of a role as (menuCode → permission codes). */
  getGrants(roleId: string): Promise<RoleGrant[]>
  /** Replace a role's grants with the given set. */
  setGrants(roleId: string, grants: RoleGrant[]): Promise<void>
  withClient(tx: TransactionClient): IRoleRepository
}

export function createRoleRepository(prisma: PrismaClient | null): IRoleRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new RoleMongoRepository()
  }
  return new RolePrismaRepository(prisma!)
}
