import { Prisma, type PrismaClient } from '@prisma/client'
import mongoose from 'mongoose'
import env from '../../config/env.config.js'

/** One row to upsert, keyed by column name (snake_case — matches the JSON seeder file). */
export type SeedRow = Record<string, unknown>

export interface SeedTableSpec {
  /** Target table (Prisma) or collection (Mongo) name, e.g. `roles`. */
  table: string
  /** Columns that identify a row for idempotent upsert, e.g. `["code"]`. */
  uniqueBy: string[]
  rows: SeedRow[]
}

export interface ITableWriter {
  /** Upsert every row by `uniqueBy`. Returns the number of rows written. */
  upsertRows(spec: SeedTableSpec): Promise<number>
}

function uncapitalize(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

/**
 * Writes JSON seeder rows straight to a table via the Prisma client, translating
 * column names (`snake_case`, as `@map`ped) to Prisma field names (`camelCase`)
 * using the schema's DMMF — the same metadata Prisma Client itself is built
 * from, so it always matches whatever `prisma/schema.prisma` currently says.
 *
 * Scoped to models with a single `@id` field: `findFirst` locates the row by
 * `uniqueBy`, then `update`/`create` goes through the id. Tables with a
 * composite primary key (e.g. join tables like `user_roles`) aren't
 * identifiable this way — those are relational by nature and belong in a
 * `*.seeder.ts` instead.
 */
class PrismaTableWriter implements ITableWriter {
  constructor(private prisma: PrismaClient) {}

  private findModel(table: string) {
    const model = Prisma.dmmf.datamodel.models.find((m) => (m.dbName ?? m.name) === table)
    if (!model) {
      throw new Error(
        `No Prisma model maps to table "${table}". Check the "table" field in the seeder JSON.`
      )
    }
    return model
  }

  async upsertRows(spec: SeedTableSpec): Promise<number> {
    const model = this.findModel(spec.table)
    const idField = model.fields.find((f) => f.isId)
    if (!idField) {
      throw new Error(
        `Table "${spec.table}" has no single id field (likely a composite-key join table) — ` +
          `write a *.seeder.ts for it instead of a JSON seeder.`
      )
    }

    const scalarFields = model.fields.filter((f) => f.kind === 'scalar')
    const columnToField = new Map(scalarFields.map((f) => [f.dbName ?? f.name, f.name]))

    const toFieldData = (row: SeedRow): Record<string, unknown> => {
      const data: Record<string, unknown> = {}
      for (const [column, value] of Object.entries(row)) {
        const field = columnToField.get(column)
        if (!field) {
          throw new Error(`Column "${column}" does not exist on table "${spec.table}".`)
        }
        data[field] = value
      }
      return data
    }

    const delegateKey = uncapitalize(model.name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (this.prisma as any)[delegateKey]
    if (!delegate) {
      throw new Error(`Prisma client has no "${delegateKey}" delegate for table "${spec.table}".`)
    }

    let count = 0
    for (const row of spec.rows) {
      const data = toFieldData(row)
      const where: Record<string, unknown> = {}
      for (const column of spec.uniqueBy) {
        const field = columnToField.get(column)
        if (!field) {
          throw new Error(`uniqueBy column "${column}" does not exist on table "${spec.table}".`)
        }
        where[field] = data[field]
      }

      const existing = await delegate.findFirst({ where })
      if (existing) {
        await delegate.update({ where: { [idField.name]: existing[idField.name] }, data })
      } else {
        await delegate.create({ data })
      }
      count += 1
    }
    return count
  }
}

/**
 * Writes JSON seeder rows to a MongoDB collection directly. Collection and
 * field names are already snake_case (see `src/core/database/models/`), so the
 * JSON file needs no translation — the same file format works for both drivers.
 */
class MongoTableWriter implements ITableWriter {
  async upsertRows(spec: SeedTableSpec): Promise<number> {
    const collection = mongoose.connection.collection(spec.table)
    let count = 0
    for (const row of spec.rows) {
      const filter: Record<string, unknown> = {}
      for (const column of spec.uniqueBy) filter[column] = row[column]
      await collection.updateOne(filter, { $set: row }, { upsert: true })
      count += 1
    }
    return count
  }
}

export function createTableWriter(db: PrismaClient | null): ITableWriter {
  if (env.DB_DRIVER === 'mongodb') return new MongoTableWriter()
  return new PrismaTableWriter(db!)
}
