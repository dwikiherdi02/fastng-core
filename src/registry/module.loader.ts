import type { FastifyInstance } from 'fastify'
import modules, { type ModuleConfig } from './module.registry.js'
import { validateDependencies } from './dependency-validator.js'

function resolveModules(): ModuleConfig[] {
  validateDependencies(modules)

  const enabled = modules.filter((m) => m.enabled)

  // Kahn's topological sort
  const inDegree = new Map<string, number>()
  const graph = new Map<string, string[]>()

  for (const mod of enabled) {
    inDegree.set(mod.name, mod.dependsOn.length)
    for (const dep of mod.dependsOn) {
      if (!graph.has(dep)) graph.set(dep, [])
      graph.get(dep)!.push(mod.name)
    }
    if (!graph.has(mod.name)) graph.set(mod.name, [])
  }

  const queue: string[] = []
  for (const mod of enabled) {
    if ((inDegree.get(mod.name) ?? 0) === 0) queue.push(mod.name)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const name = queue.shift()!
    sorted.push(name)
    for (const dependent of graph.get(name) ?? []) {
      const degree = (inDegree.get(dependent) ?? 1) - 1
      inDegree.set(dependent, degree)
      if (degree === 0) queue.push(dependent)
    }
  }

  if (sorted.length !== enabled.length) {
    throw new Error('Circular dependency detected in module registry.')
  }

  const modByName = new Map(enabled.map((m) => [m.name, m]))
  return sorted.map((name) => modByName.get(name)!)
}

export async function loadModules(fastify: FastifyInstance): Promise<void> {
  const sorted = resolveModules()
  for (const mod of sorted) {
    const imported = (await import(mod.path)) as { default: (fastify: FastifyInstance) => Promise<void> }
    fastify.register(imported.default)
  }
}
