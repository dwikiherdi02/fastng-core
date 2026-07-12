import { NotFoundError, ForbiddenError } from '../../../core/utils/errors.js'
import { withTransaction } from '../../../core/database/transaction.js'
import type { UserEntity } from '../entities/user.entity.js'
import type { IUserRepository } from '../repositories/user.repository.js'
import type { IAuthRepository, UserPermissionOverride } from '../../auth/index.js'
import type { ISessionRepository } from '../../session/index.js'
import type { PrismaClient } from '@prisma/client'

interface UserServiceDeps {
  userRepository: IUserRepository
  authRepository: IAuthRepository
  sessionRepository: ISessionRepository
  db: PrismaClient | null
}

interface PaginationOptions {
  page?: number
  limit?: number
}

export class UserService {
  private userRepository: IUserRepository
  private authRepository: IAuthRepository
  private sessionRepository: ISessionRepository
  private db: PrismaClient | null

  constructor({ userRepository, authRepository, sessionRepository, db }: UserServiceDeps) {
    this.userRepository = userRepository
    this.authRepository = authRepository
    this.sessionRepository = sessionRepository
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
      await this.sessionRepository.revokeAllUserSessions(userId)
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

    // user_roles + user_menu_permissions cascade via the auth fragment's User relation;
    // sessions live in another module (scalar FK) so are cleaned explicitly.
    if (this.db) {
      await withTransaction(this.db, async (tx) => {
        await this.sessionRepository.withClient(tx).revokeAllUserSessions(targetId)
        await this.userRepository.withClient(tx).delete(targetId)
      })
    } else {
      await this.sessionRepository.revokeAllUserSessions(targetId)
      await this.userRepository.delete(targetId)
    }
  }

  async assignRoles(userId: string, roleCodes: string[]): Promise<UserEntity> {
    await this.getUserById(userId)
    await this.authRepository.setUserRoles(userId, roleCodes)
    return this.getUserById(userId)
  }

  async getPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    await this.getUserById(userId)
    return this.authRepository.getUserPermissionOverrides(userId)
  }

  async setPermissionOverrides(
    userId: string,
    overrides: UserPermissionOverride[]
  ): Promise<UserPermissionOverride[]> {
    await this.getUserById(userId)
    await this.authRepository.setUserPermissionOverrides(userId, overrides)
    return this.authRepository.getUserPermissionOverrides(userId)
  }
}
