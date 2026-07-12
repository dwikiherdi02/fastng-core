import type { ModuleManifest } from '../../registry/manifest.js'

/** Service module (owns the menus + menu_permissions catalog). Not a sidebar menu. */
export const manifest: ModuleManifest = {
  menu: false,
}
