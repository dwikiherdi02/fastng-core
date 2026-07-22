import type { FastifyInstance } from 'fastify'
import { resolveModules } from './topology.js'

export async function loadModules(fastify: FastifyInstance): Promise<void> {
  const sorted = resolveModules()
  for (const mod of sorted) {
    const imported = (await import(mod.path)) as {
      default: (fastify: FastifyInstance) => Promise<void>
    }
    fastify.register(imported.default)
  }
}
