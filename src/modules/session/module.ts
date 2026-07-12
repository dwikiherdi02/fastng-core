import type { FastifyInstance } from 'fastify'

/**
 * `session` is a service module: it owns the `sessions` table and exposes its
 * repository via index.ts (consumed by the auth module). It registers no HTTP
 * routes of its own — the auth module serves the /me/sessions endpoints.
 */
export default async function sessionModule(_fastify: FastifyInstance): Promise<void> {
  // No routes; repository-only module.
}
