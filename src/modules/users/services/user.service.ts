import { NotFoundError, ForbiddenError } from '../../../core/utils/errors.js'
import { withTransaction } from '../../../core/database/transaction.js'
import type { UserEntity } from '../entities/user.entity.js'
import type { IUserRepository } from '../repositories/user.repository.js'
import type { IAuthRepository } from '../../auth/index.js'
import type { AuthService } from '../../auth/index.js'
import type { PrismaClient } from '@prisma/client'

interface UserServiceDeps {
  userRepository: IUserRepository
  authRepository: IAuthRepository
  authService: AuthService
  db: PrismaClient | null
}

interface PaginationOptions {
  page?: number
  limit?: number
}

export class UserService {
  private userRepository: IUserRepository
  private authRepository: IAuthRepository
  private authService: AuthService
  private db: PrismaClient | null

  constructor({ userRepository, authRepository, authService, db }: UserServiceDeps) {
    this.userRepository = userRepository
    this.authRepository = authRepository
    this.authService = authService
    this.db = db
  }

  async getProfile(userId: string): Promise<UserEntity> {
    const entity = await this.userRepository.findById(userId)
    if (!entity) throw new NotFoundError('User not found')
    return entity
  }

  async updateProfile(
    userId: string,
    data: { username?: string; email?: string }
  ): Promise<UserEntity> {
    const existing = await this.userRepository.findById(userId)
    if (!existing) throw new NotFoundError('User not found')
    const updated = await this.userRepository.update(userId, data)
    if (data.email && data.email !== existing.email) {
      await this.authService.revokeAllTokens(userId)
    }
    return updated
  }

  async listUsers(options: PaginationOptions): Promise<{ items: UserEntity[]; total: number }> {
    return this.userRepository.findAll(options)
  }

  async getUserById(id: string): Promise<UserEntity> {
    const entity = await this.userRepository.findById(id)
    if (!entity) throw new NotFoundError('User not found')
    return entity
  }

  async deleteUser(requesterId: string, targetId: string): Promise<void> {
    if (requesterId === targetId) throw new ForbiddenError('Cannot delete your own account')
    const user = await this.userRepository.findById(targetId)
    if (!user) throw new NotFoundError('User not found')

    await withTransaction(this.db, async (tx) => {
      const userRepo = this.userRepository.withClient(tx)
      const authRepo = this.authRepository.withClient(tx)
      await authRepo.revokeAllUserSessions(targetId)
      await userRepo.delete(targetId)
    })
  }
}
