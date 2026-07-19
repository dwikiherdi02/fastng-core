/**
 * Per-module database sync.
 *
 *  1. Validate module dependencies (enabled module → enabled dependencies).
 *  2. (Prisma drivers) Assemble prisma/schema.prisma from ENABLED modules' fragments,
 *     then `prisma db push --accept-data-loss` so disabled modules' tables are DROPPED.
 *  3. Sync the menu/permission catalog bidirectionally (upsert enabled, remove disabled).
 *
 * Run with: bun run db:sync
 */
import { spawnSync } from 'node:child_process'
import env from '../src/core/config/env.config.js'
import modules from '../src/registry/module.registry.js'
import { validateDependencies } from '../src/registry/dependency-validator.js'
import { assembleSchema } from '../src/core/database/schema-builder.js'

async function main(): Promise<void> {
  console.log(`\n▶ db:sync (driver: ${env.DB_DRIVER})\n`)

  // Fail loudly if a module is enabled while a dependency is disabled.
  validateDependencies(modules)

  if (env.DB_DRIVER !== 'mongodb') {
    const result = assembleSchema()
    console.log(`  Assembled schema from: ${result.includedModules.join(', ') || '(none)'}`)
    console.log('  Running: prisma db push --accept-data-loss\n')

    const push = spawnSync(
      `bunx prisma db push --schema "${result.schemaPath}" --accept-data-loss`,
      { stdio: 'inherit', shell: true }
    )
    if (push.status !== 0) {
      console.error('\n❌ prisma db push failed.')
      process.exit(push.status ?? 1)
    }
  } else {
    console.log('  MongoDB: collections are created lazily — no schema push.')
  }

  // Import DB + catalog modules AFTER a potential Prisma client regeneration,
  // so we bind to the freshly generated client (which knows the new models).
  const { connectDb, disconnectDb, getDbClient } = await import('../src/core/database/index.js')
  const { loadManifests } = await import('../src/registry/manifest.js')
  const { createCatalogSyncRepository } = await import(
    '../src/core/database/sync/catalog-sync.repository.js'
  )
  const { syncCatalog } = await import('../src/core/database/sync/catalog-sync.js')

  await connectDb()
  try {
    const repo = createCatalogSyncRepository(getDbClient())
    const manifests = await loadManifests()
    const summary = await syncCatalog(repo, manifests)
    console.log('\n  Catalog synced:')
    console.log(`    upserted menus: ${summary.syncedMenus.join(', ') || '(none)'}`)
    console.log(`    removed menus : ${summary.removedMenus.join(', ') || '(none)'}`)
  } finally {
    await disconnectDb()
  }

  console.log('\n✅ db:sync complete.\n')
}

main().catch((err) => {
  console.error(`\n❌ db:sync failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
