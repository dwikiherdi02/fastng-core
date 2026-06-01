import type { AuthEntity } from '../entities/auth.entity.js'

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: {
    id: string
    username: string
    email: string
    role: string
    createdAt: Date
  }
}

export function toAuthResponse(entity: AuthEntity, tokens: Tokens): AuthResponse {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: entity.id,
      username: entity.username,
      email: entity.email,
      role: entity.role,
      createdAt: entity.createdAt,
    },
  }
}
