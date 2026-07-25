import fs from 'node:fs'
import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'
import { createTableWriter, type SeedRow, type SeedTableSpec } from './table-writer.js'

const SALT_ROUNDS = 12

/** `{ "$env": "SEED_ADMIN_EMAIL" }` — substituted with `process.env.SEED_ADMIN_EMAIL`. */
interface EnvDirective {
  $env: string
}

/** `{ "$hash": <value or directive> }` — bcrypt-hashes the resolved inner value. */
interface HashDirective {
  $hash: unknown
}

function isEnvDirective(v: unknown): v is EnvDirective {
  return typeof v === 'object' && v !== null && '$env' in v
}

function isHashDirective(v: unknown): v is HashDirective {
  return typeof v === 'object' && v !== null && '$hash' in v
}

async function resolveValue(value: unknown): Promise<unknown> {
  if (isEnvDirective(value)) {
    const resolved = process.env[value.$env]
    if (resolved === undefined) {
      throw new Error(`Seeder references env var "${value.$env}", which is not set.`)
    }
    return resolved
  }
  if (isHashDirective(value)) {
    const inner = await resolveValue(value.$hash)
    return bcrypt.hash(String(inner), SALT_ROUNDS)
  }
  return value
}

async function resolveRow(row: SeedRow): Promise<SeedRow> {
  const resolved: SeedRow = {}
  for (const [column, value] of Object.entries(row)) {
    resolved[column] = await resolveValue(value)
  }
  return resolved
}

/** Shape of a `src/modules/{name}/db/seeders/*.json` file. */
export interface SeedTableFile {
  table: string
  uniqueBy: string[]
  rows: SeedRow[]
  /** Order within the owning module (lowest first). Defaults to 0. */
  order?: number
}

export function readSeedTableFile(path: string): SeedTableFile {
  const parsed = JSON.parse(fs.readFileSync(path, 'utf8')) as Partial<SeedTableFile>
  if (!parsed.table || !Array.isArray(parsed.uniqueBy) || !Array.isArray(parsed.rows)) {
    throw new Error(
      `"${path}" must have "table" (string), "uniqueBy" (string[]), and "rows" (array).`
    )
  }
  return { table: parsed.table, uniqueBy: parsed.uniqueBy, rows: parsed.rows, order: parsed.order }
}

/** Resolve directives and upsert every row of a seeder JSON file. Returns the row count. */
export async function runJsonSeeder(file: SeedTableFile, db: PrismaClient | null): Promise<number> {
  const spec: SeedTableSpec = {
    table: file.table,
    uniqueBy: file.uniqueBy,
    rows: await Promise.all(file.rows.map(resolveRow)),
  }
  return createTableWriter(db).upsertRows(spec)
}
