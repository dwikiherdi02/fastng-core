import type { UserEntity } from '../entities/user.entity.js'

export interface UserResponse {
  id: string
  username: string
  email: string
  roles: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export function toUserResponse(entity: UserEntity): UserResponse {
  return {
    id: entity.id,
    username: entity.username,
    email: entity.email,
    roles: entity.roles,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}
