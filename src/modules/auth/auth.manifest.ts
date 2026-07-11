import type { ModuleManifest } from '../../registry/manifest.js'

/**
 * Auth is a service module (login/session/RBAC plumbing), not a sidebar entry,
 * so it declares `menu: false` and contributes nothing to the menu/permission
 * catalog. Its /me/* routes gate only on being authenticated.
 */
export const manifest: ModuleManifest = {
  menu: false,
}
