/**
 * withTransaction — runs a callback inside a DB transaction.
 *
 * For Prisma drivers (sqlite / mysql / postgresql):
 *   Uses Prisma interactive transactions. The callback receives a `tx` client
 *   that behaves exactly like PrismaClient. Pass it to repository.withClient(tx)
 *   to make a repository operate inside the transaction.
 *
 * For MongoDB driver:
 *   Not supported — Mongoose transactions require a replica set which is
 *   outside the scope of this boilerplate. Throws an error immediately.
 *
 * @template T
 * @param {import('@prisma/client').PrismaClient | null} db  — fastify.db
 * @param {(tx: import('@prisma/client').PrismaClient) => Promise<T>} callback
 * @returns {Promise<T>}
 *
 * @example
 * // In a service method:
 * return withTransaction(this.db, async (tx) => {
 *   await this.userRepository.withClient(tx).delete(userId)
 *   await this.authRepository.withClient(tx).deleteAllRefreshTokensForUser(userId)
 * })
 */
export async function withTransaction(db, callback) {
  if (db === null) {
    throw new Error(
      'DB transactions are not supported for the MongoDB driver. ' +
        'MongoDB transactions require a replica set. ' +
        'Use individual repository calls instead.'
    )
  }
  return db.$transaction(callback)
}
