import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { PrismaClient } from '@prisma/client'
import env from '../../config/env.config.js'
import { findProjectRoot } from '../../utils/project-root.js'
import { validateDependencies } from '../../../registry/dependency-validator.js'
import modules from '../../../registry/module.registry.js'
import { assembleSchema } from '../schema-builder.js'
import { MigrationLedger } from './migration.ledger.js'
import {
  allModules,
  composeModuleSchema,
  currentSnapshotPath,
  enabledModules,
  findMigration,
  hasFragment,
  listAllMigrations,
  listMigrations,
  migrationDriver,
  migrationTimestamp,
  schemaPath,
  writeMigration,
  type MigrationFile,
} from './migration.files.js'

export interface MigrateOptions {
  /** Name of the migration to create, e.g. `add_posts`. Applies to every module touched in this run. */
  name?: string
  /** Number of batches to roll back (rollback only). */
  step?: number
  /** Run `db:seed` once the database is migrated. */
  seed?: boolean
}

const quote = (p: string): string => `"${p}"`

/** Run a prisma CLI command, streaming its output. Throws on failure. */
function prisma(args: string): void {
  const result = spawnSync(`bunx prisma ${args}`, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    throw new Error(
      `prisma ${args.split(' ').slice(0, 2).join(' ')} failed (exit ${result.status}).`
    )
  }
}

let clientGenerated = false

/**
 * Regenerate the Prisma client for the freshly assembled schema.
 *
 * MUST run before the client is imported: on Windows the loaded query-engine
 * DLL cannot be replaced while this process holds it (EPERM). The flag keeps
 * nested commands (`fresh` → `migrate`) from generating twice.
 */
function regenerateClient(): void {
  if (clientGenerated) return
  prisma('generate')
  clientGenerated = true
}

/** Send a .sql file to the database. This is how every migration is applied and reverted. */
function execute(file: string): void {
  prisma(`db execute --schema ${quote(schemaPath())} --file ${quote(file)}`)
}

/**
 * Diff two sources into an executable SQL script. Datamodel-to-datamodel diffs
 * need no shadow database, which is what lets us generate both the up and the
 * down script offline. `--exit-code` reports 2 when the diff is non-empty.
 */
function diff(from: string, to: string): { sql: string; empty: boolean } {
  const result = spawnSync(
    `bunx prisma migrate diff --from-${from} --to-${to} --script --exit-code`,
    {
      encoding: 'utf8',
      shell: true,
    }
  )
  if (result.status === 0) return { sql: result.stdout, empty: true }
  if (result.status === 2) return { sql: result.stdout, empty: false }
  throw new Error(`prisma migrate diff failed: ${result.stderr || result.stdout}`)
}

const datamodel = (p: string): string => `schema-datamodel ${quote(p)}`

/** Diff between two standalone datamodel files (a module's composed schema, or the driver base block). */
function diffSchemas(from: string, to: string): { sql: string; empty: boolean } {
  return diff(datamodel(from), datamodel(to))
}

/**
 * Script that drops everything currently in the live database (introspected
 * from the datasource, so it covers the ledger table too). Empty when the
 * database has no objects at all. Whole-database, not per-module — used only
 * by `fresh`, which rebuilds everything from scratch anyway.
 */
/**
 * `prisma migrate diff --from-schema-datasource` connects to the live database
 * to introspect it — for SQLite that fails with P1003 if the file doesn't
 * exist yet at all (a brand-new project), as opposed to existing-but-empty.
 * Touch the file first so a missing database reads as "empty" instead of erroring.
 */
function ensureSqliteFileExists(): void {
  if (env.DB_DRIVER !== 'sqlite' || !env.DATABASE_URL) return
  const relative = env.DATABASE_URL.replace(/^file:/, '')
  const resolved = path.isAbsolute(relative)
    ? relative
    : path.join(findProjectRoot(), 'prisma', relative)
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.writeFileSync(resolved, '')
  }
}

function dropAllScript(): { sql: string; empty: boolean } {
  ensureSqliteFileExists()
  return diff(`schema-datasource ${quote(schemaPath())}`, 'empty')
}

function isMongo(): boolean {
  return env.DB_DRIVER === 'mongodb'
}

function mongoNotice(command: string): void {
  console.log(
    `  Driver mongodb: schema migrations do not apply (collections are created lazily).\n` +
      `  "${command}" only reconciles the menu/permission catalog.`
  )
}

async function withDb<T>(
  fn: (client: PrismaClient, ledger: MigrationLedger) => Promise<T>
): Promise<T> {
  const { connectDb, disconnectDb, getDbClient } = await import('../index.js')
  await connectDb()
  try {
    const client = getDbClient()!
    const ledger = new MigrationLedger(client)
    await ledger.ensureTable()
    return await fn(client, ledger)
  } finally {
    await disconnectDb()
  }
}

/** Reconcile the menu/permission catalog declared by module manifests. */
async function syncCatalog(): Promise<void> {
  const { connectDb, disconnectDb, getDbClient } = await import('../index.js')
  const { loadManifests } = await import('../../../registry/manifest.js')
  const { createCatalogSyncRepository } = await import('../sync/catalog-sync.repository.js')
  const { syncCatalog: run } = await import('../sync/catalog-sync.js')

  await connectDb()
  try {
    const summary = await run(createCatalogSyncRepository(getDbClient()), await loadManifests())
    console.log('\n  Catalog synced:')
    console.log(`    upserted menus: ${summary.syncedMenus.join(', ') || '(none)'}`)
    console.log(`    removed menus : ${summary.removedMenus.join(', ') || '(none)'}`)
  } finally {
    await disconnectDb()
  }
}

function runSeed(): void {
  console.log('\n  Running seeders...')
  const result = spawnSync('bun run db:seed', { stdio: 'inherit', shell: true })
  if (result.status !== 0) throw new Error(`db:seed failed (exit ${result.status}).`)
}

/** Module declaration order — a stand-in for "reverse dependency order" when reverting. */
function moduleOrderIndex(name: string): number {
  return allModules().findIndex((m) => m.name === name)
}

/**
 * Fail fast if a module's existing migration history was written for a
 * different driver — the SQL in `migration.sql`/`down.sql` is dialect-specific
 * and cannot be replayed across drivers.
 */
function assertDriverMatches(module: string): void {
  const written = migrationDriver(module)
  if (written && written !== env.DB_DRIVER) {
    throw new Error(
      `Module "${module}" has migrations written for driver "${written}", but DB_DRIVER is "${env.DB_DRIVER}". ` +
        `Delete src/modules/${module}/db/migrations/ and run \`bun run migrate\` again.`
    )
  }
}

/** Apply a single module's migrations not yet in the ledger, recording them under `batch`. */
async function applyPending(
  ledger: MigrationLedger,
  module: string,
  batch: number
): Promise<string[]> {
  const recorded = new Set(
    (await ledger.list()).filter((e) => e.module === module).map((e) => e.migration)
  )
  const pending = listMigrations(module).filter((m) => !recorded.has(m.name))

  for (const migration of pending) {
    execute(migration.upPath)
    await ledger.record(module, migration.name, batch)
    console.log(`  Applied: ${module}/${migration.name} (batch ${batch})`)
  }
  return pending.map((m) => m.name)
}

/** Default migration name: `init` for a module's first migration, `update` afterwards. */
function defaultName(module: string): string {
  return listMigrations(module).length === 0 ? 'init' : 'update'
}

/** Diff a module's current snapshot against its fragment and write a migration if anything changed. */
function createMigration(module: string, name: string | undefined): MigrationFile | null {
  const from = currentSnapshotPath(module)
  const to = composeModuleSchema(module)

  try {
    const up = diffSchemas(from, to)
    if (up.empty) return null

    const down = diffSchemas(to, from)
    const folder = `${migrationTimestamp()}_${name ?? defaultName(module)}`
    const migration = writeMigration(module, folder, {
      up: up.sql,
      down: down.sql,
      snapshot: fs.readFileSync(to, 'utf8'),
    })
    console.log(`  Created migration: ${module}/${migration.name}`)
    return migration
  } finally {
    fs.rmSync(to, { force: true })
  }
}

/** Replay a migration's `down.sql`, then forget it. */
async function revert(ledger: MigrationLedger, module: string, name: string): Promise<void> {
  const migration = findMigration(module, name)
  if (!migration) {
    throw new Error(
      `Migration "${module}/${name}" is recorded as applied but its folder is missing.`
    )
  }
  if (!fs.existsSync(migration.downPath)) {
    throw new Error(
      `Migration "${module}/${name}" has no down.sql — it cannot be rolled back. ` +
        `Use \`bun run migrate:fresh\` to rebuild the database instead.`
    )
  }

  execute(migration.downPath)
  await ledger.forget(module, name)
  console.log(`  Rolled back: ${module}/${name}`)
}

/** Revert every migration belonging to disabled modules that the ledger still shows as applied. */
async function revertDisabledModules(ledger: MigrationLedger): Promise<void> {
  const applied = await ledger.list()
  const disabledNames = new Set(
    allModules()
      .filter((m) => !m.enabled)
      .map((m) => m.name)
  )
  const toRevert = applied
    .filter((e) => disabledNames.has(e.module))
    .sort((a, b) => {
      const byModule = moduleOrderIndex(b.module) - moduleOrderIndex(a.module)
      return byModule !== 0 ? byModule : a.migration < b.migration ? 1 : -1
    })

  for (const entry of toRevert) {
    await revert(ledger, entry.module, entry.migration)
  }
}

/** Roll back the newest `batches` batches, across every module, reverting in reverse order. */
async function rollbackBatches(ledger: MigrationLedger, batches: number): Promise<number> {
  const entries = await ledger.list()
  if (entries.length === 0) {
    console.log('  Nothing to rollback.')
    return 0
  }

  const targets = [...new Set(entries.map((e) => e.batch))].sort((a, b) => b - a).slice(0, batches)
  const doomed = entries
    .filter((e) => targets.includes(e.batch))
    .sort((a, b) => {
      const byModule = moduleOrderIndex(b.module) - moduleOrderIndex(a.module)
      return byModule !== 0 ? byModule : a.migration < b.migration ? 1 : -1
    })

  for (const entry of doomed) {
    await revert(ledger, entry.module, entry.migration)
  }
  return doomed.length
}

// ─── Commands ────────────────────────────────────────────────────────────────

/**
 * `migrate` — for every enabled module with a schema fragment: apply anything
 * pending, then diff its snapshot against its fragment and turn the difference
 * into a new migration (owned by that module) if there is one. Modules that
 * were just disabled have their applied migrations rolled back automatically.
 * Everything applied in one run shares a batch.
 */
export async function migrate(opts: MigrateOptions = {}): Promise<void> {
  validateDependencies(modules)

  if (isMongo()) {
    mongoNotice('migrate')
    await syncCatalog()
    return
  }

  assembleSchema()
  regenerateClient()

  const targets = enabledModules()
    .map((m) => m.name)
    .filter(hasFragment)
  for (const module of targets) assertDriverMatches(module)

  await withDb(async (_client, ledger) => {
    const batch = (await ledger.lastBatch()) + 1

    for (const module of targets) {
      const applied = await applyPending(ledger, module, batch)
      const created = createMigration(module, opts.name)
      if (!created) {
        if (applied.length === 0) console.log(`  ${module}: up to date.`)
        continue
      }
      execute(created.upPath)
      await ledger.record(module, created.name, batch)
      console.log(`  Applied: ${module}/${created.name} (batch ${batch})`)
    }

    await revertDisabledModules(ledger)
  })

  await syncCatalog()
  if (opts.seed) runSeed()
}

/**
 * `migrate:install` — create the migration repository.
 *
 * When a module already has tables but no migration on disk yet (a database
 * built with the old `prisma db push` flow), a baseline migration is generated
 * and marked as applied *without* executing it, so existing data survives.
 */
export async function install(): Promise<void> {
  if (isMongo()) {
    mongoNotice('migrate:install')
    return
  }

  assembleSchema()
  regenerateClient()

  // Probe BEFORE creating the ledger table, otherwise the ledger itself would
  // make an otherwise-empty database look populated.
  const populated = !dropAllScript().empty
  const targets = enabledModules()
    .map((m) => m.name)
    .filter(hasFragment)

  await withDb(async (_client, ledger) => {
    console.log('  Migration repository ready.')

    if ((await ledger.list()).length > 0) {
      console.log('  Already installed — nothing to adopt.')
      return
    }
    if (!populated) {
      console.log('  Database is empty — run `bun run migrate` to create the first migrations.')
      return
    }

    let adopted = 0
    for (const module of targets) {
      const onDisk = listMigrations(module)
      if (onDisk.length > 0) {
        for (const migration of onDisk) await ledger.record(module, migration.name, 1)
        adopted += onDisk.length
        continue
      }
      const baseline = createMigration(module, 'baseline')
      if (baseline) {
        await ledger.record(module, baseline.name, 1)
        adopted += 1
      }
    }
    console.log(`  Baselined: adopted ${adopted} migration(s) as batch 1 (not executed).`)
    console.log(
      '  If the database did NOT already match the newest schema, run `bun run migrate:fresh`.'
    )
  })
}

/** `migrate:status` — which migrations have run, grouped by module. */
export async function status(): Promise<void> {
  if (isMongo()) {
    mongoNotice('migrate:status')
    return
  }

  const onDisk = listAllMigrations()
  if (onDisk.length === 0) {
    console.log('  No migrations found. Run `bun run migrate` to create the first ones.')
    return
  }

  const enabledByName = new Map(allModules().map((m) => [m.name, m.enabled]))

  await withDb(async (_client, ledger) => {
    const batchByKey = new Map(
      (await ledger.list()).map((e) => [`${e.module}/${e.migration}`, e.batch])
    )
    const moduleWidth = Math.max(...onDisk.map((m) => m.module.length), 6)
    const nameWidth = Math.max(...onDisk.map((m) => m.name.length), 9)

    console.log(
      `  ${'Module'.padEnd(moduleWidth)}  ${'Migration'.padEnd(nameWidth)}  Batch  Status`
    )
    console.log(`  ${'-'.repeat(moduleWidth)}  ${'-'.repeat(nameWidth)}  -----  -------`)
    for (const migration of onDisk) {
      const batch = batchByKey.get(`${migration.module}/${migration.name}`)
      const label =
        batch === undefined ? (enabledByName.get(migration.module) ? 'Pending' : 'Disabled') : 'Ran'
      console.log(
        `  ${migration.module.padEnd(moduleWidth)}  ${migration.name.padEnd(nameWidth)}  ${String(batch ?? '-').padEnd(5)}  ${label}`
      )
    }
  })
}

/** `migrate:rollback` — undo the last batch (or `--step=N` batches). */
export async function rollback(opts: MigrateOptions = {}): Promise<void> {
  if (isMongo()) {
    mongoNotice('migrate:rollback')
    return
  }

  const count = await withDb((_client, ledger) => rollbackBatches(ledger, opts.step ?? 1))
  if (count > 0) {
    console.log(`\n  ${count} migration(s) rolled back.`)
    console.log(
      '  Module fragments still describe the newest state — run `bun run migrate` to re-apply.'
    )
  }
}

/** `migrate:reset` — roll back every batch, leaving an empty migration history. */
export async function reset(): Promise<void> {
  if (isMongo()) {
    mongoNotice('migrate:reset')
    return
  }

  const count = await withDb((_client, ledger) => rollbackBatches(ledger, Number.MAX_SAFE_INTEGER))
  if (count > 0) console.log(`\n  ${count} migration(s) rolled back.`)
}

/** `migrate:refresh` — roll everything back with down.sql, then apply it all again. */
export async function refresh(opts: MigrateOptions = {}): Promise<void> {
  if (isMongo()) {
    mongoNotice('migrate:refresh')
    await syncCatalog()
    return
  }

  assembleSchema()
  regenerateClient()
  const targets = enabledModules()
    .map((m) => m.name)
    .filter(hasFragment)

  await withDb(async (_client, ledger) => {
    await rollbackBatches(ledger, Number.MAX_SAFE_INTEGER)
    let total = 0
    for (const module of targets) total += (await applyPending(ledger, module, 1)).length
    console.log(`  Re-applied ${total} migration(s) as batch 1.`)
  })

  await syncCatalog()
  if (opts.seed) runSeed()
}

/**
 * `migrate:fresh` — drop every table, then re-run all migrations from scratch.
 * Unlike `migrate:refresh` this ignores `down.sql`, so it also works when the
 * database has drifted or a down script is broken.
 */
export async function fresh(opts: MigrateOptions = {}): Promise<void> {
  if (isMongo()) {
    mongoNotice('migrate:fresh')
    await syncCatalog()
    return
  }

  assembleSchema()
  regenerateClient()

  const drop = dropAllScript()
  if (drop.empty) {
    console.log('  Database is already empty.')
  } else {
    // Introspected from the live datasource, so this drops the ledger table too;
    // `withDb` recreates it immediately after.
    const scriptPath = path.join(os.tmpdir(), `fastng-drop-${Date.now()}.sql`)
    fs.writeFileSync(scriptPath, drop.sql)
    try {
      execute(scriptPath)
      console.log('  Dropped all tables.')
    } finally {
      fs.rmSync(scriptPath, { force: true })
    }
  }

  const targets = enabledModules()
    .map((m) => m.name)
    .filter(hasFragment)

  await withDb(async (_client, ledger) => {
    await ledger.clear()
    for (const module of targets) await applyPending(ledger, module, 1)
  })

  // Newly enabled modules may still need a migration of their own.
  await migrate({ name: opts.name })
  if (opts.seed) runSeed()
}
