import type { ModuleSeeder, SeederContext } from '../../../../registry/seeder.js'
import { createMenuRepository } from '../../../menu/index.js'
import { createRoleRepository, type RoleGrant } from '../../repositories/role.repository.js'

/**
 * Grants for the default roles, derived from the live menu catalog:
 *  - `admin` — every permission of every menu.
 *  - `user`  — `can_access` only, on menus that expose it.
 *
 * Runs after `roles.json` (order 1) in the same module. Not expressible as a
 * JSON row: the set of menus/permissions changes as modules are enabled or
 * disabled, so this has to read the catalog at seed time.
 */
export const seeder: ModuleSeeder = {
  name: 'GrantsSeeder',
  order: 2,

  async run({ db, log }: SeederContext): Promise<void> {
    const roleRepo = createRoleRepository(db)
    const menuRepo = createMenuRepository(db)
    const catalog = await menuRepo.listCatalog()

    const admin = await roleRepo.findByCode('admin')
    if (!admin) throw new Error('GrantsSeeder: role "admin" not found — did roles.json run first?')
    const adminGrants: RoleGrant[] = catalog.map((menu) => ({
      menuCode: menu.code,
      permissions: menu.permissions.map((p) => p.code),
    }))
    await roleRepo.setGrants(admin.id, adminGrants)

    const user = await roleRepo.findByCode('user')
    if (!user) throw new Error('GrantsSeeder: role "user" not found — did roles.json run first?')
    const userGrants: RoleGrant[] = catalog
      .filter((menu) => menu.permissions.some((p) => p.code === 'can_access'))
      .map((menu) => ({ menuCode: menu.code, permissions: ['can_access'] }))
    await roleRepo.setGrants(user.id, userGrants)

    log(`admin (${adminGrants.length} menus), user (${userGrants.length} menus)`)
  },
}
