import type { ModuleManifest } from '../../registry/manifest.js'

/** A simple top-level sidebar entry that only needs `can_access`. */
export const manifest: ModuleManifest = {
  menu: {
    code: 'dashboard',
    name: 'Dashboard',
    icon: 'home',
    path: '/',
    order: 1,
  },
  permissions: ['can_access'],
}
