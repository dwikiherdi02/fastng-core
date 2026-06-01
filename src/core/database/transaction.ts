import type { PrismaClient, Prisma } from '@prisma/client'

export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>

export async function withTransaction<T>(
  db: PrismaClient | null,
  callback: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  if (db === null) {
    throw new Error(
      'DB transactions are not supported for the MongoDB driver. ' +
        'MongoDB transactions require a replica set. ' +
        'Use individual repository calls instead.'
    )
  }
  return db.$transaction(callback)
}
