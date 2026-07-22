import type { PrismaClient } from '@prisma/client'
import env from '../../config/env.config.js'
import { CatalogSyncPrismaRepository } from './catalog-sync.prisma.js'
import { CatalogSyncMongoRepository } from './catalog-sync.mongo.js'

export interface PermissionInput {
  code: string
  name?: string
  description: string
}

export interface MenuInput {
  code: string
  name: string
  icon?: string
  path?: string
  /** `code` of the parent menu (must belong to an enabled module synced beforehand). */
  parentCode?: string
  orderIndex: number
  /** Permissions this menu supports (with descriptions). */
  permissions: PermissionInput[]
}

/**
 * Driver-agnostic operations for syncing the RBAC catalog *declared by module
 * manifests* — menus and permissions only. Seeding actual domain data (roles,
 * users, grants) belongs to the owning module's seeder, not to core.
 *
 * Prisma and Mongoose implementations conform to this interface; the factory
 * picks one based on DB_DRIVER. Cross-module links are scalar FKs, so the Prisma
 * impl resolves ids with step-wise queries rather than relation `include`s.
 */
export interface ICatalogSyncRepository {
  upsertPermission(code: string, name: string, description: string | null): Promise<void>
  upsertMenu(menu: MenuInput): Promise<void>
  removeMenu(code: string): Promise<void>
}

export function createCatalogSyncRepository(db: PrismaClient | null): ICatalogSyncRepository {
  if (env.DB_DRIVER === 'mongodb') {
    return new CatalogSyncMongoRepository()
  }
  return new CatalogSyncPrismaRepository(db!)
}

/** 'can_access' → 'Can Access'. Used to derive a human name for auto-created permissions. */
export function humanizePermission(code: string): string {
  return code
    .split(/[_\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
