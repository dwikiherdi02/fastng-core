import type { ModuleManifest } from '../../registry/manifest.js'

/**
 * The users module is a sidebar menu ("User Management") supporting standard
 * CRUD permissions. `can_access` gates the menu itself (and shows it in the
 * sidebar); the rest gate individual actions via `fastify.authorize(...)`.
 */
export const manifest: ModuleManifest = {
  menu: {
    code: 'user_management',
    name: 'User Management',
    icon: 'users',
    path: '/users',
    order: 2,
  },
  permissions: ['can_access', 'create', 'read', 'update', 'delete', 'export'],
}
