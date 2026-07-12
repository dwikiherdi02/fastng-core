import type { ModuleManifest } from '../../registry/manifest.js'

/**
 * The users module is a sidebar menu ("User Management"). `can_access` gates the
 * menu; the other permissions gate individual actions via `fastify.authorize(...)`.
 */
export const manifest: ModuleManifest = {
  menu: {
    code: 'user_management',
    name: 'User Management',
    icon: 'users',
    path: '/users',
    order: 2,
  },
  permissions: [
    { code: 'can_access', description: 'Access the User Management menu' },
    { code: 'read', description: 'View users', route: { method: 'GET', path: '/api/v1/users' } },
    { code: 'create', description: 'Create users', route: { method: 'POST', path: '/api/v1/users' } },
    {
      code: 'update',
      description: 'Edit users, assign roles and set per-user permission overrides',
      route: { method: 'PUT', path: '/api/v1/users/:id' },
    },
    { code: 'delete', description: 'Delete users', route: { method: 'DELETE', path: '/api/v1/users/:id' } },
    { code: 'export', description: 'Export the user list' },
  ],
}
