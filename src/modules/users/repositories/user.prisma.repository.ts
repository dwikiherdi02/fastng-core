import type { PrismaClient } from '@prisma/client'
import type { TransactionClient } from '../../../core/database/transaction.js'
import { UserEntity } from '../entities/user.entity.js'
import type { IUserRepository } from './user.repository.js'

interface UserRow {
  id: string
  username: string
  email: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function toEntity(record: UserRow, roles: string[]): UserEntity {
  return new UserEntity({
    id: record.id,
    username: record.username,
    email: record.email,
    roles,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}

export class UserPrismaRepository implements IUserRepository {
  constructor(private prisma: PrismaClient | TransactionClient) {}

  private async roleCodesForMany(userIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>()
    if (userIds.length === 0) return result
    const userRoles = await this.prisma.userRole.findMany({ where: { userId: { in: userIds } } })
    if (userRoles.length === 0) return result
    const roles = await this.prisma.role.findMany({
      where: { id: { in: [...new Set(userRoles.map((ur) => ur.roleId))] } },
    })
    const codeById = new Map(roles.map((r) => [r.id, r.code]))
    for (const ur of userRoles) {
      const code = codeById.get(ur.roleId)
      if (!code) continue
      const list = result.get(ur.userId) ?? []
      list.push(code)
      result.set(ur.userId, list)
    }
    return result
  }

  async findById(id: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findUnique({ where: { id } })
    if (!record) return null
    const roles = (await this.roleCodesForMany([id])).get(id) ?? []
    return toEntity(record, roles)
  }

  async findAll({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}): Promise<{
    items: UserEntity[]
    total: number
  }> {
    const skip = (page - 1) * limit
    const [records, total] = await Promise.all([
      this.prisma.user.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count(),
    ])
    const rolesByUser = await this.roleCodesForMany(records.map((r) => r.id))
    return { items: records.map((r) => toEntity(r, rolesByUser.get(r.id) ?? [])), total }
  }

  async update(id: string, data: { username?: string; email?: string }): Promise<UserEntity> {
    const record = await this.prisma.user.update({ where: { id }, data })
    const roles = (await this.roleCodesForMany([id])).get(id) ?? []
    return toEntity(record, roles)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } })
  }

  withClient(tx: TransactionClient): IUserRepository {
    return new UserPrismaRepository(tx)
  }
}
