import type { ModuleManifest } from '../../registry/manifest.js'

/** Role administration is a sidebar menu with a CRUD + grant-management permission set. */
export const manifest: ModuleManifest = {
  menu: {
    code: 'role_management',
    name: 'Role Management',
    icon: 'shield',
    path: '/roles',
    order: 3,
  },
  permissions: [
    { code: 'can_access', description: 'Access the Role Management menu' },
    {
      code: 'read',
      description: 'View roles and their permission grants',
      route: { method: 'GET', path: '/api/v1/roles' },
    },
    {
      code: 'create',
      description: 'Create a new role',
      route: { method: 'POST', path: '/api/v1/roles' },
    },
    {
      code: 'update',
      description: 'Edit a role and set its permission grants',
      route: { method: 'PUT', path: '/api/v1/roles/:id' },
    },
    {
      code: 'delete',
      description: 'Delete a role',
      route: { method: 'DELETE', path: '/api/v1/roles/:id' },
    },
  ],
}
