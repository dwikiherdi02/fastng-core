import env from '../../../core/config/env.config.js'
import type { ModuleSeeder, SeederContext } from '../../../registry/seeder.js'
import { createAuthRepository } from '../repositories/auth.repository.js'

/**
 * Assigns the `admin` role to the default admin user. Runs after `users.json`
 * (order 1) in the same module. Not expressible as a JSON row: `user_roles`
 * has a composite primary key (`userId`, `roleId`), so it needs a repository
 * call rather than a single-`id` table upsert.
 */
export const seeder: ModuleSeeder = {
  name: 'AdminRoleSeeder',
  order: 2,

  async run({ db, log }: SeederContext): Promise<void> {
    const authRepo = createAuthRepository(db)
    const user = await authRepo.findByEmail(env.SEED_ADMIN_EMAIL)
    if (!user) {
      throw new Error(
        `AdminRoleSeeder: user "${env.SEED_ADMIN_EMAIL}" not found — did users.json run first?`
      )
    }
    await authRepo.setUserRoles(user.entity.id, ['admin'])
    log(`assigned role "admin" to ${env.SEED_ADMIN_EMAIL}`)
  },
}
