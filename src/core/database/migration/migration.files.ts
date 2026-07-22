import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import env from '../../config/env.config.js'
import { findProjectRoot } from '../../utils/project-root.js'
import { resolveModules } from '../../../registry/topology.js'
import modules, { type ModuleConfig } from '../../../registry/module.registry.js'

/** Forward script, applied by `prisma db execute`. */
export const UP_FILE = 'migration.sql'
/** Reverse script, generated at creation time and replayed by `migrate:rollback`. */
export const DOWN_FILE = 'down.sql'
/** Datamodel state AFTER this migration — the diff baseline for the next one owned by this module. */
export const SNAPSHOT_FILE = 'schema.snapshot.prisma'

export interface MigrationFile {
  /** Owning module name, e.g. `role`. */
  module: string
  /** Folder name, e.g. `20260722143000_init`. Identity is `${module}/${name}`. */
  name: string
  dir: string
  upPath: string
  downPath: string
  snapshotPath: string
}

export function schemaPath(): string {
  return path.join(findProjectRoot(), 'prisma', 'schema.prisma')
}

/** Driver base block (datasource + generator, no models) — the "empty" baseline. */
export function baseSchemaPath(): string {
  return path.join(findProjectRoot(), 'prisma', 'base', `${env.DB_DRIVER}.prisma`)
}

/** A module's own schema fragment (model blocks only), if it ships one. */
export function fragmentPath(module: string): string {
  return path.join(findProjectRoot(), 'src', 'modules', module, 'db', `${module}.prisma`)
}

/** Whether the module has tables of its own — modules like `welcome` don't. */
export function hasFragment(module: string): boolean {
  return fs.existsSync(fragmentPath(module))
}

/** Enabled modules, in topological (dependency) order — the order migrations apply in. */
export function enabledModules(): ModuleConfig[] {
  return resolveModules(modules)
}

/** Every module declared in the registry (enabled or not), in registry declaration order. */
export function allModules(): ModuleConfig[] {
  return modules
}

function migrationsDirFor(module: string): string {
  return path.join(findProjectRoot(), 'src', 'modules', module, 'db', 'migrations')
}

function describe(module: string, name: string): MigrationFile {
  const dir = path.join(migrationsDirFor(module), name)
  return {
    module,
    name,
    dir,
    upPath: path.join(dir, UP_FILE),
    downPath: path.join(dir, DOWN_FILE),
    snapshotPath: path.join(dir, SNAPSHOT_FILE),
  }
}

/** A single module's migration folders, oldest first (folder names are timestamp-prefixed). */
export function listMigrations(module: string): MigrationFile[] {
  const dir = migrationsDirFor(module)
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, UP_FILE)))
    .map((e) => e.name)
    .sort()
    .map((name) => describe(module, name))
}

/**
 * Every migration on disk across every declared module (enabled or not — a
 * disabled module can still have applied migrations pending rollback), in
 * registry declaration order.
 */
export function listAllMigrations(): MigrationFile[] {
  return allModules().flatMap((mod) => listMigrations(mod.name))
}

export function findMigration(module: string, name: string): MigrationFile | null {
  return listMigrations(module).find((m) => m.name === name) ?? null
}

/** `20260722143000` — Prisma's own migration folder timestamp format (UTC). */
export function migrationTimestamp(at: Date = new Date()): string {
  return at.toISOString().replace(/\D/g, '').slice(0, 14)
}

/**
 * The datamodel a module's database tables are expected to be at right now: the
 * snapshot of its newest migration, or the driver base block (no models) when it
 * has none yet. This is the `--from` side when diffing a new migration for it.
 */
export function currentSnapshotPath(module: string): string {
  const migrations = listMigrations(module)
  for (let i = migrations.length - 1; i >= 0; i -= 1) {
    if (fs.existsSync(migrations[i].snapshotPath)) return migrations[i].snapshotPath
  }
  return baseSchemaPath()
}

/**
 * A standalone datamodel for a single module: the driver base block (datasource
 * + generator) plus that module's own fragment. Valid on its own because
 * fragments are self-contained (scalar FKs only, never cross-module `@relation`).
 * Written to a temp file since `prisma migrate diff` takes file paths.
 */
export function composeModuleSchema(module: string): string {
  const content = [
    fs.readFileSync(baseSchemaPath(), 'utf8').trim(),
    '',
    fs.readFileSync(fragmentPath(module), 'utf8').trim(),
    '',
  ].join('\n')

  const file = path.join(os.tmpdir(), `fastng-${module}-${Date.now()}.prisma`)
  fs.writeFileSync(file, content)
  return file
}

/** Create a module's migration folder and write its three files. */
export function writeMigration(
  module: string,
  name: string,
  files: { up: string; down: string; snapshot: string }
): MigrationFile {
  const migration = describe(module, name)
  fs.mkdirSync(migration.dir, { recursive: true })
  fs.writeFileSync(migration.upPath, files.up)
  fs.writeFileSync(migration.downPath, files.down)
  fs.writeFileSync(migration.snapshotPath, files.snapshot)
  return migration
}

/**
 * The driver a module's migration history was written for — read from the
 * `datasource` block of its newest snapshot. `null` when the module has no
 * migrations yet (nothing to conflict with).
 */
export function migrationDriver(module: string): string | null {
  const migrations = listMigrations(module)
  if (migrations.length === 0) return null
  const snapshot = migrations[migrations.length - 1].snapshotPath
  if (!fs.existsSync(snapshot)) return null
  const content = fs.readFileSync(snapshot, 'utf8')
  // Match the provider inside `datasource db { ... }` specifically — the
  // `generator client { provider = "prisma-client-js" }` block comes first and
  // would otherwise be matched instead.
  const datasource = content.match(/datasource\s+\w+\s*\{[^}]*\}/)?.[0] ?? ''
  const match = datasource.match(/provider\s*=\s*"(\w+)"/)
  return match?.[1] ?? null
}
