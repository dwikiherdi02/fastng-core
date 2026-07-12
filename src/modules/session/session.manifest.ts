import type { ModuleManifest } from '../../registry/manifest.js'

/** Service module (owns the sessions table). Not a sidebar menu. */
export const manifest: ModuleManifest = {
  menu: false,
}
