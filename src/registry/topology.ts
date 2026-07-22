import modules, { type ModuleConfig } from './module.registry.js'
import { validateDependencies } from './dependency-validator.js'

/**
 * Resolve the enabled modules into load order: dependencies always come before
 * the modules that declare them (Kahn's topological sort).
 *
 * Shared by the boot-time module loader and the seeder loader so both walk the
 * registry in exactly the same order.
 */
export function resolveModules(list: ModuleConfig[] = modules): ModuleConfig[] {
  validateDependencies(list)

  const enabled = list.filter((m) => m.enabled)

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
