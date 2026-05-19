/**
 * Maps a UserEntity to the API response shape.
 * @param {import('../entities/user.entity.js').UserEntity} entity
 */
export function toUserResponse(entity) {
  return {
    id: entity.id,
    username: entity.username,
    email: entity.email,
    role: entity.role,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }
}
