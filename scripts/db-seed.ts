/**
 * Seed default roles (admin/user), their grants, and a default admin user so the
 * starter kit is usable immediately. Idempotent.
 *
 * Run AFTER `bun run db:sync` (the menu/permission catalog must already exist).
 * Run with: bun run db:seed
 */
import env from '../src/core/config/env.config.js'

async function main(): Promise<void> {
  console.log(`\n▶ db:seed (driver: ${env.DB_DRIVER})\n`)

  const { connectDb, disconnectDb, getDbClient } = await import('../src/core/database/index.js')
  const { createCatalogSyncRepository } = await import(
    '../src/core/database/sync/catalog-sync.repository.js'
  )
  const { seedRoles } = await import('../src/core/database/sync/roles-seeder.js')

  await connectDb()
  try {
    const repo = createCatalogSyncRepository(getDbClient())
    const summary = await seedRoles(repo)
    console.log(`  Seeded roles: ${summary.roles.join(', ')}`)
    console.log(`  Admin user  : ${summary.adminEmail} (password from SEED_ADMIN_PASSWORD)`)
  } finally {
    await disconnectDb()
  }

  console.log('\n✅ db:seed complete.\n')
}

main().catch((err) => {
  console.error(`\n❌ db:seed failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
