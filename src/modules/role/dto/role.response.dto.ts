import type { RoleRecord } from '../repositories/role.repository.js'

export function toRoleResponse(role: RoleRecord) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isActive: role.isActive,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }
}
