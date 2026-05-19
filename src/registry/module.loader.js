import moduleRegistry from './module.registry.js'

/**
 * Validates dependencies and sorts modules topologically.
 * Throws if a required dependency is disabled or missing.
 * @returns {Array<{name: string, path: string}>} sorted module list
 */
function resolveModules() {
  const enabled = new Map(
    moduleRegistry.filter((m) => m.enabled).map((m) => [m.name, m])
  )

  // Validate all dependsOn references are enabled
  for (const mod of enabled.values()) {
    for (const dep of mod.dependsOn) {
      if (!enabled.has(dep)) {
        throw new Error(
          `Module "${mod.name}" depends on "${dep}" which is not enabled. ` +
            `Enable "${dep}" in src/registry/module.registry.js or disable "${mod.name}".`
        )
      }
    }
  }

  // Kahn's algorithm — topological sort
  const inDegree = new Map([...enabled.keys()].map((k) => [k, 0]))
  const adjacency = new Map([...enabled.keys()].map((k) => [k, []]))

  for (const mod of enabled.values()) {
    for (const dep of mod.dependsOn) {
      adjacency.get(dep).push(mod.name)
      inDegree.set(mod.name, (inDegree.get(mod.name) ?? 0) + 1)
    }
  }

  const queue = [...inDegree.entries()].filter(([, v]) => v === 0).map(([k]) => k)
  const sorted = []

  while (queue.length > 0) {
    const name = queue.shift()
    sorted.push(enabled.get(name))
    for (const neighbor of adjacency.get(name)) {
      const newDegree = inDegree.get(neighbor) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== enabled.size) {
    throw new Error('Circular dependency detected in module registry.')
  }

  return sorted
}

/**
 * Registers all enabled modules into the Fastify instance in dependency order.
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function loadModules(fastify) {
  const modules = resolveModules()

  for (const mod of modules) {
    const { default: register } = await import(mod.path)
    await fastify.register(register)
    fastify.log.info(`Module loaded: ${mod.name}`)
  }
}
