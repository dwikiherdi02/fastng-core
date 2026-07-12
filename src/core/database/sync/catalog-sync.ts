import type { LoadedManifests } from '../../../registry/manifest.js'
import type { MenuManifest, PermissionManifest } from '../../../registry/manifest.js'
import type { ICatalogSyncRepository, MenuInput, PermissionInput } from './catalog-sync.repository.js'

export interface CatalogSyncSummary {
  syncedMenus: string[]
  removedMenus: string[]
}

function menuOf(manifestMenu: MenuManifest | false | undefined): MenuManifest | null {
  return manifestMenu ? manifestMenu : null
}

/**
 * Reconcile the menu/permission catalog with the current registry state:
 * enabled modules' menus are upserted (parents before children); disabled
 * modules' menus (and any grants referencing them) are removed.
 */
export async function syncCatalog(
  repo: ICatalogSyncRepository,
  manifests: LoadedManifests
): Promise<CatalogSyncSummary> {
  const summary: CatalogSyncSummary = { syncedMenus: [], removedMenus: [] }

  const menuInputs: MenuInput[] = manifests.enabled
    .map((m) => ({ menu: menuOf(m.manifest.menu), permissions: m.manifest.permissions ?? [] }))
    .filter((m): m is { menu: MenuManifest; permissions: PermissionManifest[] } => m.menu !== null)
    .map(({ menu, permissions }) => ({
      code: menu.code,
      name: menu.name,
      icon: menu.icon,
      path: menu.path,
      parentCode: menu.parent,
      orderIndex: menu.order ?? 0,
      permissions: permissions.map(
        (p): PermissionInput => ({ code: p.code, name: p.name, description: p.description })
      ),
    }))
    // Upsert top-level menus before children so parent lookups resolve.
    .sort((a, b) => (a.parentCode ? 1 : 0) - (b.parentCode ? 1 : 0))

  for (const menu of menuInputs) {
    await repo.upsertMenu(menu)
    summary.syncedMenus.push(menu.code)
  }

  for (const m of manifests.disabled) {
    const menu = menuOf(m.manifest.menu)
    if (!menu) continue
    await repo.removeMenu(menu.code)
    summary.removedMenus.push(menu.code)
  }

  return summary
}
