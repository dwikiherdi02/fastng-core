import bcrypt from 'bcryptjs'
import env from '../../config/env.config.js'
import type { ICatalogSyncRepository, RoleGrant } from './catalog-sync.repository.js'

const SALT_ROUNDS = 12

export interface SeedSummary {
  roles: string[]
  adminEmail: string
}

/**
 * Seed the default roles so the starter kit is usable immediately:
 *  - `admin` — every permission on every menu.
 *  - `user`  — `can_access` on menus that expose it.
 * Plus a default admin user (SEED_ADMIN_* env). Fully idempotent.
 *
 * Run AFTER `yarn db:sync` so the menu/permission catalog already exists.
 */
export async function seedRoles(repo: ICatalogSyncRepository): Promise<SeedSummary> {
  const menus = await repo.listMenusWithPermissions()

  await repo.upsertRole('admin', 'Administrator', 'Full access to all menus and permissions')
  const adminGrants: RoleGrant[] = menus.map((m) => ({
    menuCode: m.code,
    permissions: m.permissions,
  }))
  await repo.setRoleGrants('admin', adminGrants)

  await repo.upsertRole('user', 'User', 'Default role with basic access')
  const userGrants: RoleGrant[] = menus
    .filter((m) => m.permissions.includes('can_access'))
    .map((m) => ({ menuCode: m.code, permissions: ['can_access'] }))
  await repo.setRoleGrants('user', userGrants)

  const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, SALT_ROUNDS)
  await repo.upsertUserWithRoles(
    { username: env.SEED_ADMIN_USERNAME, email: env.SEED_ADMIN_EMAIL, passwordHash },
    ['admin']
  )

  return { roles: ['admin', 'user'], adminEmail: env.SEED_ADMIN_EMAIL }
}
