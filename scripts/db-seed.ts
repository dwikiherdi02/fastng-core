/**
 * Run the seeders every ENABLED module ships in `src/modules/{name}/db/seeders/`
 * (`*.json` table data, or a `*.seeder.ts` escape hatch), in registry
 * topological order (a module's seeders run after those of the modules it
 * dependsOn). All seeders are idempotent, so this is re-runnable.
 *
 * Run AFTER `bun run migrate` — the schema and the menu/permission catalog must
 * already exist.
 *
 *   bun run db:seed
 *   bun run db:seed -- --module=role
 *   bun run db:seed -- --class=roles         (JSON file basename)
 *   bun run db:seed -- --class=GrantsSeeder   (*.seeder.ts exported name)
 */
import env from '../src/core/config/env.config.js'

function flag(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv
    .slice(2)
    .find((a) => a.startsWith(prefix))
    ?.slice(prefix.length)
}

async function main(): Promise<void> {
  console.log(`\n▶ db:seed (driver: ${env.DB_DRIVER})\n`)

  const { connectDb, disconnectDb, getDbClient } = await import('../src/core/database/index.js')
  const { loadSeeders } = await import('../src/registry/seeder.js')

  const filter = { module: flag('module'), class: flag('class') }
  const seeders = await loadSeeders(filter)

  if (seeders.length === 0) {
    console.log(`  No seeders found for: ${filter.class ?? filter.module ?? 'enabled modules'}\n`)
    return
  }

  await connectDb()
  try {
    const db = getDbClient()
    for (const { module: mod, name, run } of seeders) {
      const label = `${mod.name}/${name}`
      await run({
        db,
        driver: env.DB_DRIVER,
        log: (message) => console.log(`  ${label}: ${message}`),
      })
      console.log(`  ✔ ${label}`)
    }
  } finally {
    await disconnectDb()
  }

  console.log(`\n✅ db:seed complete (${seeders.length} seeder(s)).\n`)
}

main().catch((err) => {
  console.error(`\n❌ db:seed failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
