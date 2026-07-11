import type { PrismaClient } from '@prisma/client'
import env from '../../config/env.config.js'
import { CatalogSyncPrismaRepository } from './catalog-sync.prisma.js'
import { CatalogSyncMongoRepository } from './catalog-sync.mongo.js'

export interface MenuInput {
  code: string
  name: string
  icon?: string
  path?: string
  /** `code` of the parent menu (must belong to an enabled module synced beforehand). */
  parentCode?: string
  orderIndex: number
  /** Permission codes this menu supports (its menu_permissions catalog). */
  permissions: string[]
}

export interface MenuWithPermissions {
  code: string
  permissions: string[]
}

export interface RoleGrant {
  menuCode: string
  permissions: string[]
}

/**
 * Driver-agnostic operations for syncing the RBAC catalog (menus, permissions,
 * role grants, seed users). Prisma and Mongoose implementations conform to this
 * interface; the factory picks one based on DB_DRIVER — same pattern as module
 * repositories.
 */
export interface ICatalogSyncRepository {
  /** Upsert a permission into the global catalog (by code). */
  upsertPermission(code: string, name: string): Promise<void>
  /** Create/update a menu and reconcile its supported-permission catalog. */
  upsertMenu(menu: MenuInput): Promise<void>
  /** Delete a menu and all grants referencing it (bidirectional teardown). */
  removeMenu(code: string): Promise<void>
  /** List every menu with its supported permission codes (for seeding role grants). */
  listMenusWithPermissions(): Promise<MenuWithPermissions[]>
  /** Upsert a role by code. */
  upsertRole(code: string, name: string, description?: string): Promise<void>
  /** Replace a role's grants with the given set. */
  setRoleGrants(roleCode: string, grants: RoleGrant[]): Promise<void>
  /** Upsert a user by email and (re)assign the given roles. */
  upsertUserWithRoles(
    data: { username: string; email: string; passwordHash: string },
    roleCodes: string[]
  ): Promise<void>
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
