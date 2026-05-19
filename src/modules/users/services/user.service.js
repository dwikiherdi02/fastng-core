import { NotFoundError, ForbiddenError } from '../../../core/utils/errors.js'
import { withTransaction } from '../../../core/database/transaction.js'

export class UserService {
  /**
   * @param {object} deps
   * @param {import('../repositories/user.prisma.repository.js').UserPrismaRepository} deps.userRepository
   * @param {import('../../auth/repositories/auth.prisma.repository.js').AuthPrismaRepository} deps.authRepository
   * @param {import('../../auth/services/auth.service.js').AuthService} deps.authService
   * @param {import('@prisma/client').PrismaClient | null} deps.db
   */
  constructor({ userRepository, authRepository, authService, db }) {
    this.userRepository = userRepository
    this.authRepository = authRepository
    this.authService = authService
    this.db = db
  }

  async getProfile(userId) {
    const entity = await this.userRepository.findById(userId)
    if (!entity) throw new NotFoundError('User not found')
    return entity
  }

  async updateProfile(userId, data) {
    const entity = await this.userRepository.findById(userId)
    if (!entity) throw new NotFoundError('User not found')

    const updated = await this.userRepository.update(userId, data)

    // Service-in-service: if email changes, revoke all active sessions via AuthService
    // so the user is forced to re-authenticate with the new credentials.
    if (data.email && data.email !== entity.email) {
      await this.authService.revokeAllTokens(userId)
    }

    return updated
  }

  async listUsers({ page, limit } = {}) {
    return this.userRepository.findAll({ page, limit })
  }

  async getUserById(requesterId, targetId) {
    const entity = await this.userRepository.findById(targetId)
    if (!entity) throw new NotFoundError('User not found')
    return entity
  }

  async deleteUser(requesterId, targetId) {
    if (requesterId === targetId) throw new ForbiddenError('Cannot delete your own account')
    const entity = await this.userRepository.findById(targetId)
    if (!entity) throw new NotFoundError('User not found')

    // Multi-repo transaction: delete user row and all their refresh tokens atomically.
    // If either operation fails, both are rolled back.
    await withTransaction(this.db, async (tx) => {
      await this.userRepository.withClient(tx).delete(targetId)
      await this.authRepository.withClient(tx).deleteAllRefreshTokensForUser(targetId)
    })
  }
}
