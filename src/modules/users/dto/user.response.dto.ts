import type { UserEntity } from '../entities/user.entity.js'

export interface UserResponse {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
  updatedAt: Date
}

export function toUserResponse(entity: UserEntity): UserResponse {
  return {
    id: entity.id,
    username: entity.username,
    email: entity.email,
    role: entity.role,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}
