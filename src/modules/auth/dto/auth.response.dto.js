/**
 * Maps an AuthEntity + tokens into the API response shape.
 * @param {import('../entities/auth.entity.js').AuthEntity} entity
 * @param {{ accessToken: string, refreshToken: string }} tokens
 */
export function toAuthResponse(entity, tokens) {
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
