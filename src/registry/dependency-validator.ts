import type { ModuleConfig } from './module.registry.js'

/**
 * Validate that every enabled module's `dependsOn` targets are themselves
 * enabled (and declared). Throws a clear, actionable error otherwise.
 *
 * Shared by the module loader (boot time) and the migration/seed CLI so a
 * misconfigured registry fails loudly in both paths.
 */
export function validateDependencies(modules: ModuleConfig[]): void {
  const byName = new Map(modules.map((m) => [m.name, m]))

  for (const mod of modules) {
    if (!mod.enabled) continue

    for (const dep of mod.dependsOn) {
      const target = byName.get(dep)

      if (!target) {
        throw new Error(
          `Module "${mod.name}" depends on "${dep}", but no module named "${dep}" is declared in the registry. ` +
            `Fix the "dependsOn" entry in src/registry/module.registry.ts.`
        )
      }

      if (!target.enabled) {
        throw new Error(
          `Module "${mod.name}" is enabled but depends on "${dep}", which is disabled. ` +
            `Enable "${dep}" in src/registry/module.registry.ts, or disable "${mod.name}".`
        )
      }
    }
  }
}
