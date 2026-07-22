import type { PrismaClient } from '@prisma/client'
import env from '../../config/env.config.js'

/**
 * The migration repository: which module's migration ran, and in which batch.
 *
 * Laravel-style `migrate:rollback` / `migrate:reset` work per batch, so batch
 * numbers are the core of the model — shared across every module so one
 * `bun run migrate` run can be rolled back as a unit even though each module's
 * migrations live in its own folder. Migrations are applied with
 * `prisma db execute`, not `prisma migrate deploy`, so this table — created by
 * `migrate:install` — is the single source of truth for what has been applied.
 */
export const LEDGER_TABLE = '_fastng_migrations'

export interface LedgerEntry {
  module: string
  migration: string
  batch: number
}

const CREATE_TABLE: Record<string, string> = {
  sqlite: `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    migration TEXT NOT NULL,
    batch INTEGER NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module, migration)
  )`,
  mysql: `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    migration VARCHAR(255) NOT NULL,
    batch INT NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_module_migration (module, migration)
  )`,
  postgresql: `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
    id SERIAL PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    migration VARCHAR(255) NOT NULL,
    batch INT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module, migration)
  )`,
  // SQL Server has no CREATE TABLE IF NOT EXISTS.
  sqlserver: `IF OBJECT_ID('${LEDGER_TABLE}', 'U') IS NULL CREATE TABLE ${LEDGER_TABLE} (
    id INT IDENTITY(1,1) PRIMARY KEY,
    module NVARCHAR(100) NOT NULL,
    migration NVARCHAR(255) NOT NULL,
    batch INT NOT NULL,
    applied_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_fastng_migrations UNIQUE (module, migration)
  )`,
}

export class MigrationLedger {
  constructor(private prisma: PrismaClient) {}

  /** Create the ledger table if it does not exist yet. Idempotent. */
  async ensureTable(): Promise<void> {
    const ddl = CREATE_TABLE[env.DB_DRIVER]
    if (!ddl) throw new Error(`No migration ledger DDL for driver "${env.DB_DRIVER}".`)
    await this.prisma.$executeRawUnsafe(ddl)
  }

  /** Applied migrations, oldest batch first. */
  async list(): Promise<LedgerEntry[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      { module: string; migration: string; batch: number }[]
    >(
      `SELECT module, migration, batch FROM ${LEDGER_TABLE} ORDER BY batch ASC, module ASC, migration ASC`
    )
    return rows.map((r) => ({ module: r.module, migration: r.migration, batch: Number(r.batch) }))
  }

  /** Highest batch number in use, or 0 when nothing has been applied. */
  async lastBatch(): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<{ batch: number | null }[]>(
      `SELECT MAX(batch) AS batch FROM ${LEDGER_TABLE}`
    )
    return Number(rows[0]?.batch ?? 0)
  }

  async record(module: string, migration: string, batch: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      placeholders(`INSERT INTO ${LEDGER_TABLE} (module, migration, batch) VALUES (?, ?, ?)`),
      module,
      migration,
      batch
    )
  }

  async forget(module: string, migration: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      placeholders(`DELETE FROM ${LEDGER_TABLE} WHERE module = ? AND migration = ?`),
      module,
      migration
    )
  }

  async clear(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`DELETE FROM ${LEDGER_TABLE}`)
  }
}

/** Rewrite `?` placeholders into the dialect's parameter syntax. */
function placeholders(sql: string): string {
  if (env.DB_DRIVER === 'postgresql') {
    let i = 0
    return sql.replace(/\?/g, () => `$${(i += 1)}`)
  }
  if (env.DB_DRIVER === 'sqlserver') {
    let i = 0
    return sql.replace(/\?/g, () => `@P${(i += 1)}`)
  }
  return sql
}
