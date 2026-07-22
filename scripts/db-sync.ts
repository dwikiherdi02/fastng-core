/**
 * Reconcile the menu/permission catalog with the module registry: enabled
 * modules' manifests are upserted, disabled modules' menus are removed.
 *
 * Schema changes are NOT handled here — `bun run migrate` owns those and runs
 * this same catalog sync at the end. Use this script standalone when you only
 * touched a `{name}.manifest.ts`.
 *
 * Run with: bun run db:sync
 */
import env from '../src/core/config/env.config.js'
import modules from '../src/registry/module.registry.js'
import { validateDependencies } from '../src/registry/dependency-validator.js'

async function main(): Promise<void> {
  console.log(`\n▶ db:sync (driver: ${env.DB_DRIVER})\n`)

  // Fail loudly if a module is enabled while a dependency is disabled.
  validateDependencies(modules)

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
    console.log('  Catalog synced:')
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
