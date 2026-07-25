import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PrismaClient } from '@prisma/client'
import type { Env } from '../core/config/env.config.js'
import { findProjectRoot } from '../core/utils/project-root.js'
import { type ModuleConfig } from './module.registry.js'
import { resolveModules } from './topology.js'

/**
 * What a seeder receives when it runs. `db` is the raw client only so a
 * `*.seeder.ts` escape hatch can build its module's repositories via the usual
 * factory — seeders must never query the database directly.
 */
export interface SeederContext {
  /** PrismaClient, or `null` for the mongodb driver (same contract as `getDbClient()`). */
  db: PrismaClient | null
  driver: Env['DB_DRIVER']
  log: (message: string) => void
}

/**
 * Escape hatch for seed data too dynamic for a JSON file (e.g. derived from
 * live catalog data, or relational assignments on a composite-key table).
 * Most seed data should be a `*.json` file instead — see `SeedTableFile` in
 * `src/core/database/seeder/json-seeder.ts`.
 *
 * Every seeder MUST be idempotent — `db:seed` is expected to be re-runnable.
 */
export interface ModuleSeeder {
  /** Unique name, used by the `--class` selector. Convention: PascalCase (`GrantsSeeder`). */
  name: string
  /** Order within the owning module (lowest first). Defaults to 0. */
  order?: number
  run(ctx: SeederContext): Promise<void>
}

export interface LoadedSeeder {
  module: ModuleConfig
  /** Name for the `--class` selector: the JSON file's basename, or the seeder's own `name`. */
  name: string
  order: number
  /** File name, for logging (e.g. `roles.json`, `grants.seeder.ts`). */
  file: string
  run(ctx: SeederContext): Promise<void>
}

export interface SeederFilter {
  /** Only load seeders of this module. */
  module?: string
  /** Only load the seeder whose name matches (case-insensitive). */
  class?: string
}

function seedersDirFor(mod: ModuleConfig): string {
  return path.join(findProjectRoot(), 'src', 'modules', mod.name, 'db', 'seeders')
}

/** `*.json` (declarative table data) or `*.seeder.ts` (escape hatch), sorted by file name. */
function listSeederFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') || f.endsWith('.seeder.ts'))
    .sort()
}

async function loadJsonSeeder(dir: string, file: string, mod: ModuleConfig): Promise<LoadedSeeder> {
  const { readSeedTableFile, runJsonSeeder } =
    await import('../core/database/seeder/json-seeder.js')
  const spec = readSeedTableFile(path.join(dir, file))

  return {
    module: mod,
    name: path.basename(file, '.json'),
    order: spec.order ?? 0,
    file,
    async run(ctx) {
      const count = await runJsonSeeder(spec, ctx.db)
      ctx.log(`${spec.table}: ${count} row(s)`)
    },
  }
}

async function loadTsSeeder(dir: string, file: string, mod: ModuleConfig): Promise<LoadedSeeder> {
  const imported = (await import(pathToFileURL(path.join(dir, file)).href)) as {
    seeder?: ModuleSeeder
  }
  if (!imported.seeder) {
    throw new Error(
      `Seeder file "${path.join('src', 'modules', mod.name, 'db', 'seeders', file)}" does not export \`seeder\`.`
    )
  }
  return {
    module: mod,
    name: imported.seeder.name,
    order: imported.seeder.order ?? 0,
    file,
    run: imported.seeder.run,
  }
}

/**
 * Discover every seeder of the ENABLED modules, ordered by module topological
 * order → seeder `order` → file name. Disabled modules are skipped entirely:
 * their tables no longer exist after `bun run migrate`.
 */
export async function loadSeeders(filter: SeederFilter = {}): Promise<LoadedSeeder[]> {
  const wantedClass = filter.class?.toLowerCase()
  const loaded: LoadedSeeder[] = []

  for (const mod of resolveModules()) {
    if (filter.module && filter.module !== mod.name) continue

    const dir = seedersDirFor(mod)
    const entries: LoadedSeeder[] = []

    for (const file of listSeederFiles(dir)) {
      const entry = file.endsWith('.json')
        ? await loadJsonSeeder(dir, file, mod)
        : await loadTsSeeder(dir, file, mod)
      if (wantedClass && entry.name.toLowerCase() !== wantedClass) continue
      entries.push(entry)
    }

    entries.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file))
    loaded.push(...entries)
  }

  return loaded
}
