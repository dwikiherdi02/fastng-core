import modules, { type ModuleConfig } from './module.registry.js'

/**
 * Declarative metadata a module ships alongside its code. Used by the
 * migration/seed CLI to sync the menu + permission catalog into the database
 * bidirectionally: enabled modules are upserted, disabled ones are removed.
 *
 * A module that is a pure service/helper (not a sidebar entry) sets `menu: false`
 * (or omits it). A menu module declares its sidebar metadata under `menu`.
 */
export interface MenuManifest {
  code: string
  name: string
  icon?: string
  path?: string
  /** `code` of the parent menu for nested sidebars (self-referencing tree). */
  parent?: string
  order?: number
}

export interface ModuleManifest {
  menu?: MenuManifest | false
  /** Permission codes this menu supports, e.g. ['create','read','update','delete','export','can_access']. */
  permissions?: string[]
}

export interface LoadedManifest {
  module: ModuleConfig
  manifest: ModuleManifest
}

export interface LoadedManifests {
  /** Manifests of modules with `enabled: true` — their catalog is upserted. */
  enabled: LoadedManifest[]
  /** Manifests of modules with `enabled: false` — their catalog is removed. */
  disabled: LoadedManifest[]
}

/** Derive a module's manifest file path from its registry `path` (module.js → {name}.manifest.js). */
function manifestPathFor(mod: ModuleConfig): string {
  return mod.path.replace(/module\.js$/, `${mod.name}.manifest.js`)
}

async function importManifest(mod: ModuleConfig): Promise<ModuleManifest | null> {
  try {
    const imported = (await import(manifestPathFor(mod))) as { manifest?: ModuleManifest }
    return imported.manifest ?? null
  } catch {
    // No manifest file → the module is a plain service/helper with no menu/permissions.
    return null
  }
}

/**
 * Load manifests for every declared module (enabled and disabled). Disabled
 * modules are imported too because the CLI needs to know what to delete.
 * Manifests are pure data with no side effects, so importing a disabled one is safe.
 */
export async function loadManifests(): Promise<LoadedManifests> {
  const result: LoadedManifests = { enabled: [], disabled: [] }

  for (const mod of modules) {
    const manifest = await importManifest(mod)
    if (!manifest) continue
    const bucket = mod.enabled ? result.enabled : result.disabled
    bucket.push({ module: mod, manifest })
  }

  return result
}
